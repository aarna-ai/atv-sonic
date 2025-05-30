// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "./Interfaces/IAFi.sol";
import "./Interfaces/IAFiStorage.sol";
import "./Interfaces/TransferHelper.sol";
import {OwnableDelayModule} from "./Interfaces/OwnableDelayModule.sol";
import {ReentrancyGuard} from "./Interfaces/ReentrancyGuard.sol";
import "./Libraries/ArrayUtils.sol";
import {SafeERC20} from "./Interfaces/SafeERC20.sol";
import "./Interfaces/IPassiveRebal.sol";
import {IUniswapOracleV3} from "./Interfaces/IUniswapV3.sol";

/**
 * @title AFiManager.
 * @notice Manager conntract for handling rebalancing and adding/updating team wallets in the AFi contracts.
 * @dev Error codes: AFM01: Caller is not MultiSig. AFM02: Cannot be address zero. AFM03: Teamwallet already present. AFM04: Previous and current active status cannot be the same.
 */
contract ParentAFiManager is OwnableDelayModule, ReentrancyGuard {
  using ArrayUtils for uint[];
  using ArrayUtils for address[];
  using SafeERC20 for IERC20;

  address internal rebal;
  uint256 internal preDepositsStablesInUSD;
  mapping(address => bool) public isQueueWithdrawUnstakingPaused;

  uint256 public rebalfee = 500;
  uint256 public rebalFeeUpperLimit = 5000;

  bool internal paused;
  address[] private _uTokensAfterRebalance;
  address[] public tokens;
  uint[] internal defaultProportion;
  address internal afiOracle;
  address internal constant UNISWAP_EXCHANGE = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
  mapping(address => mapping(address => bool)) internal underlyingExists;
  mapping(address => bool) internal isUnderlyingCommon;
  address public rebalanceController;

  struct RebalanceData {
    IAFi aFiContract;
    IAFiStorage _aFiStorage;
    IERC20 depositToken;
    address newUToken;
    address uTokenToRemove;
    uint256 scenario;
    address[] uTokensAfterS1; // uTokens array after scenario 1 rebalancing
    uint256[] uTokenProportions;
    uint256[] defaultProportion;
    uint256 uTokenToRemoveIndex;
  }

  event Rebalance(IAFi indexed _aFiContract, uint8 _scenario);
  event AddTeamWalletInAFi(address indexed aFiContract, address _wallet);
  event WithdrawFromPool(address indexed _aFiContract, address uToken);
  event AFiManagerSwap(IAFi indexed _aFiContract, address _fromToken, address _toToken, uint _amount);
  event SetActiveRebalStatus(address indexed _aFiContract, bool status);
  event RebalanceUnderlyingTokens(
    address indexed aFiContract,
    address _aFiStorage,
    address[] newUnderlyingTokens,
    address stableCoin,
    uint managerFee
  );
  event UTokenProportionUpdated(address indexed aFiContract, uint256[] uTokenProportions);

  /**
   * @param account Address of the account that paused the contract.
   */
  event Paused(address account);
  /**
   * @param account Address of the account that unpaused the contract.
   */
  event Unpaused(address account);

  modifier contractUnpaused() {
    require(!paused, "AM08");
    _;
  }

  modifier contractPaused() {
    require(paused, "AM09");
    _;
  }

  function compareInt(uint256 val1, uint256 val2) internal pure {
    require(val1 == val2, "AM11");
  }

  function compareAddress(address add1, address add2) internal pure {
    require(add1 == add2, "AM002");
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

  function validateGreaterEqual(uint256 val1, uint256 val2) internal pure {
    require(val1 >= val2, "AFS19");
  }

  function addressCheck(address add1, address add2) internal pure {
    require(add1 != add2, "AM04"); //solhint-disable-line reason-string
  }

  /**
   * @notice Returns the pause status of the contract.
   * @return bool pause status of the contract.
   */
  function getPauseStatus() external view returns (bool) {
    return paused;
  }

  function isPresentCheck(bool isPresent) internal pure {
    if (isPresent) revert("AFM03");
  }

  function setRebalanceController(address _rebalanceController) external onlyOwner {
    addressCheck(_rebalanceController, address(0));
    rebalanceController = _rebalanceController;
  }

  /**
   * @notice To add a new team wallet.
   * @dev The wallet must not be address zero. The wallet must not be present.
   * @param _aFiStorage Address of AFiStorage contract.
   * @param aFiContract Address of the AFi contract.
   * @param _wallet Wallet address that has to be added in the `teamWallets` array.
   */
  function addTeamWalletInAFi(
    IAFiStorage _aFiStorage,
    address aFiContract,
    address _wallet
  ) external nonReentrant onlyOwner contractUnpaused {
    require(_wallet != address(0), "AFM02");
    (, bool isPresent) = _aFiStorage.getTeamWalletDetails(aFiContract, _wallet);
    isPresentCheck(isPresent);
    _aFiStorage.addTeamWallet(aFiContract, _wallet, true, true);
    emit AddTeamWalletInAFi(aFiContract, _wallet);
  }

  /**
   * @notice To rebalance the underlying tokens.
   */
  function rebalance(
    bytes memory data,
    RebalanceData memory rebalData,
    uint deadline,
    uint[] memory minimumReturnAmount,
    uint stableAmountOut, // length of array should be >1 in second scenario
    uint256 _rebalFeeToDeduct
  ) external nonReentrant contractUnpaused {
    compareAddress(msg.sender, rebalanceController);
    require(rebalData.scenario < 3 && rebalData.scenario > 0, "AM05");
    require(rebalData.uTokenToRemove != address(rebalData.depositToken), "AM010");
    require(
      rebalData._aFiStorage.isAFiActiveRebalanced(address(rebalData.aFiContract)),
      "AM00"
    );
    (, rebal, ) = IAFi(rebalData.aFiContract).getTVLandRebalContractandType();
    address[] memory uTokens = IAFi(rebalData.aFiContract).getUTokens();

    // Validate uTokenToRemove and uTokenToRemoveIndex
    require(uTokens[rebalData.uTokenToRemoveIndex] == rebalData.uTokenToRemove, "AM12");

    if (rebalData.scenario == 2) {
      (, bool present) = ArrayUtils.indexOf(uTokens, rebalData.newUToken);
      isPresentCheck(present);
      validateNewUTokenData(data, rebalData.newUToken);
    }else {
      require(uTokens.length > 1, "AM032");
    }

    uint totalReturnedDepositToken;
    {
      totalReturnedDepositToken = rebalData.depositToken.balanceOf(
        address(rebalData.aFiContract)
      );
      rebalData._aFiStorage._withdrawAll(
        address(rebalData.aFiContract),
        rebalData.uTokenToRemove
      );

      convertToStable(
        rebalData.aFiContract,
        rebalData.uTokenToRemove,
        address(rebalData.depositToken),
        deadline,
        stableAmountOut
      );

      checkRebalFeesandDeduct(
        _rebalFeeToDeduct,
        address(rebalData.depositToken),
        rebalData.aFiContract
      );

      totalReturnedDepositToken =
        rebalData.depositToken.balanceOf(address(rebalData.aFiContract)) -
        totalReturnedDepositToken;
    }
    (address[] memory inputStables, address[] memory nonOverlappingITokens) = IAFi(
      rebalData.aFiContract
    ).getInputToken();

    updateInputTokenData(
      address(rebalData.aFiContract),
      address(rebalData._aFiStorage),
      rebalData.uTokenToRemove,
      inputStables,
      nonOverlappingITokens
    );
    
    defaultProportion = rebalData.defaultProportion;
    (, rebalData.defaultProportion) = rebalData.aFiContract.getProportions();

    bool isNewTokenPresent;
    {
      if (rebalData.scenario == 1) {
        if (
          IPassiveRebal(rebal).getRebalStrategyNumber(address(rebalData.aFiContract)) ==
          1
        ) {
          (rebalData.uTokenProportions, ) = updateProportion(
            address(rebalData.aFiContract),
            rebalData._aFiStorage,
            uTokens
          );
        } else {
          rebalData.uTokenProportions = rebalData.defaultProportion;
        }
        // investInOtherUTokens
        rebalData.uTokensAfterS1 = scenario1Investments(
          rebalData,
          uTokens,
          totalReturnedDepositToken,
          deadline,
          minimumReturnAmount
        );

        rebalData.aFiContract.updateuTokAndProp(rebalData.uTokensAfterS1);
      } else {
        (inputStables, nonOverlappingITokens) = IAFi(rebalData.aFiContract)
          .getInputToken();

        rebalData.aFiContract.updatePoolData(data);
        (, isNewTokenPresent) = ArrayUtils.indexOf(
          nonOverlappingITokens,
          rebalData.newUToken
        );

        if (isNewTokenPresent) {
          nonOverlappingITokens = removeFromNonOverlappingITokens(
            nonOverlappingITokens,
            rebalData.newUToken
          );
        }
        // Update nonOverlappingITokens in AFiBase
        IAFi(rebalData.aFiContract).updateInputTokens(nonOverlappingITokens);

        uTokens = scenario2Investments(
          rebalData.depositToken,
          rebalData.uTokenToRemoveIndex,
          rebalData.aFiContract,
          uTokens,
          rebalData.newUToken,
          totalReturnedDepositToken,
          deadline,
          minimumReturnAmount
        );

        (rebalData.uTokenProportions, ) = updateProportion(
          address(rebalData.aFiContract),
          rebalData._aFiStorage,
          uTokens
        );
        updateAFiData(
          rebalData.aFiContract,
          uTokens,
          defaultProportion,
          rebalData.uTokenProportions
        );
      }
    }
  }

  function updateAFiData(
    IAFi afiContract,
    address[] memory uTokens,
    uint256[] memory dp,
    uint256[] memory cp
  ) internal {
    afiContract.updateDp(dp, cp);
    afiContract.updateuTokAndProp(uTokens);
  }

  function updateInputTokenData(
    address aFiContract,
    address _aFiStorage,
    address uTokenToRemove,
    address[] memory inputStables,
    address[] memory nonOverlappingITokens
  ) internal {
    // Check if uTokenToRemove exists in inputStables
    (, bool isInputStable) = ArrayUtils.indexOf(inputStables, uTokenToRemove);

    if (isInputStable) {
      // Clear preDepositedInputTokens and add uTokenToRemove to nonOverlappingITokens
      IAFiStorage(_aFiStorage).deletePreDepositedInputToken(
        aFiContract,
        uTokenToRemove,
        IAFi(aFiContract).getcSwapCounter()
      );
      // Add uTokenToRemove to nonOverlappingITokens if not already present
      nonOverlappingITokens = addToNonOverlappingITokens(
        nonOverlappingITokens,
        uTokenToRemove
      );
      // Update nonOverlappingITokens in AFiBase
      IAFi(aFiContract).updateInputTokens(nonOverlappingITokens);
    }
  }

  function addToNonOverlappingITokens(
    address[] memory _nonOverlappingITokens,
    address token
  ) internal pure returns (address[] memory) {
    (, bool isPresent) = ArrayUtils.indexOf(_nonOverlappingITokens, token);
    if (!isPresent) {
      address[] memory newTokens = new address[](_nonOverlappingITokens.length + 1);
      for (uint i = 0; i < _nonOverlappingITokens.length; i++) {
        newTokens[i] = _nonOverlappingITokens[i];
      }
      newTokens[_nonOverlappingITokens.length] = token;
      return newTokens;
    }
    return _nonOverlappingITokens;
  }

  function removeFromNonOverlappingITokens(
    address[] memory _nonOverlappingITokens,
    address token
  ) internal pure returns (address[] memory) {
    (, bool isPresent) = ArrayUtils.indexOf(_nonOverlappingITokens, token);
    if (isPresent) {
      return ArrayUtils.remove(_nonOverlappingITokens, token);
    }
    return _nonOverlappingITokens;
  }

  /**
   * @notice To invest tokens as per scenario 1.
   * @dev 1 => Remove all DepositToken from U1 & Invest into U2, U3.
   */
  function scenario1Investments(
    RebalanceData memory rebalData,
    address[] memory uTokens,
    uint totalReturnedDepositToken,
    uint deadline,
    uint[] memory minimumReturnAmount
  ) internal returns (address[] memory rbtoUTokens) {
    uint256 _denominator;
    uint256 swapAmount;
    // Calculate the denominator as per the updated proportions
    for (uint i = 0; i < uTokens.length; i++) {
      if (i != rebalData.uTokenToRemoveIndex) {
        _denominator += rebalData.defaultProportion[i];
        //we have scenario from struct while declaring another varibale gettin stack to deep
        rebalData.scenario += rebalData.uTokenProportions[i];
      }
    }

    // Invest the totalReturnedDepositToken as per the proportions
    address midTok;
    uint256[] memory defaultTokens = new uint256[](uTokens.length - 1);
    rbtoUTokens = new address[](uTokens.length - 1);

    for (uint j = 0; j < uTokens.length; j++) {
      if (j != rebalData.uTokenToRemoveIndex) {
        uint256 proportion = (rebalData.defaultProportion[j] * 10000000) / _denominator;

        if (j > rebalData.uTokenToRemoveIndex) {
          defaultTokens[j - 1] = proportion;
          rbtoUTokens[j - 1] = uTokens[j];
        } else {
          rbtoUTokens[j] = uTokens[j];
          defaultTokens[j] = proportion;
        }

        midTok = IUniswapOracleV3(afiOracle).getMidToken(uTokens[j]);

        swapAmount =
          (rebalData.uTokenProportions[j] * totalReturnedDepositToken) /
          rebalData.scenario;

        aFiManagerSwap(
          address(rebalData.depositToken),
          uTokens[j],
          swapAmount,
          rebalData.aFiContract,
          deadline,
          midTok,
          minimumReturnAmount[j]
        );
      }
    }
    (rebalData.uTokenProportions, ) = updateProportion(
      address(rebalData.aFiContract),
      rebalData._aFiStorage,
      rbtoUTokens
    );

    rebalData.aFiContract.updateDp(defaultTokens, rebalData.uTokenProportions);
    emit Rebalance(rebalData.aFiContract, 1);

    return rbtoUTokens;
  }

  /**
   * @notice To invest tokens as per scenario 2.
   * @dev 2 => Remove all DepositToken from U1, invest all in U4.
   * @param uTokenToRemoveIndex Index of the underlying token that has to be set to inactive.
   * @param aFiContract Address of AFi contract (AToken).
   * @param uTokens An array of underlying tokens.
   * @param newUToken Address of the new underlying token.
   */
  function scenario2Investments(
    IERC20 depositToken,
    uint uTokenToRemoveIndex,
    IAFi aFiContract,
    address[] memory uTokens,
    address newUToken,
    uint totalReturnedDepositToken,
    uint deadline,
    uint[] memory minimumReturnAmount
  ) internal returns (address[] memory rbtoUTokens) {
    {
      rbtoUTokens = new address[](uTokens.length);

      for (uint j = 0; j < uTokens.length; j++) {
        if (j != uTokenToRemoveIndex) {
          if (j < uTokenToRemoveIndex) {
            rbtoUTokens[j] = uTokens[j];
          } else {
            rbtoUTokens[j - 1] = uTokens[j];
          }
        }
      }

      rbtoUTokens[rbtoUTokens.length - 1] = newUToken;
      _uTokensAfterRebalance = rbtoUTokens;
      address midTok = IUniswapOracleV3(afiOracle).getMidToken(newUToken);
      aFiManagerSwap(
        address(depositToken),
        newUToken,
        totalReturnedDepositToken,
        aFiContract,
        deadline,
        midTok,
        minimumReturnAmount[0]
      );
    }

    emit Rebalance(aFiContract, 2);
  }

  /**
   * @notice Gateway for initiating a Swap from the AFiManager contract.
   * @dev The contract must not be paused. It can only be invoked by the AFiManager contract.
   * @param from The source token which is swapped for the destination token.
   * @param to The destination token to which the from token is swapped into.
   * @param amount Amount of from token for swapping.
   */
  function aFiManagerSwap(
    address from,
    address to,
    uint amount,
    IAFi aFiContract,
    uint256 deadline,
    address midTok,
    uint minimumReturnAmount
  ) internal {
    {
      // Initiate Swap via UniswapV3
      aFiContract.swapViaStorageOrManager(
        from,
        to,
        amount,
        deadline,
        midTok,
        minimumReturnAmount
      );
    }

    emit AFiManagerSwap(aFiContract, from, to, amount);
  }

  function validateNewUTokenData(bytes memory _data, address newUToken) internal pure {
    IAFi.PoolsData memory pooldata = abi.decode(_data, (IAFi.PoolsData));
    IAFi.UnderlyingData memory uniData = abi.decode(
      pooldata.underlyingData,
      (IAFi.UnderlyingData)
    );
    require(
      pooldata._underlyingTokensProportion.length == pooldata._compound.length &&
        pooldata._compound.length == pooldata.compoundV3Comet.length &&
        pooldata.compoundV3Comet.length == pooldata._aaveToken.length,
      "AFM05"
    );
    compareInt(uniData._underlyingTokens.length, 1);
    compareInt(pooldata._underlyingTokensProportion[0], 0);
    require(uniData._underlyingTokens[0] == newUToken, "AFM08");
  }

  /**
   * @notice  To toggle Active Rebalace status of afiContract to either active/inactive.
   * @dev The contract must not be paused.It can invoke by owner
   * @param aFiContract Address of AFi contract (AToken).
   * @param _aFiStorage Address of the AFi Storage Contract.
   * @param status, bool value for rebalance status of afiContract.
   */
  function setActiveRebalStatus(
    IAFiStorage _aFiStorage,
    address aFiContract,
    bool status
  ) external nonReentrant onlyOwner contractUnpaused {
    _aFiStorage.setActiveRebalancedStatus(aFiContract, status);
    emit SetActiveRebalStatus(aFiContract, status);
  }

  struct AlgoRebalanceData {
    IAFi aFiContract;
    IAFiStorage _aFiStorage;
    bytes underlyingData;
    address[] newUnderlyingOracle;
    address[] prevUnderlying;
    address stableCoin;
    uint managerFee;
    uint deadline;
    uint[] minimumReturnAmount;
    uint[] minimumUnderlyingAmount;
  }

  function balance(address tok, address target) internal view returns (uint256) {
    return IERC20(tok).balanceOf(target);
  }

  /**
   * @notice To rebalance the underlying tokens in an algo product.
   * @dev Remove all DepositToken from multiple underlying tokens & Invest into new underlying tokens.
   */
  // Algo Rebalance 1
  function rebalanceUnderlyingTokens(
    AlgoRebalanceData memory rebalanceData,
    IAFi.SwapParameters memory csParams
  ) external contractUnpaused {
    compareAddress(msg.sender, rebalanceController);
    require(rebalanceData.newUnderlyingOracle.length <= 10, "AM07");

    rebalanceData.prevUnderlying = rebalanceData.aFiContract.getUTokens();
    checkProductType(rebalanceData.aFiContract);
    (, rebal, ) = IAFi(rebalanceData.aFiContract).getTVLandRebalContractandType();
    (address[] memory iToken, ) = IAFi(rebalanceData.aFiContract).getInputToken();
    (iToken, ) = IAFi(rebalanceData.aFiContract).getInputToken();
    IPassiveRebal(rebal).initUniStructure(iToken, rebalanceData.underlyingData);

    IAFi.UnderlyingData memory underlyingUniData = abi.decode(
      rebalanceData.underlyingData,
      (IAFi.UnderlyingData)
    );
    uint stableCoinBalance = balance(
      rebalanceData.stableCoin,
      address(rebalanceData.aFiContract)
    );
    uint sameUnderlyingCount = rebalanceAlgo(
      rebalanceData.aFiContract,
      rebalanceData.underlyingData,
      rebalanceData.newUnderlyingOracle,
      rebalanceData.prevUnderlying
    );
    swapUnderlying(
      rebalanceData,
      underlyingUniData._underlyingTokens,
      sameUnderlyingCount,
      stableCoinBalance,
      (rebalanceData.prevUnderlying.length ==
        underlyingUniData._underlyingTokens.length)
    );

    uint256[] memory newProp = new uint256[](
      underlyingUniData._underlyingTokens.length
    );
    (newProp, ) = updateProportion(
      address(rebalanceData.aFiContract),
      rebalanceData._aFiStorage,
      underlyingUniData._underlyingTokens
    );

    updateAFiData(
      rebalanceData.aFiContract,
      underlyingUniData._underlyingTokens,
      newProp,
      newProp
    );
    doCswap(rebalanceData.aFiContract, csParams, rebalanceData._aFiStorage);

    emit RebalanceUnderlyingTokens(
      address(rebalanceData.aFiContract),
      address(rebalanceData._aFiStorage),
      underlyingUniData._underlyingTokens,
      rebalanceData.stableCoin,
      rebalanceData.managerFee
    );
  }

  function doCswap(
    IAFi afiContract,
    IAFi.SwapParameters memory csParams,
    IAFiStorage aFiStorage
  ) internal {
    (address[] memory _iToken, ) = afiContract.getInputToken();
    uint256 totalPreDepBalance;
    for (uint i = 0; i < _iToken.length; i++) {
      totalPreDepBalance += getPredepBalInUSDC(
        _iToken[i],
        address(afiContract),
        aFiStorage
      );
    }

    if (totalPreDepBalance >= afiContract.getPreSwapDepositLimit()) {
      IUniswapOracleV3(afiOracle).cumulativeSwap(csParams);
    }
  }

  function setafiOracleContract(address _afiOracle) external onlyOwner {
    addressCheck(_afiOracle, address(0));
    afiOracle = _afiOracle;
  }

  /**
   * @notice Sets the rebalance Manager fee upper.
   * @dev Only the contract owner can call this function.
   * @param _rebalFeeUpperLimit New algo fee maximum limit.
   */
  function setRebalFeeUpperLimit(uint256 _rebalFeeUpperLimit) external onlyOwner {
    rebalFeeUpperLimit = _rebalFeeUpperLimit;
  }

  /**
   * @notice Sets the rebalance fee.
   * @dev Only the contract owner can call this function.
   * @param _rebalfee New rebalance fee.
   */
  function setRebalFee(uint256 _rebalfee) external onlyOwner {
    require(_rebalfee <= rebalFeeUpperLimit, "AFMO111");
    rebalfee = _rebalfee;
  }

  function rebalanceAlgo(
    IAFi aFiContract,
    bytes memory uniData,
    address[] memory newUnderlyingOracle,
    address[] memory prevUnderlying
  ) internal returns (uint256) {
    bool exist;
    uint sameUnderlyingCount;

    (, rebal, ) = aFiContract.getTVLandRebalContractandType();

    IAFi.UnderlyingData memory underlyingUniData = abi.decode(
      uniData,
      (IAFi.UnderlyingData)
    );

    for (uint i = 0; i < prevUnderlying.length; i++) {
      underlyingExists[address(aFiContract)][prevUnderlying[i]] = true;
    }

    for (uint i = 0; i < underlyingUniData._underlyingTokens.length; i++) {
      if (prevUnderlying.length == underlyingUniData._underlyingTokens.length) {
        exist = checkIfUTokenExist(
          address(aFiContract),
          underlyingUniData._underlyingTokens[i]
        );
        if (exist) {
          isUnderlyingCommon[underlyingUniData._underlyingTokens[i]] = true;
          delete exist;
          sameUnderlyingCount++;
        }
      }
      IPassiveRebal(rebal).updateOracleData(
        underlyingUniData._underlyingTokens[i],
        newUnderlyingOracle[i]
      );
    }
    IUniswapOracleV3(afiOracle).updateMidToken(
      underlyingUniData._underlyingTokens,
      underlyingUniData._underlyingUniPoolToken
    );
    return sameUnderlyingCount;
  }

  function swapUnderlying(
    AlgoRebalanceData memory rebalanceData,
    address[] memory uTokensToAdd,
    uint _sameUnderlying,
    uint oldBalance,
    bool isLengthEqual
  ) internal {
    address midTok;
    uint rebalanceAmount;
    uint stableCoinBalance;
    if (isLengthEqual) {
      for (uint i = 0; i < rebalanceData.prevUnderlying.length; i++) {
        if (!isUnderlyingCommon[rebalanceData.prevUnderlying[i]]) {
          rebalanceAmount = balance(
            rebalanceData.prevUnderlying[i],
            address(rebalanceData.aFiContract)
          );
          midTok = IUniswapOracleV3(afiOracle).getMidToken(
            rebalanceData.prevUnderlying[i]
          );

          // Get Deposit token back from the UToken that is going to be rebalanced
          aFiManagerSwap(
            rebalanceData.prevUnderlying[i],
            rebalanceData.stableCoin,
            rebalanceAmount,
            rebalanceData.aFiContract,
            rebalanceData.deadline,
            midTok,
            rebalanceData.minimumReturnAmount[i]
          );
        }
      }
      checkRebalFeesandDeduct(
        rebalanceData.managerFee,
        rebalanceData.stableCoin,
        rebalanceData.aFiContract
      );

      stableCoinBalance = ((
        balance(rebalanceData.stableCoin, address(rebalanceData.aFiContract))
      ) - (oldBalance));
      rebalanceAmount = (stableCoinBalance) / (uTokensToAdd.length - _sameUnderlying);

      for (uint i = 0; i < uTokensToAdd.length; i++) {
        if (!isUnderlyingCommon[uTokensToAdd[i]]) {
          midTok = IUniswapOracleV3(afiOracle).getMidToken(uTokensToAdd[i]);

          // Swap stable token into into new underlying tokens in same proportions
          aFiManagerSwap(
            rebalanceData.stableCoin,
            uTokensToAdd[i],
            rebalanceAmount,
            rebalanceData.aFiContract,
            rebalanceData.deadline,
            midTok,
            rebalanceData.minimumUnderlyingAmount[i]
          );
        } else {
          delete isUnderlyingCommon[uTokensToAdd[i]];
        }
      }
    } else {
      //  When prevUnderlying length is not equal.All existing underlying token will be swapped
      for (uint i = 0; i < rebalanceData.prevUnderlying.length; i++) {
        rebalanceAmount = balance(
          rebalanceData.prevUnderlying[i],
          address(rebalanceData.aFiContract)
        );
        midTok = IUniswapOracleV3(afiOracle).getMidToken(
          rebalanceData.prevUnderlying[i]
        );

        // Get Deposit token back from the UToken that is going to be rebalanced
        aFiManagerSwap(
          rebalanceData.prevUnderlying[i],
          rebalanceData.stableCoin,
          rebalanceAmount,
          rebalanceData.aFiContract,
          rebalanceData.deadline,
          midTok,
          rebalanceData.minimumReturnAmount[i]
        );
      }

      checkRebalFeesandDeduct(
        rebalanceData.managerFee,
        rebalanceData.stableCoin,
        rebalanceData.aFiContract
      );

      stableCoinBalance = ((
        balance(rebalanceData.stableCoin, address(rebalanceData.aFiContract))
      ) - (oldBalance));

      rebalanceAmount = (stableCoinBalance) / (uTokensToAdd.length);

      //stable coin swap into new underlying tokens
      for (uint i = 0; i < uTokensToAdd.length; i++) {
        midTok = IUniswapOracleV3(afiOracle).getMidToken(uTokensToAdd[i]);
        // Swap stable into into new underlying tokens
        aFiManagerSwap(
          rebalanceData.stableCoin,
          uTokensToAdd[i],
          rebalanceAmount,
          rebalanceData.aFiContract,
          rebalanceData.deadline,
          midTok,
          rebalanceData.minimumUnderlyingAmount[i]
        );
      }
    }

    for (uint256 i = 0; i < rebalanceData.prevUnderlying.length; i++) {
      delete underlyingExists[address(rebalanceData.aFiContract)][
        rebalanceData.prevUnderlying[i]
      ];
    }
  }

  function checkRebalFeesandDeduct(
    uint256 fee,
    address stableCoin,
    IAFi aficontract
  ) internal {
    require(fee / (10 ** IERC20(stableCoin).decimals()) <= rebalfee, "AB35");
    aficontract.sendProfitOrFeeToManager(msg.sender, fee, stableCoin);
  }

  // emergency withdraw from pools
  function withdrawFromPool(
    IAFiStorage _afiStorage,
    IAFi aFiContract,
    address underlyinToken
  ) external nonReentrant onlyOwner contractUnpaused {
    _afiStorage._withdrawAll(address(aFiContract), underlyinToken);
    emit WithdrawFromPool(address(aFiContract), underlyinToken);
  }

  /**
   * @notice gets the new proportions of the underlying tokens in an afiContract.
   * @param aFiContract indicates address of afiContract
   * @param _aFiStorage indicates address of afiStorage.
   * @param uTok array of new uTokens for logging.
   */
  function updateProportion(
    address aFiContract,
    IAFiStorage _aFiStorage,
    address[] memory uTok
  ) internal view returns (uint256[] memory prop, uint256 totalProp) {
    uint256 totalBalance;
    for (uint i = 0; i < uTok.length; i++) {
      totalBalance += (_aFiStorage.calcPoolValue(uTok[i], aFiContract) -
        getPredepBalInUSDC(uTok[i], aFiContract, _aFiStorage));
    }
    prop = new uint256[](uTok.length);

    //Update Proportions
    unchecked {
      for (uint j = 0; j < uTok.length; j++) {
        prop[j] =
          ((_aFiStorage.calcPoolValue(uTok[j], aFiContract) -
            getPredepBalInUSDC(uTok[j], aFiContract, _aFiStorage)) * (10000000)) /
          (totalBalance);
        totalProp = totalProp + prop[j];
      }
    }
    return (prop, totalProp);
  }

  function getPredepBalInUSDC(
    address tok,
    address aFiContract,
    IAFiStorage _aFiStorage
  ) internal view returns (uint256 tokPredepInUSD) {
    uint256 temp;
    uint256 multiplier;

    (temp, multiplier) = _aFiStorage.getPriceInUSDC(tok);
    uint256 depTok = _aFiStorage.getPreSwapDepositsTokens(
      aFiContract,
      IAFi(aFiContract).getcSwapCounter(),
      tok
    );

    tokPredepInUSD = (depTok) * (uint(temp));
    temp = _aFiStorage.validateAndGetDecimals(tok);
    tokPredepInUSD = ((tokPredepInUSD * (10 ** temp)) / (multiplier));
  }

  /**
   * @notice Checks the existence status of a token in an aFi contract.
   * @param uTok Address of the token to check.
   * @return bool Whether the token exists or not.
   */
  function checkIfUTokenExist(
    address afiContract,
    address uTok
  ) internal view returns (bool) {
    return underlyingExists[afiContract][uTok];
  }

  function updateStableUnitsInUSD(
    uint256 _preDepositsStablesInUSD
  ) external returns (uint256) {
    compareAddress(msg.sender, rebalanceController);
    preDepositsStablesInUSD = _preDepositsStablesInUSD;
    return _preDepositsStablesInUSD;
  }

  /**
   * @notice Returns a new array of underlying token, token proportion and default proption that to be used by the AFiBase.
   * @param aFiContract address of the afiContract.
   * @param aFiContract address of the AFiStorage.
   * @return underlyingTokenProportions array of new proportion.
   */
  function getUTokenProportion(
    address aFiContract,
    address _aFiStorage
  )
    external
    view
    returns (uint256[] memory underlyingTokenProportions, uint256 totalProp)
  {
    (, address rebalAddress, ) = IAFi(aFiContract).getTVLandRebalContractandType();
    compareAddress(msg.sender, rebalAddress);

    (underlyingTokenProportions, totalProp) = updateProportion(
      aFiContract,
      IAFiStorage(_aFiStorage),
      IAFi(aFiContract).getUTokens()
    );
  }

  /**
   * @notice Calculates the total value of pre-swap deposits in USD.
   * @dev Internal function used to determine the total value of pre-swap deposits in USD.
   * @param aFiContract Instance of the aFi contract.
   * @param _aFiStorage Instance of the aFiStorage contract.
   * @return totalPreDepositInUSD The total value of pre-swap deposits in USD.
   */
  function inputTokenUSD(
    IAFi aFiContract,
    uint256 cSwapCounter,
    IAFiStorage _aFiStorage
  ) public view returns (uint256 totalPreDepositInUSD) {
    (address[] memory _iToken, ) = aFiContract.getInputToken();
    uint256 depTok;
    uint uTokensDecimal;
    uint256 price;
    uint256 multiplier;

    for (uint i = 0; i < _iToken.length; i++) {
      (depTok) = _aFiStorage.getPreSwapDepositsTokens(
        address(aFiContract),
        cSwapCounter,
        address(_iToken[i])
      );
      if (depTok > 0) {
        uTokensDecimal = IERC20(_iToken[i]).decimals();
        (price, multiplier) = _aFiStorage.getPriceInUSDC(_iToken[i]);

        validateGreaterEqual(18, uTokensDecimal);
        uTokensDecimal = 18 - uTokensDecimal;
        totalPreDepositInUSD += (((depTok) * (10 ** uTokensDecimal) * (uint(price))) /
          (multiplier));
      }
    }
  }

  /**
   * @notice Performs an emergency rebalance of the aFi contract.
   * @dev Only the contract owner can call this function, and it must not be reentrant.
   * @param aFiContract Instance of the aFi contract.
   * @param _aFiStorage Instance of the aFiStorage contract.
   * @param uTokenToRemove Address of the uToken to be removed.
   * @param defProp Array of default uTokens proportion to be updated.
   */
  function emergencyRebalance(
    IAFi aFiContract,
    IAFiStorage _aFiStorage,
    address uTokenToRemove,
    uint256[] memory defProp
  ) external nonReentrant onlyOwner contractUnpaused {
    rebalanceInternal(aFiContract, _aFiStorage, uTokenToRemove, defProp);
  }

  function rebalanceInternal(
    IAFi aFiContract,
    IAFiStorage _aFiStorage,
    address uTokenToRemove,
    uint256[] memory defProp
  ) internal {
    address[] memory uTok = aFiContract.getUTokens();

    (uint index, ) = ArrayUtils.indexOf(uTok, uTokenToRemove);

    for (uint i = 0; i < uTok.length; i++) {
      if (i >= index && i != (uTok.length - 1)) {
        uTok[i] = uTok[i + 1];
      }

      if (i == (uTok.length - 1)) {
        assembly {
          mstore(uTok, sub(mload(uTok), 1))
        }
      }
    }

    compareInt(uTok.length, defProp.length);

    _aFiStorage._withdrawAll(address(aFiContract), uTokenToRemove);

    // Update input token data after removing the uToken
    (
      address[] memory inputStables,
      address[] memory nonOverlappingITokens
    ) = aFiContract.getInputToken();
 
    (, , uint256 productType) = aFiContract.getTVLandRebalContractandType();
    if(productType != 3){
      updateInputTokenData(
        address(aFiContract),
        address(_aFiStorage),
        uTokenToRemove,
        inputStables,
        nonOverlappingITokens
      );
    }
   
    updateAFiData(aFiContract, uTok, defProp, defProp);
  }

  function checkProductType(IAFi afiContract) internal {
    (, , uint256 productType) = afiContract.getTVLandRebalContractandType();
    compareInt(productType, 3);
  }

  /**
   * @notice Performs an algo type 2 rebalance of the aFi contract.
   * @dev Only the contract owner can call this function, and it must not be reentrant.
   * @param aFiContract address of the aFi contract.
   * @param _aFiStorage address of the aFiStorage contract.
   * @param uTokenToRemove Address of the uToken to be removed.
   * @param defProp Array of default uTokens proportion to be updated.
   * @param deadline uint256 deadline to perform swaps on uniswapV3.
   * @param stableamountOut uint256 minimum amount out value of the depositTok after swap.
   */
  // Algo Rebalance 2
  function algoRebalance2(
    IAFi aFiContract,
    IAFiStorage _aFiStorage,
    address uTokenToRemove,
    uint256[] memory defProp,
    address depositTok,
    uint256 deadline,
    uint256 stableamountOut
  ) external nonReentrant contractUnpaused {
    compareAddress(msg.sender, rebalanceController);

    (address[] memory inputStables, ) = aFiContract.getInputToken();
    (, bool present) = ArrayUtils.indexOf(inputStables, depositTok);
    require(present, "AM003");

    rebalanceInternal(aFiContract, _aFiStorage, uTokenToRemove, defProp);

    uint256 balToConsider = convertToStable(
      aFiContract,
      uTokenToRemove,
      depositTok,
      deadline,
      stableamountOut
    );

    if(uTokenToRemove == depositTok){
      balToConsider = _aFiStorage.getPreSwapDepositsTokens(
        address(aFiContract),
        aFiContract.getcSwapCounter(),
        uTokenToRemove
      );
    }

    balToConsider = balance(depositTok, address(aFiContract)) - balToConsider;

    _aFiStorage.setPreDepositedInputTokenInRebalance(
      address(aFiContract),
      aFiContract.getcSwapCounter(),
      balToConsider,
      depositTok
    );

    isQueueWithdrawUnstakingPaused[address(aFiContract)] = true;
  }

  function pauseQueueWithdrawUnstaking(address afiContract, bool status) external {
    require(msg.sender == afiOracle, "AM012");
    isQueueWithdrawUnstakingPaused[afiContract] = status;
  }

  function reInitializeVault(
    IAFi aFiContract,
    IAFiStorage _aFiStorage,
    bytes memory uniData,
    address[] memory uTokens,
    address[] memory oracles,
    uint256[] memory defaultProp,
    uint256[] memory currentProp,
    IAFi.SwapParameters memory csParams
  ) external contractUnpaused {
    compareAddress(msg.sender, rebalanceController);
    require(aFiContract.getUTokens().length == 0, "AM15");
    require(uTokens.length <= 10, "AM0009");
    checkProductType((aFiContract));
    IAFi.UnderlyingData memory underlyingUniData = abi.decode(
      uniData,
      (IAFi.UnderlyingData)
    );
    updateAFiData(aFiContract, uTokens, defaultProp, currentProp);
    (, rebal, ) = IAFi(aFiContract).getTVLandRebalContractandType();
    (address[] memory iToken, ) = IAFi(aFiContract).getInputToken();
    (iToken, ) = IAFi(aFiContract).getInputToken();
    IPassiveRebal(rebal).initUniStructure(iToken, uniData);
    IUniswapOracleV3(afiOracle).updateMidToken(
      underlyingUniData._underlyingTokens,
      underlyingUniData._underlyingUniPoolToken
    );
    for (uint256 i; i < uTokens.length; i++) {
      IPassiveRebal(rebal).updateOracleData(
        underlyingUniData._underlyingTokens[i],
        oracles[i]
      );
    }
    aFiContract.reinitializeHappened(true);
    doCswap(aFiContract, csParams, _aFiStorage);
  }

  function convertToStable(
    IAFi aFiContract,
    address uTokenToRemove,
    address depositTok,
    uint256 deadline,
    uint256 stableamountOut
  ) internal returns (uint256 _stableBalToConsider) {
    require(balance(uTokenToRemove, address(aFiContract)) > 0, "AM06");

    // To avoid stack too deep error
    // Get Deposit token back from the UToken that is going to be rebalanced
    address midTok = IUniswapOracleV3(afiOracle).getMidToken(uTokenToRemove);

    _stableBalToConsider = balance(depositTok, address(aFiContract));

    if(uTokenToRemove != depositTok){
      aFiManagerSwap(
        uTokenToRemove,
        depositTok,
        balance(uTokenToRemove, address(aFiContract)),
        aFiContract,
        deadline,
        midTok,
        stableamountOut
      );
    }
  }
}
