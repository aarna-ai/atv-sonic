// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IAFi.sol";
import "./IAFiStorage.sol";
import "./TransferHelper.sol";
import {OwnableDelayModule} from "./OwnableDelayModule.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import "./ArrayUtils.sol";
import {SafeERC20} from "./SafeERC20.sol";
import "./IPassiveRebal.sol";
import {IUniswapOracleV3} from "./IUniswapV3.sol";

/**
 * @title AtvManager.
 * @notice Manager conntract for handling rebalancing and adding/updating team wallets in the AFi contracts.
 * @dev Error codes: AFM01: Caller is not MultiSig. AFM02: Cannot be address zero. AFM03: Teamwallet already present. AFM04: Previous and current active status cannot be the same.
 */
contract AtvManager is OwnableDelayModule, ReentrancyGuard {
  using ArrayUtils for uint[];
  using ArrayUtils for address[];
  using SafeERC20 for IERC20;

  address internal rebal;
  address internal afiOracle;
  address public rebalanceController;

  uint256 internal preDepositsStablesInUSD;
  uint256 public rebalfee = 5e20;
  uint256 public rebalFeeUpperLimit = 5e21;
  uint256 internal _sameUnderlying;
  uint256 internal oldBalance;

  bool internal paused;
  bool internal isLengthEqual;

  uint[] internal defaultProportion;

  mapping(address => mapping(address => bool)) internal underlyingExists;
  mapping(address => bool) internal isUnderlyingCommon;
  mapping(address => bool) public isQueueWithdrawUnstakingPaused;

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
    uint256 depositTokenIndex;
  }

  struct RebalanceLocalVars {
    address[] uTokens;
    uint totalReturnedDepositToken;
    address[] inputStables;
    address[] nonOverlappingITokens;
    bool isNewTokenPresent;
  }
  
  struct Scenario1LocalVars {
    uint256 denominator;
    uint256 swapAmount;
    address midTok;
    uint256[] defaultTokens;
    address[] rbtoUTokens;
    uint256 proportion;
  }
  
  struct AlgoRebalanceData {
    IAFi aFiContract;
    IAFiStorage _aFiStorage;
    bytes underlyingData;
    address[] newUnderlyingOracle;
    address[] prevUnderlying;
    address stableCoin;
    uint256 stableCoinIndex;
    uint managerFee;
    uint deadline;
    uint[] minimumReturnAmount;
    uint[] minimumUnderlyingAmount;
  }

  event Rebalance(IAFi indexed _aFiContract, uint8 _scenario);
  event AddTeamWalletInAFi(address indexed aFiContract, address _wallet);
  event WithdrawFromPool(address indexed _aFiContract, address uToken);
  event SetActiveRebalStatus(address indexed _aFiContract, bool status);
  event RebalanceUnderlyingTokens(
    address indexed aFiContract,
    address _aFiStorage,
    address[] newUnderlyingTokens,
    address stableCoin,
    uint managerFee
  );
  event AFiManagerSwap(
    IAFi indexed _aFiContract,
    address _fromToken,
    address _toToken,
    uint _amount
  );
 
  /**
   * @param account Address of the account that paused the contract.
   */
  event Paused(address account);
  /**
   * @param account Address of the account that unpaused the contract.
   */
  event Unpaused(address account);

  modifier contractUnpaused() {
    checkStatus(paused);
    _;
  }

  modifier contractPaused() {
    checkStatus(!paused);
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
    require(val1 >= val2, "AFM19");
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
  
  function checkStatus(bool _status) internal pure {
    if (_status) revert("AFM03");
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
    addressCheck(_wallet, address(0));
    (, bool isPresent) = _aFiStorage.getTeamWalletDetails(aFiContract, _wallet);
    checkStatus(isPresent);
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
    uint256 _rebalFeeToDeduct,
    bytes calldata firstIterationUnderlyingSwap,
    bytes[] calldata secondIterationUnderlyingSwap
  ) external nonReentrant contractUnpaused {
    RebalanceLocalVars memory vars;
    compareAddress(msg.sender, rebalanceController);
    validateGreater(3, rebalData.scenario);
    validateGreater(rebalData.scenario, 0);
    addressCheck(rebalData.uTokenToRemove, address(rebalData.depositToken));
    checkStatus(!rebalData._aFiStorage.isAFiActiveRebalanced(address(rebalData.aFiContract)));

    (, rebal, ) = IAFi(rebalData.aFiContract).getTVLandRebalContractandType();
    vars.uTokens = IAFi(rebalData.aFiContract).getUTokens();
     
    // Validate uTokenToRemove and uTokenToRemoveIndex
    compareAddress(vars.uTokens[rebalData.uTokenToRemoveIndex], rebalData.uTokenToRemove);

    if (rebalData.scenario == 2) {
      (, bool present) = ArrayUtils.indexOf(vars.uTokens, rebalData.newUToken);
      checkStatus(present);
      validateNewUTokenData(data, rebalData.newUToken);
    }else {
      validateGreater(vars.uTokens.length, 1);
    }

    vars.totalReturnedDepositToken = balance(address(rebalData.depositToken), address(rebalData.aFiContract));
    rebalData._aFiStorage._withdrawAll(
      address(rebalData.aFiContract),
      rebalData.uTokenToRemove,
      new bytes(0)
    );

    (rebalData.uTokenProportions, ) = updateProportion(
      address(rebalData.aFiContract),
      rebalData._aFiStorage,
      vars.uTokens,
      rebalData.uTokenToRemove
    );

    convertToStable(
      rebalData.aFiContract,
      rebalData.uTokenToRemove,
      address(rebalData.depositToken),
      deadline,
      stableAmountOut,
      firstIterationUnderlyingSwap
    );

    checkRebalFeesandDeduct(
      _rebalFeeToDeduct,
      address(rebalData.depositToken),
      rebalData.aFiContract,
      rebalData._aFiStorage
    );

    vars.totalReturnedDepositToken = balance(address(rebalData.depositToken), address(rebalData.aFiContract)) - vars.totalReturnedDepositToken;
    
    (vars.inputStables, vars.nonOverlappingITokens) = getInputToken(rebalData.aFiContract);
    compareAddress(vars.inputStables[rebalData.depositTokenIndex], address(rebalData.depositToken));
  
    updateInputTokenData(
      address(rebalData.aFiContract),
      address(rebalData._aFiStorage),
      rebalData.uTokenToRemove,
      vars.inputStables,
      vars.nonOverlappingITokens
    );
    
    defaultProportion = rebalData.defaultProportion;
    (, rebalData.defaultProportion) = rebalData.aFiContract.getProportions();

    {
      if (rebalData.scenario == 1) {
        if (
          IPassiveRebal(rebal).getRebalStrategyNumber(address(rebalData.aFiContract)) !=
          1
        ) {
          rebalData.uTokenProportions = rebalData.defaultProportion;
        }
        // investInOtherUTokens
        rebalData.uTokensAfterS1 = scenario1Investments(
          rebalData,
          vars.uTokens,
          vars.totalReturnedDepositToken,
          deadline,
          minimumReturnAmount,
          secondIterationUnderlyingSwap
        );

        rebalData.aFiContract.updateuTokAndProp(rebalData.uTokensAfterS1);
      } else {
        (vars.inputStables, vars.nonOverlappingITokens) = getInputToken(rebalData.aFiContract);

        rebalData.aFiContract.updatePoolData(data);
        (,vars.isNewTokenPresent) = ArrayUtils.indexOf(
          vars.nonOverlappingITokens,
          rebalData.newUToken
        );

        if (vars.isNewTokenPresent) {
          vars.nonOverlappingITokens = removeFromNonOverlappingITokens(
            vars.nonOverlappingITokens,
            rebalData.newUToken
          );
        }
        // Update vars.nonOverlappingITokens in AFiBase
        IAFi(rebalData.aFiContract).updateInputTokens(vars.nonOverlappingITokens);

        vars.uTokens = scenario2Investments(
          rebalData.depositToken,
          rebalData.uTokenToRemoveIndex,
          rebalData.aFiContract,
          vars.uTokens,
          rebalData.newUToken,
          vars.totalReturnedDepositToken,
          deadline,
          minimumReturnAmount,
          secondIterationUnderlyingSwap
        );

        (rebalData.uTokenProportions, ) = updateProportion(
          address(rebalData.aFiContract),
          rebalData._aFiStorage,
          vars.uTokens,
          address(0)
        );
        updateAFiData(
          rebalData.aFiContract,
          vars.uTokens,
          defaultProportion,
          rebalData.uTokenProportions
        );
      }
    }

    setUntrackedTokToPredep(
      address(rebalData.aFiContract), 
      vars.inputStables
    );
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
    uint[] memory minimumReturnAmount,
    bytes[] calldata secondIterationUnderlyingSwap
  ) internal returns (address[] memory) {
    Scenario1LocalVars memory vars;
    vars.defaultTokens = new uint256[](uTokens.length - 1);
    vars.rbtoUTokens = new address[](uTokens.length - 1);

    // Calculate the denominator as per the updated proportions
    for (uint i = 0; i < uTokens.length; i++) {
      if (i != rebalData.uTokenToRemoveIndex) {
        vars.denominator += rebalData.defaultProportion[i];
        rebalData.scenario += rebalData.uTokenProportions[i];
      }
    }

    // Invest the totalReturnedDepositToken as per the proportions
    for (uint j = 0; j < uTokens.length; j++) {
      if (j != rebalData.uTokenToRemoveIndex) {
        vars.proportion = (rebalData.defaultProportion[j] * 10000000) / vars.denominator;

        if (j > rebalData.uTokenToRemoveIndex) {
          vars.defaultTokens[j - 1] = vars.proportion;
          vars.rbtoUTokens[j - 1] = uTokens[j];
        } else {
          vars.rbtoUTokens[j] = uTokens[j];
          vars.defaultTokens[j] = vars.proportion;
        }

        vars.midTok = getMidToken(uTokens[j]);

        vars.swapAmount = 
          (rebalData.uTokenProportions[j] * totalReturnedDepositToken) /
          rebalData.scenario;

        aFiManagerSwap(
          address(rebalData.depositToken),
          uTokens[j],
          vars.swapAmount,
          rebalData.aFiContract,
          deadline,
          vars.midTok,
          minimumReturnAmount[j],
          secondIterationUnderlyingSwap[j]
        );
      }
    }

    (rebalData.uTokenProportions, ) = updateProportion(
      address(rebalData.aFiContract),
      rebalData._aFiStorage,
      vars.rbtoUTokens,
      address(0)
    );

    rebalData.aFiContract.updateDp(vars.defaultTokens, rebalData.uTokenProportions);
    emit Rebalance(rebalData.aFiContract, 1);

    return vars.rbtoUTokens;
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
    uint[] memory minimumReturnAmount,
    bytes[] calldata secondIterationUnderlyingSwap
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
      address midTok = getMidToken(newUToken);
      aFiManagerSwap(
        address(depositToken),
        newUToken,
        totalReturnedDepositToken,
        aFiContract,
        deadline,
        midTok,
        minimumReturnAmount[0],
        secondIterationUnderlyingSwap[0]
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
    uint minimumReturnAmount,
    bytes calldata secondIterationUnderlyingSwap
  ) internal {
    {

      if(from != to){
        // Initiate Swap via UniswapV3
        aFiContract.swapfromSelectiveDex(
          from,
          to,
          amount,
          deadline,
          midTok,
          minimumReturnAmount,
          secondIterationUnderlyingSwap
        );
      }
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
      pooldata._underlyingTokensProportion.length == pooldata._pendleMarketPalace.length &&
      pooldata._pendleMarketPalace.length == pooldata._aaveToken.length,
      "AFM05"
    );
    compareInt(uniData._underlyingTokens.length, 1);
    compareInt(pooldata._underlyingTokensProportion[0], 0);
    compareAddress(uniData._underlyingTokens[0], newUToken);
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
    IAFi.SwapParameters memory csParams, 
    IAFi.SwapDataStructure calldata dexdata,
    uint256 minAmountOut,
    uint256 csMinAmountOut
  ) external contractUnpaused {
    compareAddress(msg.sender, rebalanceController);
    validateGreaterEqual(10, rebalanceData.newUnderlyingOracle.length);

    rebalanceData.prevUnderlying = rebalanceData.aFiContract.getUTokens();
    checkProductType(rebalanceData.aFiContract);
    (, rebal, ) = IAFi(rebalanceData.aFiContract).getTVLandRebalContractandType();
    (address[] memory iToken, ) = getInputToken(rebalanceData.aFiContract);
    compareAddress(iToken[rebalanceData.stableCoinIndex], rebalanceData.stableCoin);

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

    updateTempData(sameUnderlyingCount, stableCoinBalance, rebalanceData.prevUnderlying.length == underlyingUniData._underlyingTokens.length);
    swapUnderlying(
      rebalanceData,
      underlyingUniData._underlyingTokens,
      dexdata,
      minAmountOut
    );

    uint256[] memory newProp = new uint256[](
      underlyingUniData._underlyingTokens.length
    );
    (newProp, ) = updateProportion(
      address(rebalanceData.aFiContract),
      rebalanceData._aFiStorage,
      underlyingUniData._underlyingTokens,
      address(0)
    );

    updateAFiData(
      rebalanceData.aFiContract,
      underlyingUniData._underlyingTokens,
      newProp,
      newProp
    );
    csParams.cSwapFee = 0;
    doCswap(rebalanceData.aFiContract, csParams, rebalanceData._aFiStorage, dexdata, csMinAmountOut);

    emit RebalanceUnderlyingTokens(
      address(rebalanceData.aFiContract),
      address(rebalanceData._aFiStorage),
      underlyingUniData._underlyingTokens,
      rebalanceData.stableCoin,
      rebalanceData.managerFee
    );
  }

  function updateTempData(uint256 sameUnderlyingCount, uint256 stableCoinBalance, bool status) internal {
    _sameUnderlying = sameUnderlyingCount;
    oldBalance = stableCoinBalance;
    isLengthEqual = status;
  }

  function doCswap(
    IAFi afiContract,
    IAFi.SwapParameters memory csParams,
    IAFiStorage aFiStorage,
    IAFi.SwapDataStructure calldata dexdata,
    uint256 minAmountOut
  ) internal {
    (address[] memory _iToken, ) = getInputToken(afiContract);
    uint256 totalPreDepBalance;
    for (uint i = 0; i < _iToken.length; i++) {
      totalPreDepBalance += getPredepBalInUSDC(
        _iToken[i],
        address(afiContract),
        aFiStorage
      );
    }

    if (totalPreDepBalance >= IPassiveRebal(rebal).getPreSwapDepositLimit()) {
      IUniswapOracleV3(afiOracle).cumulativeSwap(csParams, 0, dexdata, bytes(""), minAmountOut);
    }

    setUntrackedTokToPredep(
      address(afiContract), 
      _iToken
    );
  }

  function setafiOracleContract(address _afiOracle) external onlyOwner {
    addressCheck(_afiOracle, address(0));
    afiOracle = _afiOracle;
  }

  /**
   * @notice Sets the rebalance fee.
   * @dev Only the contract owner can call this function.
   * @param _rebalfee New rebalance fee.
   */
  function setRebalFee(uint256 _rebalfee) external onlyOwner {
    validateGreaterEqual(rebalFeeUpperLimit, _rebalfee);
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
    IPassiveRebal(rebal).updateMidToken(
      underlyingUniData._underlyingTokens,
      underlyingUniData._underlyingUniPoolToken
    );
    return sameUnderlyingCount;
  }

  function swapUnderlying(
    AlgoRebalanceData memory rebalanceData,
    address[] memory uTokensToAdd,
    IAFi.SwapDataStructure calldata dexdata,
    uint256 minAmountOut
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
          midTok = getMidToken(
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
            rebalanceData.minimumReturnAmount[i],
            dexdata.firstIterationUnderlyingSwap[i]
          );
        }
      }

      stableCoinBalance = ((
        balance(rebalanceData.stableCoin, address(rebalanceData.aFiContract))
      ) - (oldBalance));

      validateGreaterEqual(stableCoinBalance, minAmountOut);

      checkRebalFeesandDeduct(
        rebalanceData.managerFee,
        rebalanceData.stableCoin,
        rebalanceData.aFiContract,
        rebalanceData._aFiStorage
      );

      stableCoinBalance -= rebalanceData.managerFee;
      rebalanceAmount = (stableCoinBalance) / (uTokensToAdd.length - _sameUnderlying);

      for (uint i = 0; i < uTokensToAdd.length; i++) {
        if (!isUnderlyingCommon[uTokensToAdd[i]]) {
          midTok = getMidToken(uTokensToAdd[i]);

          // Swap stable token into into new underlying tokens in same proportions
          aFiManagerSwap(
            rebalanceData.stableCoin,
            uTokensToAdd[i],
            rebalanceAmount,
            rebalanceData.aFiContract,
            rebalanceData.deadline,
            midTok,
            rebalanceData.minimumUnderlyingAmount[i],
            dexdata.secondIterationUnderlyingSwap[i]
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
        midTok = getMidToken(
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
          rebalanceData.minimumReturnAmount[i],
          dexdata.firstIterationUnderlyingSwap[i]
        );
      }

      stableCoinBalance = ((
        balance(rebalanceData.stableCoin, address(rebalanceData.aFiContract))
      ) - (oldBalance));

      validateGreaterEqual(stableCoinBalance, minAmountOut);

      checkRebalFeesandDeduct(
        rebalanceData.managerFee,
        rebalanceData.stableCoin,
        rebalanceData.aFiContract,
        rebalanceData._aFiStorage
      );

      stableCoinBalance -= rebalanceData.managerFee;
      rebalanceAmount = (stableCoinBalance) / (uTokensToAdd.length);

      //stable coin swap into new underlying tokens
      for (uint i = 0; i < uTokensToAdd.length; i++) {
        midTok = getMidToken(uTokensToAdd[i]);
        // Swap stable into into new underlying tokens
        aFiManagerSwap(
          rebalanceData.stableCoin,
          uTokensToAdd[i],
          rebalanceAmount,
          rebalanceData.aFiContract,
          rebalanceData.deadline,
          midTok,
          rebalanceData.minimumUnderlyingAmount[i],
          dexdata.secondIterationUnderlyingSwap[i]
        );
      }
    }

    for (uint256 i = 0; i < rebalanceData.prevUnderlying.length; i++) {
      delete underlyingExists[address(rebalanceData.aFiContract)][
        rebalanceData.prevUnderlying[i]
      ];
    }
  }

  function validateGreater(uint256 val1, uint256 val2) internal pure {
    require(val1 > val2, "AM20");
  }

  function checkRebalFeesandDeduct(
    uint256 fee,
    address stableCoin,
    IAFi aficontract,
    IAFiStorage _aFiStorage
  ) internal {
    if (fee > 0) {
      (uint256 price, uint256 decimal) = _aFiStorage.getPriceInUSD(stableCoin);
      uint iTokenDecimal = _aFiStorage.validateAndGetDecimals(stableCoin);
      uint256 redFee = (((fee) * price * (10 ** iTokenDecimal)) / (10 ** decimal));
      validateGreaterEqual(rebalfee, redFee);
      aficontract.sendProfitOrFeeToManager(msg.sender, fee, stableCoin);
    }
  }

  // emergency withdraw from pools
  function withdrawFromPool(
    IAFiStorage _afiStorage,
    IAFi aFiContract,
    address underlyinToken,
    bytes calldata pendleWithdrawData
  ) external nonReentrant onlyOwner contractUnpaused {
    _afiStorage._withdrawAll(address(aFiContract), underlyinToken, pendleWithdrawData);
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
    address[] memory uTok, 
    address uTokToRemove
  ) internal view returns (uint256[] memory prop, uint256 totalProp) {
    uint256 totalBalance;
    for (uint i = 0; i < uTok.length; i++) {
      if(uTokToRemove != uTok[i]){
        totalBalance += (_aFiStorage.calcPoolValue(uTok[i], aFiContract) -
        getPredepBalInUSDC(uTok[i], aFiContract, _aFiStorage));
      }
    }
    prop = new uint256[](uTok.length);

    //Update Proportions
    unchecked {
      for (uint j = 0; j < uTok.length; j++) {
        if(uTokToRemove != uTok[j]){

          prop[j] =
            ((_aFiStorage.calcPoolValue(uTok[j], aFiContract) -
              getPredepBalInUSDC(uTok[j], aFiContract, _aFiStorage)) * (10000000)) /
            (totalBalance);
          totalProp = totalProp + prop[j];
        }
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

    (temp, multiplier) = _aFiStorage.getPriceInUSD(tok);
    uint256 depTok = getPreDepVAlueFromStorage(
      aFiContract,
      _aFiStorage,
      IAFi(aFiContract).getcSwapCounter(),
      tok
    );

    tokPredepInUSD = (depTok) * (uint(temp));
    temp = _aFiStorage.validateAndGetDecimals(tok);
    tokPredepInUSD = ((tokPredepInUSD * (10 ** temp)) / (10 ** multiplier));
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
    (underlyingTokenProportions, totalProp) = updateProportion(
      aFiContract,
      IAFiStorage(_aFiStorage),
      IAFi(aFiContract).getUTokens(),
      address(0)
    );
  }

  function getPreDepVAlueFromStorage(address afiContract, IAFiStorage _aFiStorage, uint256 csCounter, address tok) internal view returns(uint256){
    return _aFiStorage.getPreSwapDepositsTokens(
      afiContract,
      csCounter,
      tok
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
    (address[] memory _iToken, ) = getInputToken(aFiContract);
    uint256 depTok;
    uint uTokensDecimal;
    uint256 price;
    uint256 multiplier;

    for (uint i = 0; i < _iToken.length; i++) {
      (depTok) = getPreDepVAlueFromStorage(
        address(aFiContract),
        _aFiStorage,
        cSwapCounter,
        address(_iToken[i])
      );
      if (depTok > 0) {
        uTokensDecimal = IERC20(_iToken[i]).decimals();
        (price, multiplier) = _aFiStorage.getPriceInUSD(_iToken[i]);

        validateGreaterEqual(18, uTokensDecimal);
        uTokensDecimal = 18 - uTokensDecimal;
        totalPreDepositInUSD += (((depTok) * (10 ** uTokensDecimal) * (uint(price))) / (10**multiplier));
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

    _aFiStorage._withdrawAll(address(aFiContract), uTokenToRemove, new bytes(0));

    // Update input token data after removing the uToken
    (
      address[] memory inputStables,
      address[] memory nonOverlappingITokens
    ) = getInputToken(aFiContract);
 
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
    uint256 stableamountOut,
    bytes calldata firstIterationUnderlyingSwap
  ) external nonReentrant contractUnpaused {
    compareAddress(msg.sender, rebalanceController);

    (address[] memory inputStables, ) = getInputToken(aFiContract);
    (, bool present) = ArrayUtils.indexOf(inputStables, depositTok);
    checkStatus(!present);

    rebalanceInternal(aFiContract, _aFiStorage, uTokenToRemove, defProp);

    (, rebal, ) = IAFi(aFiContract).getTVLandRebalContractandType();

    uint256 balToConsider = convertToStable(
      aFiContract,
      uTokenToRemove,
      depositTok,
      deadline,
      stableamountOut,
      firstIterationUnderlyingSwap
    );

    uint256 csCounter = aFiContract.getcSwapCounter();

    if(uTokenToRemove == depositTok){
      balToConsider = getPreDepVAlueFromStorage(
        address(aFiContract),
        _aFiStorage,
        csCounter,
        uTokenToRemove
      );
    }

    balToConsider = balance(depositTok, address(aFiContract)) - balToConsider;

    _aFiStorage.setPreDepositedInputTokenInRebalance(
      address(aFiContract),
      csCounter,
      balToConsider,
      depositTok
    );

    setUntrackedTokToPredep(
      address(aFiContract), 
      inputStables
    );

    isQueueWithdrawUnstakingPaused[address(aFiContract)] = true;
  }

  function setUntrackedTokToPredep(address afiContract, address[] memory iTokens) internal {
    IUniswapOracleV3(afiOracle).untrackedTokenSetByManager(
      afiContract, 
      iTokens,
      IAFi(afiContract).getUTokens(), 
      IAFi(afiContract).getcSwapCounter()
    );
  }

  function pauseQueueWithdrawUnstaking(address afiContract, bool status) external {
    compareAddress(msg.sender, afiOracle);
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
    uint256 managerFee,
    address feeOToken,
    IAFi.SwapParameters memory csParams,
    IAFi.SwapDataStructure calldata dexdata,
    uint256 csMinAmountOut
  ) external contractUnpaused {
    compareAddress(msg.sender, rebalanceController);
    compareInt(aFiContract.getUTokens().length, 0);
    validateGreaterEqual(10, uTokens.length);
    checkProductType((aFiContract));

    IAFi.UnderlyingData memory underlyingUniData = abi.decode(
      uniData,
      (IAFi.UnderlyingData)
    );
    updateAFiData(aFiContract, uTokens, defaultProp, currentProp);
    (, rebal, ) = IAFi(aFiContract).getTVLandRebalContractandType();
    (address[] memory iToken, ) = getInputToken(aFiContract);
    IPassiveRebal(rebal).initUniStructure(iToken, uniData);
    IPassiveRebal(rebal).updateMidToken(
      underlyingUniData._underlyingTokens,
      underlyingUniData._underlyingUniPoolToken
    );
    for (uint256 i; i < uTokens.length; i++) {
      IPassiveRebal(rebal).updateOracleData(
        underlyingUniData._underlyingTokens[i],
        oracles[i]
      );
    }
   
    reinitializeInternal(feeOToken, aFiContract, _aFiStorage, managerFee);
    csParams.cSwapFee = 0;
    doCswap(aFiContract, csParams, _aFiStorage, dexdata, csMinAmountOut);
  }

  function reinitializeInternal(address _feeOToken, IAFi aFiContract, IAFiStorage _aFiStorage, uint256 managerFee) internal {
    uint256 balToDeduct = balance(_feeOToken, address(aFiContract));
    checkRebalFeesandDeduct(managerFee, _feeOToken, aFiContract, _aFiStorage);
    balToDeduct = balToDeduct - balance(_feeOToken, address(aFiContract));
    _aFiStorage.setPreDepositedInputTokenInReInitialize(
      address(aFiContract),
      aFiContract.getcSwapCounter(),
      balToDeduct,
      _feeOToken
    );
    aFiContract.reinitializeHappened(true);
  }

  function convertToStable(
    IAFi aFiContract,
    address uTokenToRemove,
    address depositTok,
    uint256 deadline,
    uint256 stableamountOut,
    bytes calldata firstIterationUnderlyingSwap
  ) internal returns (uint256 _stableBalToConsider) {
    validateGreater(balance(uTokenToRemove, address(aFiContract)), 0);

    // To avoid stack too deep error
    // Get Deposit token back from the UToken that is going to be rebalanced
    address midTok = getMidToken(uTokenToRemove);
    _stableBalToConsider = balance(depositTok, address(aFiContract));

    if(uTokenToRemove != depositTok){
      aFiManagerSwap(
        uTokenToRemove,
        depositTok,
        balance(uTokenToRemove, address(aFiContract)),
        aFiContract,
        deadline,
        midTok,
        stableamountOut,
        firstIterationUnderlyingSwap
      );
    }
  }

  function getMidToken(address token) internal view returns(address){
    return IPassiveRebal(rebal).getMidToken(token);
  }
  
  function getInputToken(IAFi aFiContract) internal view returns(address[] memory inputStables, address[] memory nonOverlappingITokens) {
    (inputStables, nonOverlappingITokens) = IAFi(
      aFiContract
    ).getInputToken();
  }
}