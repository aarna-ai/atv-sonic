// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./Interfaces/IUniswapV3Factory.sol";
import "./Libraries/OracleLibrary.sol";
import "./Interfaces/IAFi.sol";
import {SafeCast} from "./Interfaces/SafeCast.sol";
import {SafeERC20} from "./Interfaces/SafeERC20.sol";
import {OwnableDelayModule} from "./Interfaces/OwnableDelayModule.sol";
import {AggregatorV3Interface} from "./Interfaces/AggregatorV3Interface.sol";
import {ReentrancyGuard} from "./Interfaces/ReentrancyGuard.sol";
import {ISwapRouter} from "./Interfaces/ISwapRouter.sol";
import "./Interfaces/IPassiveRebal.sol";

struct RewardOwed {
  address token;
  uint owed;
}

interface ICompRewardV3 {
  function getRewardOwed(
    address comet,
    address account
  ) external returns (RewardOwed memory);

  function claim(address comet, address src, bool shouldAccrue) external;
}

contract ParentAFiOracle is ReentrancyGuard, OwnableDelayModule {
  using SafeCast for uint256;
  using SafeERC20 for IERC20;

  IAFiStorage internal aFiStorage;

  mapping(address => mapping(address => uint24)) public _fee;

  uint32 internal secondsAgo = 900;
  uint256 internal csFee = 5e20;
  uint256 internal csFeeUpperLimit = 5e21;

  address internal rebal;
  uint256 internal stalePricewindowLimit = 1 hours;
  uint internal daoProfit = 6;
  uint internal totalProfit = 10;
  bool public paused;

  address[] internal token;
  address[] internal uTokens;

  address internal afiManager;
  mapping(address => address) internal cumulativeSwapControllers;
  mapping(address => address) internal unstakingController;

  address internal constant UNISWAP_FACTORY =
    0x1F98431c8aD98523631AE4a59f267346ea31F984;
  address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
  address private constant USDC_ORACLE = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  ICompRewardV3 internal constant COMPV3_REWARD =
    ICompRewardV3(0x1B0e765F6224C21223AeA2af16c1C46E38885a40);

  struct TokenInfo {
    address[] tokens;
    address[] uTokens;
    uint256[] uTokenProportions;
    uint256[] defaultProportion;
  }

  struct WithdrawQueueDetails {
    mapping(address => mapping(address => mapping(uint256 => uint256))) queuedShares;
  }

  struct WithdrawQueueNAVDetail {
    mapping(address => mapping(address => mapping(uint256 => uint256))) queuedNAV;
  }

  mapping(address => WithdrawQueueDetails) internal userOtokenLiability;
  mapping(address => WithdrawQueueNAVDetail) internal userQueuedNAV;
  mapping(address => uint) internal stalePriceDelay;
  mapping(address => uint256) internal lastSwapTime;
  mapping(address => uint) internal swapPeriod;
  mapping(address => address) internal underlyingUniPoolToken;
  mapping(address => mapping(address => mapping(uint => uint))) public totalShares;
  mapping(address => mapping(address => mapping(uint => uint))) public outputTokenUnits;
  mapping(address => uint256) public batchWithdrawCounter;
  mapping(address => mapping(uint => uint)) public totalQueuedShares;
  mapping(address => mapping(address => uint)) internal teamWalletsProfit;

  mapping(address => bool) public queuePausedStatus;

  event ProfitShareUpdated(uint daoProfit, uint totalProfit);
  event ProfitShareDistributed(
    address indexed aFiContract,
    address indexed teamWallet,
    uint256 amount
  );
  event WithdrawQueue(
    address indexed user,
    uint256 shares,
    address indexed oToken,
    uint256 withdrawCounter
  );
  event WithdrawDeQueue(address indexed user, uint256 shares, uint256 withdrawCounter);

  /**
   * @notice To initialize/deploy the AFIOracle contract.
   * @param passiveRebalContract Address of AFiPassiveRebalStrategies contract.
   */
  constructor(address passiveRebalContract) {
    addressZero(passiveRebalContract);
    rebal = passiveRebalContract;
  }

  /**
   * @param account Address of the account that paused the contract.
   */
  event Paused(address account);
  /**
   * @param account Address of the account that unpaused the contract.
   */
  event Unpaused(address account);

  function getMidToken(address tok) external view returns (address) {
    return underlyingUniPoolToken[tok];
  }

  function addressZero(address add1) internal pure {
    require(add1 != address(0), "AF03");
  }

  function updateAFiManager(address _afiManager) external onlyOwner {
    addressZero(_afiManager);
    afiManager = _afiManager;
  }

  function getTotalProfit() external view returns (uint256) {
    return totalProfit;
  }

  function getDaoProfit() external view returns (uint256) {
    return daoProfit;
  }

  function updateMidToken(address[] memory tok, address[] memory midTok) external {
    require(
      msg.sender == owner() ||
        msg.sender == afiManager ||
        msg.sender == IAFiManager(afiManager).rebalanceController(),
      "NA"
    );
    for (uint i; i < tok.length; i++) {
      addressZero(tok[i]);
      addressZero(midTok[i]);
      underlyingUniPoolToken[tok[i]] = midTok[i];
    }
  }

  modifier contractUnpaused() {
    checkStatus(!paused);
    _;
  }

  modifier contractPaused() {
    checkStatus(paused);
    _;
  }

  function checkStatus(bool status) internal view {
    require(status, "AFO08");
  }

  function greaterComparison(uint256 valA, uint256 valB) internal pure {
    require(valA >= valB, "AO24");
  }

  /**
   * @notice To pause the contract.
   * @dev Requirements: It can only be invoked by owner.
   */
  function pause() external contractUnpaused onlyOwner {
    paused = true;
    emit Paused(msg.sender);
  }

  /**
   * @notice To resume/unpause the contract.
   * @dev Requirements: It can only be invoked by the owner.
   */
  function unPause() external contractPaused onlyOwner {
    paused = false;
    emit Unpaused(msg.sender);
  }

  function setAFiStorage(address _storage) external onlyOwner {
    addressZero(_storage);
    aFiStorage = IAFiStorage(_storage);
  }

  /**
   * @notice Updates the address of the cumulative swap wallet for aFi Vault.
   * @dev Only the contract owner can call this function.
   * @param afiContract Vault address
   * @param _cumulativeSwapController New address for the cumulative swap wallet for afiContract vault.
   * @param _unstakingController New address for the unstaking controller wallet for afiContract vault.
   */
  function updateVaultControllers(
    address afiContract,
    address _cumulativeSwapController,
    address _unstakingController
  ) external onlyOwner {
    cumulativeSwapControllers[afiContract] = _cumulativeSwapController;
    unstakingController[afiContract] = _unstakingController;
  }

  function getControllers(
    address afiContract
  ) external view returns (address, address) {
    return (cumulativeSwapControllers[afiContract], unstakingController[afiContract]);
  }

  /**
   * @notice Executes cumulative token swaps and updates staking for underlying tokens.
   * @param params The struct containing swap parameters.
   */
  function cumulativeSwap(IAFi.SwapParameters memory params) external {
    require(
      msg.sender == cumulativeSwapControllers[params.afiContract] ||
        msg.sender == afiManager,
      "NA"
    );
    require(
      block.timestamp - lastSwapTime[params.afiContract] >=
        swapPeriod[params.afiContract],
      "Swap period not elapsed"
    );
    // Check if deposit is paused
    (bool depositPaused, ) = IAFi(params.afiContract).isPaused();
    checkStatus(depositPaused);

    TokenInfo memory tokenInfo;
    (params.depositTokens, ) = IAFi(params.afiContract).getInputToken();
    params.cSwapCounter = IAFi(params.afiContract).getcSwapCounter();
    tokenInfo.uTokens = IAFi(params.afiContract).getUTokens();
    require(tokenInfo.uTokens.length > 0, "Reinitialize the vault");

    if (params.cometRewardTokens.length > 0)
      claimCompV3Rewards(
        params.afiContract,
        params.cometToClaim,
        params.cometRewardTokens,
        params.rewardTokenMinReturnAmounts,
        params.oToken,
        params._deadline
      );

    uint256 totalProp = IAFi(params.afiContract).underlyingTokensStaking(
      params.depositTokens
    );
    (tokenInfo.uTokenProportions, tokenInfo.defaultProportion) = IAFi(
      params.afiContract
    ).getProportions();
    performTokenSwaps(params, tokenInfo, totalProp);

    aFiStorage.rearrange(
      params.afiContract,
      params.underlyingTokens,
      params.newProviders
    );
    // Update last swap time after all operations are complete
    lastSwapTime[params.afiContract] = block.timestamp;
    IAFi(params.afiContract).pauseUnpauseDeposit(false);
    IAFiManager(afiManager).pauseQueueWithdrawUnstaking(params.afiContract, false);
  }

  function claimCompV3Rewards(
    address afiContract,
    address[] memory cometToClaim,
    address[] memory cometRewardTokens,
    uint256[] memory rewardTokenMinReturnAmounts,
    address oToken,
    uint256 _deadline
  ) internal {
    uint256 balToSwap;
    address tok;
    for (uint8 i = 0; i < uint8(cometToClaim.length); i++) {
      tok = cometRewardTokens[i];
      balToSwap = IERC20(tok).balanceOf(afiContract);

      COMPV3_REWARD.claim(cometToClaim[i], afiContract, true);
      if (IERC20(tok).balanceOf(afiContract) > balToSwap) {
        balToSwap = IERC20(tok).balanceOf(afiContract) - balToSwap;
        doSwap(
          afiContract,
          tok,
          oToken,
          balToSwap,
          _deadline,
          WETH,
          rewardTokenMinReturnAmounts[i]
        );
      }
    }
  }

  function performTokenSwaps(
    IAFi.SwapParameters memory params,
    TokenInfo memory tokenInfo,
    uint256 totalProp
  ) internal {
    uint256 temp;
    for (uint256 j = 0; j < params.depositTokens.length; j++) {
      (temp) = aFiStorage.getPreSwapDepositsTokens(
        params.afiContract,
        params.cSwapCounter,
        params.depositTokens[j]
      );
      if (params.depositTokens[j] != params.oToken && temp > 0) {
        doSwap(
          params.afiContract,
          params.depositTokens[j],
          params.oToken,
          temp,
          params._deadline,
          WETH,
          params.iMinimumReturnAmount[j]
        );
      }
    }
    // Assuming `redeemTxFee` and `csFee` are defined and handled elsewhere
    require(
      redeemTxFee(params.afiContract, params.oToken, params.cSwapFee) <= csFee,
      "AFO01"
    );

    swapIntoUnderlying(params, tokenInfo, totalProp);
  }

  function swapIntoUnderlying(
    IAFi.SwapParameters memory params,
    TokenInfo memory tokenInfo,
    uint256 _totalProp
  ) internal {
    uint256 tempBalance;
    uint256[] memory tokenProportions = tokenInfo.uTokenProportions;

    // Check for passive rebalance status and adjust token proportions if necessary
    if (
      IPassiveRebal(rebal).getRebalStrategyNumber(params.afiContract) == 0
    ) {
      tokenProportions = tokenInfo.defaultProportion;
      _totalProp = 0;
      for (uint i = 0; i < tokenProportions.length; i++) {
        _totalProp += tokenProportions[i];
      }
    }

    tempBalance = IERC20(params.oToken).balanceOf(params.afiContract);
    for (uint i = 0; i < tokenInfo.uTokens.length; i++) {
      // Perform swap if conditions are met
      if (tokenProportions[i] >= 1 && tempBalance > 0) {
        doSwap(
          params.afiContract,
          params.oToken,
          tokenInfo.uTokens[i],
          (tempBalance * tokenProportions[i]) / _totalProp,
          params._deadline,
          address(0), // Assuming this is intended as the recipient or a swap parameter
          params.minimumReturnAmount[i]
        );
      }
    }
  }

  /**
   * @notice Computes the redemption fee for a transaction.
   * @dev This function is internal and computes the redemption fee based on the provided parameters.
   * @param afiContract The address of the AFi contract.
   * @param _inputToken The address of the input token for the transaction.
   * @param cSwapFee The cumulative swap fee to calculate the redemption fee from.
   * @return redFee The computed redemption fee.
   */
  function redeemTxFee(
    address afiContract,
    address _inputToken,
    uint256 cSwapFee
  ) internal returns (uint256 redFee) {
    if (cSwapFee > 0) {
      (uint256 price, uint256 decimal) = getPriceInUSDC(_inputToken);
      uint iTokenDecimal = 18 - IERC20(_inputToken).decimals();
      redFee = (((cSwapFee) * price * (10 ** iTokenDecimal)) / (decimal));
      IERC20(_inputToken).safeTransferFrom(
        afiContract,
        cumulativeSwapControllers[afiContract],
        cSwapFee
      );
    }
  }

  /**
   * @notice Queues a withdrawal for a user.
   * @param afiContract The address of the AFi contract.
   * @param _shares The amount of shares to withdraw.
   * @param oToken The address of the output token.
   */
  function queueWithdraw(
    address afiContract,
    uint _shares,
    address oToken
  ) external nonReentrant {
    checkStatus(!(queuePausedStatus[afiContract]));

    IAFi(afiContract).validateWithdraw(msg.sender, oToken, _shares);

    uint256 userOtokenLiabilityOld = userOtokenLiability[msg.sender].queuedShares[
      afiContract
    ][oToken][batchWithdrawCounter[afiContract]];
    uint256 userNAV = IAFi(afiContract).depositUserNav(msg.sender);

    userOtokenLiability[msg.sender].queuedShares[afiContract][oToken][
      batchWithdrawCounter[afiContract]
    ] = userOtokenLiabilityOld + _shares;
 
    uint256 userQNAV = userQueuedNAV[msg.sender].queuedNAV[afiContract][oToken][batchWithdrawCounter[afiContract]];

    userQueuedNAV[msg.sender].queuedNAV[afiContract][oToken][batchWithdrawCounter[afiContract]] = ((userQNAV * userOtokenLiabilityOld) + 
    ((userNAV * _shares)))/ (userOtokenLiabilityOld + _shares);

    totalShares[afiContract][oToken][batchWithdrawCounter[afiContract]] += _shares; //in AFi Token
    totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]] += _shares;

    updateLockedTokensInVault(afiContract, _shares, false, true, false, 0);
    emit WithdrawQueue(msg.sender, _shares, oToken, batchWithdrawCounter[afiContract]);
  }

  function updateLockedTokensInVault(
    address afiContract,
    uint256 _shares,
    bool status,
    bool _queue,
    bool _unqueue,
    uint256 newNAV
  ) internal {
    IAFi(afiContract).updateLockedTokens(
      msg.sender,
      _shares,
      status,
      _queue,
      _unqueue,
      newNAV
    );
  }

  /**
   * @notice Retrieves the queued shares for a user.
   * @param user The address of the user.
   * @param afiContract The address of the AFi contract.
   * @param oToken The address of the output token.
   * @return The number of queued shares for the user.
   */
  function getUserQueuedShares(
    address user,
    address afiContract,
    address oToken,
    uint256 bCounter
  ) external view returns (uint256) {
    return userOtokenLiability[user].queuedShares[afiContract][oToken][bCounter];
  }

  function getUserQueuedNAV(
    address user,
    address afiContract,
    address oToken,
    uint256 bCounter
  ) external view returns (uint256) {
    return userQueuedNAV[user].queuedNAV[afiContract][oToken][bCounter];
  }

  function getTotalShares(
    address aFicontract,
    address tok,
    uint256 batchWithCounter
  ) internal returns (uint256) {
    return totalShares[aFicontract][tok][batchWithCounter];
  }

  /**
   * @notice Removes queued withdrawal for a users.
   * @param afiContract The address of the AFi contract.
   * @param oToken The address of the output token.
   */
  function unqueueWithdraw(address afiContract, address oToken) external nonReentrant {
    checkStatus(!(queuePausedStatus[afiContract]));

    uint256 userShares = userOtokenLiability[msg.sender].queuedShares[afiContract][
      oToken
    ][batchWithdrawCounter[afiContract]];

    require(userShares > 0, "Zero Queued");

    totalShares[afiContract][oToken][batchWithdrawCounter[afiContract]] -= userShares; //in AFi Token
    deleteUserOTokenLiability(afiContract, oToken, batchWithdrawCounter[afiContract]);
    totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]] -= userShares;

    uint256 qQuant = userShares;
    uint256 userQNAV = userQueuedNAV[msg.sender].queuedNAV[afiContract][oToken][batchWithdrawCounter[afiContract]];
    delete userQueuedNAV[msg.sender].queuedNAV[afiContract][oToken][batchWithdrawCounter[afiContract]];
    
    uint256 NAVToUpdate = ((userQNAV* qQuant) +
      IAFi(afiContract).depositUserNav(msg.sender) * IERC20(afiContract).balanceOf(msg.sender)) /
      ((qQuant) + IERC20(afiContract).balanceOf(msg.sender));

    updateLockedTokensInVault(afiContract, userShares, false, false, true, NAVToUpdate);
    emit WithdrawDeQueue(msg.sender, userShares, batchWithdrawCounter[afiContract]);
  }

  function deleteUserOTokenLiability(
    address afiContract,
    address _oToken,
    uint256 bCounter
  ) internal {
    delete userOtokenLiability[msg.sender].queuedShares[afiContract][_oToken][bCounter];
  }

  // call updateTVL before this function
  /**
   * @notice Performs unstaking for queued withdrawals.
   * @param afiContract The address of the AFi contract.
   * @param oToken The address of the output token.
   * @param deadline The deadline for the transaction.
   * @param minimumReturnAmount An array of minimum return amounts.
   * @param minOutForiToken An array of minimum output amounts for iToken.
   */
  function unstakeForQueuedWithdrawals(
    address afiContract,
    address oToken,
    uint256 deadline,
    uint[] memory minimumReturnAmount,
    uint256[] memory minOutForiToken,
    bool _updateTVL
  ) external {
    addressEqual(msg.sender, unstakingController[afiContract]);
    checkStatus(queuePausedStatus[afiContract]);
    checkStatus(IAFi(afiContract).isOTokenWhitelisted(oToken));

    require(
      !IAFiManager(afiManager).isQueueWithdrawUnstakingPaused(afiContract),
      "Call CS first"
    );
    IAFi(afiContract).checkTVL(_updateTVL);
    
    uint256 pool;
    uint256 _totalSupply;
    (token, uTokens, pool, _totalSupply) = IAFi(afiContract).setUnstakeData(
      totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]]
    );
    uint toSwap;
    if (totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]] > 0) {
      toSwap =
        (pool * (totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]])) /
        (_totalSupply);
      toSwap = aFiStorage.swapForOtherProduct(
        afiContract,
        toSwap,
        oToken,
        deadline,
        minimumReturnAmount,
        uTokens
      );
    }

    swapAndTransfer(afiContract, oToken, toSwap, minOutForiToken, deadline);
    delete totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]];
    batchWithdrawCounter[afiContract]++;
  }

  function swapAndTransfer(
    address afiContract,
    address oToken,
    uint256 toSwap,
    uint256[] memory minOutForiToken,
    uint256 deadline
  ) internal {
    uint256 depositTokensToSwap;
    uint256 toDeduct;
    for (uint i; i < token.length; i++) {
      if (
        token[i] != oToken &&
        getTotalShares(afiContract, token[i], batchWithdrawCounter[afiContract]) > 0
      ) {
        depositTokensToSwap =
          (toSwap *
            (
              getTotalShares(afiContract, token[i], batchWithdrawCounter[afiContract])
            )) /
          (totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]]);
        if (depositTokensToSwap > 0) {
          toDeduct += depositTokensToSwap;
          depositTokensToSwap = doSwap(
            afiContract,
            oToken,
            token[i],
            depositTokensToSwap,
            deadline,
            WETH,
            minOutForiToken[i]
          );
        }
        if (IERC20(token[i]).balanceOf(afiContract) > 0) {
          IERC20(token[i]).safeTransferFrom(
            afiContract,
            address(this),
            depositTokensToSwap
          );
        }
        outputTokenUnits[afiContract][token[i]][
          batchWithdrawCounter[afiContract]
        ] = depositTokensToSwap;
      }
    }

    for (uint j; j < token.length; j++) {
      if (
        token[j] == oToken &&
        totalShares[afiContract][token[j]][batchWithdrawCounter[afiContract]] > 0
      ) {
        depositTokensToSwap = toSwap - toDeduct;
        IERC20(token[j]).safeTransferFrom(
          afiContract,
          address(this),
          depositTokensToSwap
        );
        outputTokenUnits[afiContract][oToken][
          batchWithdrawCounter[afiContract]
        ] = depositTokensToSwap;
        break;
      }
    }
  }

  function doSwap(
    address afiContract,
    address tokenIn,
    address tokenOut,
    uint amt,
    uint deadline,
    address middleTok,
    uint256 minOut
  ) internal returns (uint256) {
    return IAFi(afiContract).swap(tokenIn, tokenOut, amt, deadline, middleTok, minOut);
  }

  /**
   * @notice Redeems tokens for a user based on their queued shares and batch withdrawal index.
   * @param aFiContract The address of the AFi contract.
   * @param _iTokens An array of token addresses to redeem.
   * @param batchWithdrawIndex The batch withdrawal index.
   */
  function redeem(
    IAFi aFiContract,
    address[] memory _iTokens,
    uint256 batchWithdrawIndex
  ) external {
    require(batchWithdrawIndex < batchWithdrawCounter[address(aFiContract)], "AO01");
    uint redemptionValue;
    uint256 userDepositedAFiInOToken;
    uint256 userShares;
    uint256 userDepositNav; //Calculation for the deposit token value
    for (uint i = 0; i < _iTokens.length; i++) {
      userShares = userOtokenLiability[msg.sender].queuedShares[address(aFiContract)][
        _iTokens[i]
      ][batchWithdrawIndex];
      userDepositNav = userQueuedNAV[msg.sender].queuedNAV[address(aFiContract)][_iTokens[i]][batchWithdrawIndex];
      if (userShares > 0) {
        redemptionValue = ((userShares *
          (outputTokenUnits[address(aFiContract)][_iTokens[i]][batchWithdrawIndex])) /
          (totalShares[address(aFiContract)][_iTokens[i]][batchWithdrawIndex]));

        (uint256 price, uint256 multiplier) = getPriceInUSDC(_iTokens[i]);
        uint8 decimals = 18 - IERC20(_iTokens[i]).decimals();
        userDepositedAFiInOToken =
          (userDepositNav * (userShares) * (multiplier)) /
          (price * (10 ** decimals) * 10000);

        if (redemptionValue > userDepositedAFiInOToken) {
          teamWalletsProfit[address(aFiContract)][_iTokens[i]] +=
            ((redemptionValue - userDepositedAFiInOToken) * (totalProfit)) /
            (100);
          redemptionValue -=
            ((redemptionValue - userDepositedAFiInOToken) * (totalProfit)) /
            (100);
        }
        deleteUserOTokenLiability(
          address(aFiContract),
          _iTokens[i],
          batchWithdrawIndex
        );
        IERC20(_iTokens[i]).safeTransfer(msg.sender, redemptionValue);
      }
    }
  }

  /**
   * @notice Returns the Swap Period for a specific aFi contract.
   * @param afiContract Address of the aFi contract.
   * @return uint256 Swap Period in seconds.
   */
  function getSwapPeriod(address afiContract) external view returns (uint) {
    return swapPeriod[afiContract];
  }

  /**
   * @notice Updates the Swap Period for a specific aFi contract.
   * @dev Only the contract owner can call this function.
   * @param afiContract Address of the aFi contract.
   * @param _newSwapPeiod New Swap Period in seconds.
   */
  function updateSwapPeriod(
    address afiContract,
    uint _newSwapPeiod
  ) external onlyOwner {
    swapPeriod[afiContract] = _newSwapPeiod;
  }

  /**
   * @notice Returns the timestamp of the last cumulative swap execution.
   * @param afiContract Address of the aFi contract.
   * @return uint256 Timestamp of the last cumulative swap.
   */
  function getLastSwapTime(address afiContract) external view returns (uint256) {
    return lastSwapTime[afiContract];
  }

  /**
   * @notice Sets the cumulative swap fee upper limit.
   * @dev Only the contract owner can call this function.
   * @param _csFeeUpperLimit New cumulative swap fee maximum limit.
   */
  function setcsFeeUpperLimit(uint256 _csFeeUpperLimit) external onlyOwner {
    csFeeUpperLimit = _csFeeUpperLimit;
  }

  function getFeeDetails() external view returns (uint256, uint256) {
    return (csFee, csFeeUpperLimit);
  }

  /**
   * @notice Sets the cumulative swap fee.
   * @dev Only the contract owner can call this function.
   * @param _csFee New cumulative swap fee.
   */
  function setcsFee(uint256 _csFee) external onlyOwner {
    require(_csFee <= csFeeUpperLimit, "AFO111");
    csFee = _csFee;
  }

  /**
   * @notice To get the number of USDC tokens for aFi vault.
   * @param tokenIn Address of underlying token from set.
   * @param amountIn Amount of underlying token
   * @param tokenOut Address of the underlying token for aFi contract(USDC).
   */
  function estimateAmountOut(
    address tokenIn,
    uint128 amountIn,
    address tokenOut
  ) public view returns (uint amountOut) {
    address _pool = IUniswapV3Factory(UNISWAP_FACTORY).getPool(
      tokenOut,
      tokenIn,
      _fee[tokenIn][tokenOut]
    );
    addressZero(_pool);
    amountOut = getAmountOutMin(tokenIn, amountIn, tokenOut, _pool);
  }

  function estimateAmountOutMin(
    address tokenIn,
    uint128 amountIn,
    address tokenOut,
    address poolToConsider
  ) public view returns (uint amountOut) {
    addressZero(poolToConsider);
    amountOut = getAmountOutMin(tokenIn, amountIn, tokenOut, poolToConsider);
  }

  function getAmountOutMin(
    address tokenIn,
    uint128 amountIn,
    address tokenOut,
    address poolToConsider
  ) internal view returns (uint amountOut) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = secondsAgo;
    secondsAgos[1] = 0;

    // int56 since tick * time = int24 * uint32
    // 56 = 24 + 32
    (int56[] memory tickCumulatives, ) = IUniswapV3Pool(poolToConsider).observe(
      secondsAgos
    );

    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

    // int56 / uint32 = int24
    // int24 tick = int24(tickCumulativesDelta / secondsAgo);
    int24 tick = int24(tickCumulativesDelta / int56(int32(secondsAgo)));
    // Always round to negative infinity
    /*
      int doesn't round down when it is negative

      int56 a = -3
      -3 / 10 = -3.3333... so round down to -4
      but we get
      a / 10 = -3

      so if tickCumulativeDelta < 0 and division has remainder, then round
      down
      */
    if (
      tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(int32(secondsAgo)) != 0)
    ) {
      tick--;
    }

    amountOut = OracleLibrary.getQuoteAtTick(tick, amountIn, tokenIn, tokenOut);
  }

  /**
   * @notice Increases the observation cardinality for a Uniswap V3 pool.
   * @dev This function is used to adjust the observation cardinality for improved price accuracy.
   * @param _pool Address of the Uniswap V3 pool.
   * @param observationCardinalityNext New observation cardinality to set.
   */
  function increaseObservation(
    address _pool,
    uint16 observationCardinalityNext
  ) external {
    IUniswapV3Pool(_pool).increaseObservationCardinalityNext(
      observationCardinalityNext
    );
  }

  /**
   * @notice Updates the time interval in seconds for retrieving historical prices.
   * @dev Only the contract owner can call this function.
   * @param sec New time interval in seconds.
   */
  function updateSecAgo(uint32 sec) external onlyOwner {
    secondsAgo = sec;
  }

  function getSecAgo() external view returns (uint256) {
    return secondsAgo;
  }

  /**
   * @notice Updates the global fees for Uniswap V3 pool operations.
   * @dev Only the contract owner can call this function.
   * @param fees New fee value to set for the token pair.
   */
  function updateGlobalFees(
    address[] memory tokenA,
    address[] memory tokenB,
    uint24[] memory fees
  ) external onlyOwner {
    for (uint i; i < fees.length; i++) {
      _fee[tokenA[i]][tokenB[i]] = fees[i];
    }
  }

  /**
   * @notice Initializes the stale price delay for multiple underlying tokens.
   * @dev Only the contract owner can call this function.
   * @param underlyingTokens Array of underlying tokens.
   * @param _stalePriceDelay Array of stale price delays corresponding to each underlying token.
   */
  function intializeStalePriceDelay(
    address[] memory underlyingTokens,
    uint256[] memory _stalePriceDelay
  ) external {
    require(
      msg.sender == owner() ||
        msg.sender == IAFiManager(afiManager).rebalanceController(),
      "NA"
    );
    require(underlyingTokens.length == _stalePriceDelay.length, "AFO011");
    for (uint i = 0; i < underlyingTokens.length; i++) {
      setSPDelay(underlyingTokens[i], _stalePriceDelay[i]);
    }
  }

  /**
   * @notice Sets the stale price delay for a specific underlying token.
   * @dev Only the contract owner can call this function, and the current delay must be greater than 1 hour.
   * @param uToken Address of the underlying token.
   * @param _stalePriceDelay New stale price delay to set.
   */
  function setStalePriceDelay(
    address uToken,
    uint256 _stalePriceDelay
  ) external onlyOwner {
    setSPDelay(uToken, _stalePriceDelay);
  }

  function setSPDelay(address uToken, uint256 _stalePriceDelay) internal {
    require(_stalePriceDelay > stalePricewindowLimit, "AFO01");
    stalePriceDelay[uToken] = _stalePriceDelay;
  }

  function setstalepriceWindowLimit(uint256 _stalePWindow) external onlyOwner {
    stalePricewindowLimit = _stalePWindow;
  }

  function getstalepriceWindowLimit() external view returns (uint256) {
    return stalePricewindowLimit;
  }

  /**
   * @notice Gets the stale price delay for a specific underlying token.
   * @param uToken Address of the underlying token.
   * @return The stale price delay for the specified underlying token.
   */
  function getStalePriceDelay(address uToken) external view returns (uint256) {
    return stalePriceDelay[uToken];
  }

  /**
   * @notice Gets the price and decimals of a specified token from a price feed.
   * @param uToken Address of the underlying token.
   * @param feed Address of the price feed.
   * @return The price and decimals of the specified token.
   */
  function getPriceAndDecimals(
    address uToken,
    address feed
  ) public view returns (int256, uint8) {
    (, int256 inPrice, , uint256 updatedAt, ) = AggregatorV3Interface(feed)
      .latestRoundData();

    address currentPhaseAggregator = AggregatorV3Interface(feed).aggregator();

    uint256 minPrice = AggregatorV3Interface(currentPhaseAggregator).minAnswer();

    uint256 maxPrice = AggregatorV3Interface(currentPhaseAggregator).maxAnswer();

    if (uint(inPrice) >= maxPrice || uint(inPrice) <= minPrice) revert("AFOOO");

    uint8 decimals = AggregatorV3Interface(feed).decimals();
    greaterComparison(updatedAt, block.timestamp - stalePriceDelay[uToken]);
    greaterComparison(uint(inPrice), 0);
    return (inPrice, decimals);
  }

  function getPriceOracleRebal(address tok) internal view returns (address) {
    return IPassiveRebal(rebal).getPriceOracle(tok);
  }

  /**
   * @notice Checks if the given token is USDC and retrieves its price and multiplier.
   * @param tok Address of the token to check price .
   * @return The token's price and multiplier.
   */
  function getPriceInUSDC(address tok) public view returns (uint256, uint256) {
    uint256 multiplier = 1e6;
    uint256 price;
    // Transfer Aarna Token to investor
    if (tok != USDC) {
      address oracle = getPriceOracleRebal(tok);
      if (oracle != address(0)) {
        (int256 tokPrice, ) = getPriceAndDecimals(tok, oracle);
        (int256 usdcPrice, ) = getPriceAndDecimals(USDC, USDC_ORACLE);
        price = ((SafeCast.toUint256(tokPrice) * (10 ** 6)) /
          SafeCast.toUint256((usdcPrice)));
      } else {
        uint256 uTokensDecimal = IERC20(tok).decimals();
        uint256 amountIn = 10 ** uTokensDecimal;
        price = getMinimumAmountOut(tok, amountIn, USDC, address(0));
      }
    } else {
      price = 1;
      multiplier = 1;
    }
    return (price, multiplier);
  }

  function updateRebalContract(address _rebal) external onlyOwner {
    addressZero(_rebal);
    rebal = _rebal;
  }

  function getUniPool(address tok, address poolToken) internal view returns (address) {
    return IPassiveRebal(rebal).getPool(tok, poolToken);
  }

  function getMinimumAmountOut(
    address _tokenIn,
    uint256 _amountIn,
    address _tokenOut,
    address _uniPool
  ) internal view returns (uint256 amountOut) {
    address uniPool;

    if (_tokenIn == (WETH) || _tokenOut == (WETH)) {
      amountOut = estimateAmountOut(_tokenIn, uint128(_amountIn), _tokenOut);
    } else if (
      _tokenIn == underlyingUniPoolToken[_tokenIn] ||
      _tokenOut == underlyingUniPoolToken[_tokenIn]
    ) {
      uniPool = getUniPool(_tokenIn, underlyingUniPoolToken[_tokenIn]);
      if (_uniPool != address(0)) {
        uniPool = _uniPool;
      }
      amountOut = estimateAmounts(
        _tokenIn,
        _amountIn,
        underlyingUniPoolToken[_tokenIn],
        uniPool
      );
    } else {
      uniPool = getUniPool(_tokenIn, underlyingUniPoolToken[_tokenIn]);
      address unipoolOut = getUniPool(_tokenOut, underlyingUniPoolToken[_tokenIn]);

      amountOut = estimateAmounts(
        _tokenIn,
        _amountIn,
        underlyingUniPoolToken[_tokenIn],
        uniPool
      );
      amountOut = estimateAmounts(
        underlyingUniPoolToken[_tokenIn],
        amountOut,
        _tokenOut,
        unipoolOut
      );
    }
  }

  function estimateAmounts(
    address intok,
    uint256 amt,
    address outTok,
    address uniPool
  ) internal view returns (uint256) {
    uint256 _amountOut = estimateAmountOutMin(intok, uint128(amt), outTok, uniPool);
    return _amountOut;
  }

  /**
   * @notice Updates the profit share parameters.
   * @dev Only the contract owner can call this function, and the contract must be unpaused.
   * @param _totalProfit Total profit percentage (<= 10).
   * @param _daoProfit DAO profit percentage (< _totalProfit).
   */
  function updateProfitShare(
    uint _totalProfit,
    uint _daoProfit
  ) external onlyOwner contractUnpaused {
    require(_daoProfit <= _totalProfit && _totalProfit <= 10, "AM02");
    daoProfit = _daoProfit;
    totalProfit = _totalProfit;
    emit ProfitShareUpdated(daoProfit, totalProfit); // Emit relevant event
  }

  function teamProfitshares(
    address _aFiStorage,
    address aFiContract,
    uint profitShare
  ) internal view returns (uint teamProfitShare) {
    uint totalActive = IAFiStorage(_aFiStorage).getTotalActiveWallets(aFiContract);
    if (totalActive > 1) {
      teamProfitShare =
        (profitShare * (totalProfit - daoProfit)) /
        ((totalActive - 1) * (totalProfit));
    }
  }

  /**
   * @notice Distributes profit shares among team wallets for aFiContract.
   * @param aFiContract The address of the AFi contract.
   * @param _aFiStorage The address of the AFiStorage contract.
   * @param iToken An array of iToken addresses.
   * @return totalProfitShare The total profit share distributed.
   */
  function unstakingProfitDistribution(
    address aFiContract,
    address _aFiStorage,
    address[] memory iToken
  ) external onlyOwner returns (uint totalProfitShare) {
    // Investor has made a profit, let us distribute the profit share amongst team wallet
    address[] memory _teamWallets = IAFiStorage(_aFiStorage).getTeamWalletsOfAFi(
      aFiContract
    );
    uint256 teamProfitShare;
    uint256 profitShare;
    // Alpha Creator gets 4% of gain
    for (uint j; j < iToken.length; j++) {
      profitShare = teamWalletsProfit[aFiContract][iToken[j]];
      if (profitShare > 0) {
        teamProfitShare = teamProfitshares(_aFiStorage, aFiContract, profitShare);
        {
          uint256 daoProfitShare;
          bool isActive;
          for (uint i = 0; i < _teamWallets.length; i++) {
            (isActive, ) = IAFiStorage(_aFiStorage).getTeamWalletDetails(
              aFiContract,
              _teamWallets[i]
            );
            if (isActive) {
              if (i == 0) {
                // /**
                //   Always at i==0 address must be of Aarna Dao
                //   Aarna DAO gets 6% of gain
                // */
                daoProfitShare = (profitShare * (daoProfit)) / (totalProfit);
                profitShare = daoProfitShare;
              } else {
                profitShare = teamProfitShare;
              }

              totalProfitShare = totalProfitShare + (profitShare);

              IERC20(iToken[j]).safeTransfer(_teamWallets[i], profitShare);

              emit ProfitShareDistributed(aFiContract, _teamWallets[i], profitShare);
            }
          }
        }
      }
      teamWalletsProfit[aFiContract][iToken[j]] = 0;
    }
  }

  function getAFiContracts() external view returns (IAFiStorage, address, address) {
    return (aFiStorage, rebal, afiManager);
  }

  function addressEqual(address add1, address add2) internal pure {
    require(add1 == add2, "AB30");
  }

  /**
   * @notice Pauses / unpause deposits in the contract.
   * @dev Requirements: Can only be invoked by the Owner wallet.
   */
  function pauseUnpauseQueue(address afiContract, bool status) external {
    addressEqual(msg.sender, cumulativeSwapControllers[afiContract]);
    queuePausedStatus[afiContract]= status;
  }
}
