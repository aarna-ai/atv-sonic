// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IUniswapV3Factory.sol";
import "./IAFi.sol";
import {SafeCast} from "./SafeCast.sol";
import {SafeERC20} from "./SafeERC20.sol";
import {OwnableDelayModule} from "./OwnableDelayModule.sol";
import {AggregatorV3Interface} from "./AggregatorV3Interface.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import {ISwapRouter} from "./ISwapRouter.sol";
import "./IPassiveRebal.sol";
import "./ArrayUtils.sol";
struct RewardOwed {
  address token;
  uint owed;
}

interface IRewardSource {
    function redeemRewards(address user) external;
    function userReward(address user, address token) external view returns (uint256);
    function getRewardTokens() external view returns (address[] memory);
}


interface IAaveDistributor {
    function claim(
        address user,
        address token,
        uint256 amount,
        bytes32[] calldata proof
    ) external;
}

contract AtvOracle is ReentrancyGuard, OwnableDelayModule {
  using SafeCast for uint256;
  using SafeERC20 for IERC20;
  using ArrayUtils for address[];


  uint256 internal txFee = 5e20;
  uint256 internal txFeeUpperLimit = 5e21;

  address internal rebal;
  uint internal daoProfit = 6;
  uint internal totalProfit = 10;
  bool public paused;

  address[] internal token;
  address[] internal uTokens;

  address internal afiManager;
  IAFiStorage internal aFiStorage;

  uint256 tempVar;

  mapping(address => address) internal cumulativeSwapControllers;
  mapping(address => address) internal unstakingController;
  mapping(address => bool) public lockedInQueueWithdraw;
  mapping(address => WithdrawQueueDetails) internal userOtokenLiability;
  mapping(address => WithdrawQueueNAVDetail) internal userQueuedNAV;
  mapping(address => uint256) internal lastSwapTime;
  mapping(address => uint) internal swapPeriod;
  mapping(address => mapping(address => mapping(uint => uint))) public totalShares;
  mapping(address => mapping(address => mapping(uint => uint))) public outputTokenUnits;
  mapping(address => uint256) public batchWithdrawCounter;
  mapping(address => mapping(uint => uint)) public totalQueuedShares;
  mapping(address => mapping(address => uint)) internal teamWalletsProfit;
  mapping(address => bool) public queuePausedStatus;

  address private constant WETH = 0x50c42dEAcD8Fc9773493ED674b675bE577f2634b;
  address private constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
  address private constant DAI_ORACLE = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
  
  IAaveDistributor internal constant MERKLE_DISTRIBUTOR = IAaveDistributor(0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae);         
   // Storage
   mapping(address => mapping(address => address)) public pendleMarketPalace;

  struct TokenInfo {
    address[] tokens;
    address[] uTokens;
    uint256[] uTokenProportions;
    uint256[] defaultProportion;
  }

  struct UnstakeData {
    address[] iTokens;
    address oToken;
    uint256 deadline;
    uint[] minimumReturnAmount;
    uint256[] minOutForiToken;
    uint256 unstakingFees;
  }

  struct WithdrawQueueDetails {
    mapping(address => mapping(address => mapping(uint256 => uint256))) queuedShares;
  }

  struct WithdrawQueueNAVDetail {
    mapping(address => mapping(address => mapping(uint256 => uint256))) queuedNAV;
  }

  event ProfitShareUpdated(uint daoProfit, uint totalProfit);
  event ProfitShareDistributed(address indexed aFiContract, address indexed teamWallet, uint256 amount);
  event WithdrawQueue(address indexed user, uint256 shares, address indexed oToken, uint256 withdrawCounter);
  event WithdrawDeQueue(address indexed user, uint256 shares, uint256 withdrawCounter);
  event RewardsAccrued(address indexed atvContract, address indexed token, address indexed market);
  event SwapExecuted(address indexed atvContract, address indexed rewardToken, uint256 amountIn, uint256 amountOut);
  event MarketSet(address indexed atvContract, address indexed token, address marketAddress);

  /**
   * @param account Address of the account that paused the contract.
   */
  event Paused(address account);
  /**
   * @param account Address of the account that unpaused the contract.
   */
  event Unpaused(address account);

  /**
   * @notice To initialize/deploy the AFIOracle contract.
   * @param passiveRebalContract Address of AFiPassiveRebalStrategies contract.
   */
  constructor(address passiveRebalContract) {
    addressZero(passiveRebalContract);
    rebal = passiveRebalContract;
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

  function greaterEqualComparison(uint256 valA, uint256 valB) internal pure {
    require(valA >= valB, "AO24");
  }

  function greaterComparison(uint256 valA, uint256 valB) internal pure {
    require(valA > valB, "AO25");
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

  function toggleTheOtoken(address tok, bool status) external onlyOwner{
    lockedInQueueWithdraw[tok] = status;
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
  function cumulativeSwap(IAFi.SwapParameters memory params, uint256 pauseDepositFees, 
    IAFi.SwapDataStructure calldata dexdata, IAFi.AaveRewardData calldata aaveParams,
    bytes calldata _pendleData, uint256 minAmountOut) external {
    require(
      msg.sender == cumulativeSwapControllers[params.afiContract] ||
      msg.sender == afiManager,
      "NA"
    );
    greaterEqualComparison(block.timestamp - lastSwapTime[params.afiContract], swapPeriod[params.afiContract]);
    // Check if deposit is paused
    (bool depositPaused, ) = IAFi(params.afiContract).isPaused();
    checkStatus(depositPaused);

    TokenInfo memory tokenInfo;
    (params.depositTokens, ) = IAFi(params.afiContract).getInputToken();
    params.cSwapCounter = IAFi(params.afiContract).getcSwapCounter();
    tokenInfo.uTokens = IAFi(params.afiContract).getUTokens();
    greaterComparison(tokenInfo.uTokens.length, 0);
    uint256 rewardsFromMerkle = fetchRewards(params, aaveParams);
    uint256 totalProp = getTotalProportion(params.afiContract, tokenInfo.uTokens, calculateAmountToSwap(params.afiContract, params.depositTokens), params.cSwapCounter);
    
    IAFi(params.afiContract).underlyingTokensStaking();

    (tokenInfo.uTokenProportions, tokenInfo.defaultProportion) = IAFi(
      params.afiContract
    ).getProportions();

    performTokenSwaps(params, tokenInfo, totalProp, pauseDepositFees, dexdata, minAmountOut, rewardsFromMerkle);

    uint256 lpOut = aFiStorage.rearrange(
      params.afiContract,
      params.underlyingTokens,
      params.newProviders,
      _pendleData
    );
    
    // Require check to ensure lpOut meets the minimum expected amount
    require(lpOut >= params.lpOut, "lpOut is less than expected");

    untrackedTokenSet(params.afiContract, params.depositTokens, tokenInfo.uTokens, params.cSwapCounter + 1);
    // Update last swap time after all operations are complete
    lastSwapTime[params.afiContract] = block.timestamp;
    IAFi(params.afiContract).pauseUnpauseDeposit(false);
    IAFiManager(afiManager).pauseQueueWithdrawUnstaking(params.afiContract, false);
  }

  /**
    * @notice Function to redeem rewards from a market
    * @param atvContract The AFi contract address
    * @param token The token address to get the corresponding market for
    */
    function accrueRewards(address atvContract, address token) external {
        require(
            msg.sender == cumulativeSwapControllers[atvContract],
            "Not authorized controller"
        );
        address market = pendleMarketPalace[atvContract][token];
        require(market != address(0), "Market not found");
        
        IRewardSource rewardSource = IRewardSource(market);
        
        // Redeem rewards
        rewardSource.redeemRewards(atvContract);
        
        emit RewardsAccrued(atvContract, token, market);
    }

  /**
  * @notice Internal function to validate parameters for swapping rewards
  * @param atvContract The AFi contract address
  * @param market The market address 
  * @param rewardTokensLength The number of reward tokens
  * @param swapData Array of calldata for each swap operation
  * @param minOuts Array of minimum outputs for each swap operation
  */
  function _validateSwapParams(
      address atvContract,
      address market,
      uint256 rewardTokensLength,
      bytes[] calldata swapData,
      uint256[] calldata minOuts
  ) private view {
      require(
          msg.sender == cumulativeSwapControllers[atvContract],
          "Not authorized controller"
      );
      
      require(market != address(0), "Market not found");
      
      require(rewardTokensLength == swapData.length, "Mismatched input arrays");
      require(rewardTokensLength == minOuts.length, "Mismatched minOuts array");
  }

    /**
    * @notice Function to swap accrued reward tokens to stable tokens
    * @param atvContract The AFi contract address
    * @param stableToken The stable token to swap rewards to
    * @param token The source token address to get the market for
    * @param swapData Array of calldata for each swap operation
    * @param minOuts Array of minimum outputs for each swap operation
    */
    function swapRewardsToStable(
        address atvContract,
        address stableToken, 
        address token, 
        bytes[] calldata swapData,
        uint256[] calldata minOuts
    ) external {
        require(
            msg.sender == cumulativeSwapControllers[atvContract],
            "Not authorized controller"
        );

        // Get the market
        address market = pendleMarketPalace[atvContract][token];
        
        // Get reward tokens first
        address[] memory rewardTokens = IRewardSource(market).getRewardTokens();
        
        // Validate parameters
        _validateSwapParams(
            atvContract,
            market,
            rewardTokens.length,
            swapData,
            minOuts
        );
        
        // Record initial balance for comparison later
        uint256 initialBalance = IERC20(stableToken).balanceOf(atvContract);
        
        // Perform swaps
        _executeSwaps(
            atvContract,
            stableToken,
            rewardTokens,
            swapData,
            minOuts
        );

        
        // Verify we received stable tokens
        uint256 finalBalance = IERC20(stableToken).balanceOf(atvContract);
        require(finalBalance > initialBalance, "No stable tokens received");
        uint256 csCounter = IAFi(atvContract).getcSwapCounter();
        aFiStorage.setPreDepositedInputTokenInRebalance(
          atvContract, 
          csCounter, 
          finalBalance - initialBalance, 
          stableToken
        );
        
    }

    
    /**
    * @notice Internal function to execute swaps for each reward token
    */
    function _executeSwaps(
        address atvContract,
        address stableToken,
        address[] memory rewardTokens,
        bytes[] calldata swapData,
        uint256[] calldata minOuts
    ) private {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address rewardToken = rewardTokens[i];
            uint256 rewardAmount = IERC20(rewardToken).balanceOf(atvContract);
    
            if (rewardAmount > 0) {
                // Execute the swap using doSwap function
                // Using default values for deadline and middleToken
                uint256 swapResult = doSwap(
                    atvContract,
                    rewardToken,
                    stableToken,
                    rewardAmount,
                    0, // 30 minutes deadline as default
                    address(0), // No middle token by default
                    minOuts[i],
                    swapData[i]
                );    
                // Check that returned amount meets minimum expected
                require(swapResult >= minOuts[i], "Swap returned less than minimum");
                emit SwapExecuted(atvContract, rewardToken, rewardAmount, swapResult);
            }
        }
    }


    /**
     * @notice Function to set market address for a token in a specific AFi contract
     * @param atvContract The AFi contract address
     * @param token The token address
     * @param market The corresponding market address
     */
    function setMarketForToken(address atvContract, address token, address market) external  {
       require(
            msg.sender == cumulativeSwapControllers[atvContract],
            "Not authorized controller"
        );
        require(atvContract != address(0), "Invalid AFi contract");
        require(token != address(0), "Invalid token");
        require(market != address(0), "Invalid market");
        
        pendleMarketPalace[atvContract][token] = market;
        emit MarketSet(atvContract, token, market);
    }

  function getTotalProportion( address afiContract,
    address[] memory uTokens,
    uint256 toSwap,
    uint256 cSwapCounter) internal returns (uint256 _totalProp) {
    (_totalProp) = IPassiveRebal(rebal).validateAndApplyRebalanceStrategy(afiContract, uTokens, toSwap, cSwapCounter);
  }

  
  function untrackedTokenSetByManager(address afiContract, address[] memory depositTokens, address[] memory uTok, uint256 csCounter) external {
    addressEqual(msg.sender, afiManager);
    untrackedTokenSet(afiContract, depositTokens, uTok, csCounter);
  }

  function untrackedTokenSet(address afiContract, address[] memory depositTokens, address[] memory uTok, uint256 csCounter) internal {
    for (uint256 j = 0; j < depositTokens.length; j++) {
      (, bool isPresent) = uTok.indexOf(depositTokens[j]);

      (uint256 temp) = aFiStorage.getPreSwapDepositsTokens(
        afiContract,
        csCounter,
        depositTokens[j]
      );
      
      uint256 balInContract = balance(depositTokens[j], afiContract);
      uint256 ContractiBal = balInContract - temp;

      if((balInContract > temp) && !isPresent){
        aFiStorage.setPreDepositedInputTokenInRebalance(
          afiContract, 
          csCounter, 
          ContractiBal, 
          depositTokens[j]
        );
      }
    }
  }

  function calculateAmountToSwap(address afiContract, address[] memory _depositTokens) internal view returns(uint256 toSwap){
    for (uint i = 0; i < _depositTokens.length; i++) {
      toSwap += aFiStorage.convertInUSDAndTok(
        _depositTokens[i],
        aFiStorage.getPreSwapDepositsTokens(afiContract, IAFi(afiContract).getcSwapCounter(), _depositTokens[i]),
        false
      );
    }
  }

  function fetchRewards(
    IAFi.SwapParameters memory params,
    IAFi.AaveRewardData calldata aaveParams
  ) internal returns (uint256 totalRewards) {
    uint256 _rewards = 0;
      // Claim Morpho rewards if applicable
      if (aaveParams.rewardTokens.length > 0) {
          _rewards += claimAaveRewardsInSwap(params, aaveParams);
      }
      return _rewards;
  }

  function claimAaveRewardsInSwap(
    IAFi.SwapParameters memory params,
    IAFi.AaveRewardData calldata aaveParams
  ) internal returns (uint256 oTokenFromMorpho) {
    uint256 balToSwap;
    address tok;
    address underlyingToken;
    // Track initial oToken balance
    oTokenFromMorpho = balance(params.oToken, params.afiContract);
    // Iterate over Morpho reward tokens
    for (uint256 i = 0; i < aaveParams.rewardTokens.length; i++) {
        tok = aaveParams.rewardTokens[i];

        IAFi(params.afiContract).claimMerkleRewards(params.afiContract, tok, aaveParams.rewardTokenAmount[i], aaveParams.proofs[i]); 

        uint256 aTokensTokWithdraw = IERC20(tok).balanceOf(params.afiContract);

        underlyingToken = aaveParams.underlyingTokens[i];
        balToSwap = balance(underlyingToken, params.afiContract);

        if(aTokensTokWithdraw > 0 ){
          IAFi(params.afiContract)._withdrawAave(underlyingToken, aTokensTokWithdraw);
        }
      
        // Check if new tokens were received
        if (balance(underlyingToken, params.afiContract) > balToSwap) {
            balToSwap = balance(underlyingToken, params.afiContract) - balToSwap;
            // Swap Morpho reward token to oToken
            doSwap(
              params.afiContract,
              underlyingToken,
              params.oToken,
              balToSwap,
              params._deadline,
              WETH, // Use WETH as intermediate token
              aaveParams.minReturnAmounts[i],
              aaveParams.swapData[i] // Use swap data from MorphoRewardData
            );
        }
    }

    // Calculate total oToken received from Morpho rewards
    oTokenFromMorpho = balance(params.oToken, params.afiContract) - oTokenFromMorpho;
  }

  function performTokenSwaps(
    IAFi.SwapParameters memory params,
    TokenInfo memory tokenInfo,
    uint256 totalProp,
    uint256 _pauseDepositFees,
    IAFi.SwapDataStructure calldata dexdata,
    uint256 minAmountOut, 
    uint256 compRewards
  ) internal {

    uint256 oTokBal = balance(params.oToken, params.afiContract);

    for (uint256 j = 0; j < params.depositTokens.length; j++) {
      (tempVar) = aFiStorage.getPreSwapDepositsTokens(
        params.afiContract,
        params.cSwapCounter,
        params.depositTokens[j]
      );
      if (params.depositTokens[j] != params.oToken && tempVar > 0) {
        doSwap(
          params.afiContract,
          params.depositTokens[j],
          params.oToken,
          tempVar,
          params._deadline,
          WETH,
          params.iMinimumReturnAmount[j],
          dexdata.firstIterationCumulativeSwap[j]
        );
      }
    }

    oTokBal = balance(params.oToken, params.afiContract) - oTokBal;
    greaterEqualComparison(oTokBal, minAmountOut);
    greaterEqualComparison(txFee,  takeFee(params.afiContract, params.oToken, params.cSwapFee, msg.sender));
    greaterEqualComparison(txFee,  takeFee(params.afiContract, params.oToken, _pauseDepositFees, IPassiveRebal(rebal).getPauseDepositController(params.afiContract)));
    swapIntoUnderlying(params, tokenInfo, totalProp, dexdata, (oTokBal+compRewards), _pauseDepositFees);
  }

  function swapIntoUnderlying(
    IAFi.SwapParameters memory params,
    TokenInfo memory tokenInfo,
    uint256 _totalProp,
    IAFi.SwapDataStructure calldata dexdata,
    uint256 oTokenCollected,
    uint256 _pauseDepositFees
  ) internal {
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

    (oTokenCollected) += aFiStorage.getPreSwapDepositsTokens(
      params.afiContract,
      params.cSwapCounter,
      params.oToken
    );

    oTokenCollected = (oTokenCollected) - (params.cSwapFee + _pauseDepositFees);
    if(oTokenCollected > 0) {
      for (uint i = 0; i < tokenInfo.uTokens.length; i++) {
        // Perform swap if conditions are met
        if (tokenProportions[i] >= 1) {
          doSwap(
            params.afiContract,
            params.oToken,
            tokenInfo.uTokens[i],
            (oTokenCollected * tokenProportions[i]) / _totalProp,
            params._deadline,
            address(0),
            params.minimumReturnAmount[i],
            dexdata.secondIterationCumulativeSwap[i]
          );
        }
      }
    }
  }

  function takeFee(
    address afiContract,
    address _inputToken,
    uint256 fee, 
    address reciever
  ) internal returns(uint256 redFee){
    if (fee > 0) {
      (uint256 price, uint256 decimal) = getPriceInUSD(_inputToken);
      uint iTokenDecimal = 18 - getERCDecimal(_inputToken);
      redFee = (((fee) * price * (10 ** iTokenDecimal)) / (10 ** decimal));
      IERC20(_inputToken).safeTransferFrom(
        afiContract,
        reciever,
        fee
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
    checkStatus(!lockedInQueueWithdraw[oToken]);

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
  ) public view returns (uint256) {
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

    greaterComparison(userShares, 0);

    totalShares[afiContract][oToken][batchWithdrawCounter[afiContract]] -= userShares; //in AFi Token
    deleteUserOTokenLiability(afiContract, oToken, batchWithdrawCounter[afiContract]);
    totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]] -= userShares;

    uint256 qQuant = userShares;
    uint256 userQNAV = userQueuedNAV[msg.sender].queuedNAV[afiContract][oToken][batchWithdrawCounter[afiContract]];
    delete userQueuedNAV[msg.sender].queuedNAV[afiContract][oToken][batchWithdrawCounter[afiContract]];
    
    uint256 NAVToUpdate = ((userQNAV* qQuant) +
      IAFi(afiContract).depositUserNav(msg.sender) * balance(afiContract, msg.sender)) /
      ((qQuant) + balance(afiContract, msg.sender));

    updateLockedTokensInVault(afiContract, userShares, false, false, true, NAVToUpdate);
    emit WithdrawDeQueue(msg.sender, userShares, batchWithdrawCounter[afiContract]);
  }

  function balance(address tok, address user) internal view returns (uint) {
    return IERC20(tok).balanceOf(user);
  }

  function deleteUserOTokenLiability(
    address afiContract,
    address _oToken,
    uint256 bCounter
  ) internal {
    delete userOtokenLiability[msg.sender].queuedShares[afiContract][_oToken][bCounter];
  }

  /**
   * @notice Performs unstaking for queued withdrawals.
   * @param afiContract The address of the AFi contract.
   */
  function unstakeForQueuedWithdrawals(
    address afiContract,
    UnstakeData memory _unstakeData,
    bytes[] calldata swapForWithdrawals,
    bytes[] calldata swapData,
    uint256 minAmountOut
  ) external {
    addressEqual(msg.sender, unstakingController[afiContract]);
    checkStatus(queuePausedStatus[afiContract]);
    checkStatus(IAFi(afiContract).isOTokenWhitelisted(_unstakeData.oToken));

    IAFi(afiContract).updateTVL();
    
    uint256 pool;
    uint256 _totalSupply;
    (token, uTokens, pool, _totalSupply) = IAFi(afiContract).setUnstakeData(
      totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]]
    );
    uint toSwap;
      toSwap =
        (pool * (totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]])) /
        (_totalSupply);

    if (totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]] > 0 && !IAFiManager(afiManager).isQueueWithdrawUnstakingPaused(afiContract)) {
      toSwap = aFiStorage.swapForOtherProduct(
        afiContract,
        toSwap,
        _unstakeData.oToken,
        _unstakeData.deadline,
        _unstakeData.minimumReturnAmount,
        uTokens,
        new bytes(0)
      );
    }
    else {
      revert("AFO01: Invalid queued shares or unstaking state");
    } 
    greaterEqualComparison(toSwap, minAmountOut);
    feeDeductAndTokenTransfer( 
      afiContract,
      _unstakeData.oToken,
      _unstakeData.unstakingFees,
      toSwap,
      _unstakeData.minOutForiToken,
      _unstakeData.deadline, 
      swapData
    );

    untrackedTokenSet(afiContract, token, uTokens, IAFi(afiContract).getcSwapCounter());
  }

  function feeDeductAndTokenTransfer(
    address afiContract,
    address oToken,
    uint256 unstakingFees,
    uint256 toSwap,
    uint256[] memory minOutForiToken,
    uint256 deadline,
    bytes[] calldata swapData
    ) internal {

    greaterEqualComparison(txFee, takeFee(afiContract, oToken, unstakingFees, unstakingController[afiContract]));

    swapAndTransfer(afiContract, oToken, (toSwap - unstakingFees), minOutForiToken, deadline, swapData);
    delete totalQueuedShares[afiContract][batchWithdrawCounter[afiContract]];
    batchWithdrawCounter[afiContract]++;
  }

  function swapAndTransfer(
    address afiContract,
    address oToken,
    uint256 toSwap,
    uint256[] memory minOutForiToken,
    uint256 deadline,
    bytes[] calldata swapData
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
            minOutForiToken[i],
            swapData[i]
          );
        }
        if (balance(token[i], afiContract) > 0) {
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
    uint256 minOut,
    bytes calldata swapdata
  ) internal returns (uint256) {
    return IAFi(afiContract).swap(tokenIn, tokenOut, amt, deadline, middleTok, minOut, swapdata);
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
    // greaterComparison(batchWithdrawCounter[address(aFiContract)], batchWithdrawIndex);
    // uint redemptionValue;
    // uint256 userDepositedAFiInOToken;
    // uint256 userShares;
    // uint256 userDepositNav; //Calculation for the deposit token value
    // for (uint i = 0; i < _iTokens.length; i++) {
    //   userShares = userOtokenLiability[msg.sender].queuedShares[address(aFiContract)][
    //     _iTokens[i]
    //   ][batchWithdrawIndex];
    //   userDepositNav = userQueuedNAV[msg.sender].queuedNAV[address(aFiContract)][_iTokens[i]][batchWithdrawIndex];
    //   if (userShares > 0) {
    //     redemptionValue = ((userShares *
    //       (outputTokenUnits[address(aFiContract)][_iTokens[i]][batchWithdrawIndex])) /
    //       (totalShares[address(aFiContract)][_iTokens[i]][batchWithdrawIndex]));

    //     (uint256 price, uint256 multiplier) = getPriceInUSD(_iTokens[i]);
    //     uint8 decimals = 18 - getERCDecimal(_iTokens[i]);
    //     userDepositedAFiInOToken =
    //       (userDepositNav * (userShares) * (10 ** multiplier)) /
    //       (price * (10 ** decimals) * 10000);

    //     if (redemptionValue > userDepositedAFiInOToken) {
    //       uint256 profit = ((redemptionValue - userDepositedAFiInOToken) * (totalProfit)) / (100);
    //       teamWalletsProfit[address(aFiContract)][_iTokens[i]] += profit;
    //       redemptionValue -= profit;
    //     }
    //     deleteUserOTokenLiability(
    //       address(aFiContract),
    //       _iTokens[i],
    //       batchWithdrawIndex
    //     );
    //     IERC20(_iTokens[i]).safeTransfer(msg.sender, redemptionValue);
    //   }
    // }
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

  function getFeeDetails() external view returns (uint256, uint256) {
    return (txFee, txFeeUpperLimit);
  }

  /**
   * @notice Sets the cumulative swap fee.
   * @dev Only the contract owner can call this function.
   * @param _txFee New cumulative swap fee.
   */
  function settxFee(uint256 _txFee) external onlyOwner {
    greaterEqualComparison(txFeeUpperLimit, _txFee);
    txFee = _txFee;
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
    greaterEqualComparison(updatedAt, block.timestamp - IPassiveRebal(rebal).getStalePriceDelay(uToken));
    greaterEqualComparison(uint(inPrice), 0);
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
  function getPriceInUSD(address tok) public view returns (uint256, uint256) {
    // Transfer Aarna Token to investor
    address oracle = getPriceOracleRebal(tok);
    uint256 price;
    uint8 decimals;
    int256 chainlinkPrice;
    if (oracle != address(0) || tok == DAI) {
      (chainlinkPrice, decimals) = getPriceAndDecimals(tok, oracle);
      price = SafeCast.toUint256(chainlinkPrice);
    } else {
      uint256 uTokensDecimal = getERCDecimal(tok);
      uint256 amountIn = 10 ** uTokensDecimal;
      uint256 uniPrice = IPassiveRebal(rebal).getMinimumAmountOut(tok, amountIn, DAI, address(0));
      (chainlinkPrice, decimals) = getPriceAndDecimals(DAI, DAI_ORACLE);
      price = ((SafeCast.toUint256((chainlinkPrice))) * (uniPrice)) / (10 ** 18);
    }
    return (price, decimals);
  }

  function getERCDecimal(address tok) internal view returns(uint8){
    return IERC20(tok).decimals();
  }

  function updateRebalContract(address _rebal) external onlyOwner {
    addressZero(_rebal);
    rebal = _rebal;
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
    greaterEqualComparison(_totalProfit, _daoProfit);
    greaterEqualComparison(10, _totalProfit);
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
    require(add1 == add2, "AFO30");
  }

  /**
   * @notice Pauses / unpause deposits in the contract.
   * @dev Requirements: Can only be invoked by the Owner wallet.
   */
  function pauseUnpauseQueue(address afiContract, bool status) external {
    addressEqual(msg.sender,  unstakingController[afiContract]);
    queuePausedStatus[afiContract]= status;
  }
}
