// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma abicoder v2;

import {IAFiStorage} from "./Interfaces/IAFiStorage.sol";
import {OwnableDelayModule} from "./Interfaces/OwnableDelayModule.sol";
import {ReentrancyGuard} from "./Interfaces/ReentrancyGuard.sol";
import {SafeERC20} from "./Interfaces/SafeERC20.sol";
import {SafeCast} from "./Interfaces/SafeCast.sol";
import {ILendingPool} from "./Interfaces/ILendingPool.sol";
import {IPoolAddressesProvider} from "./Interfaces/ILendingPoolAddressesProvider.sol";
import {ISwapRouter} from "./Interfaces/ISwapRouter.sol";
import {IUniswapOracleV3} from "./Interfaces/IUniswapV3.sol";
import "./Interfaces/IAFi.sol";
import "./Interfaces/IPassiveRebal.sol";
import "./Libraries/ArrayUtils.sol";
import "./Interfaces/IUniswapV3Factory.sol";
import {ERC20} from "./Interfaces/ERC20.sol";

interface Compound {
  function mint(uint mintAmount) external returns (uint);

  function redeem(uint redeemTokens) external returns (uint);

  function redeemUnderlying(uint redeemAmount) external returns (uint);

  function exchangeRateStored() external view returns (uint);
}

interface CompoundV3 {
  function supply(address asset, uint amount) external;

  function withdraw(address asset, uint amount) external;
}

interface IAFiFactory {
  function setIfUserInvesting(address user, address afiContract) external;

  function hasUserInvestedAlready(
    address afiContract,
    address user
  ) external view returns (bool);

  function withdrawAndResetInvestmentStatus(address user, address afiContract) external;

  function afiContractInitUpdate(address aFiContract, uint order) external;
}

interface LendingPoolAddressesProvider {
  function getLendingPool() external view returns (address);

  function getLendingPoolCore() external view returns (address);
}

contract AFiVariableStorage {
  uint internal pool;
  address[] internal token; // deposit stable coin
  mapping(address => address) internal compound; // compound address for various u tokens
  mapping(address => address) internal aaveToken; // aaveToken address for various u tokens
  mapping(address => uint) internal depositNAV;
  address payable internal platformWallet =
    payable(0xB60C61DBb7456f024f9338c739B02Be68e3F545C);
  mapping(address => bool) internal whitelistedTokens;
  address[] internal uTokens;
  uint[] internal uTokenProportions;
  uint[] internal defaultProportion;
}

contract ParentAFiBase is
  ERC20,
  ReentrancyGuard,
  OwnableDelayModule,
  AFiVariableStorage,
  IAFi
{
  using SafeERC20 for IERC20;
  using ArrayUtils for uint[];
  using ArrayUtils for address[];
  using SafeCast for uint256;
  IPassiveRebal internal rebalContract;
  IAFiStorage internal aFiStorage;
  address internal aFiManager;
  bool internal depositPaused;
  bool internal withdrawPaused;
  address internal pauseDepositController;
  bool public vaultReInitialized;
  uint internal typeOfProduct;
  bool internal isBase;
  bool public isAfiTransferrable; // true if AFi tokens are transferrable
  address internal factory;
  address internal aFiOracle;
  uint256 internal cSwapCounter;
  uint256 internal preSwapDepositLimit;
  mapping(address => mapping(uint => uint)) public nonWithdrawableShares;
  address[] internal nonOverlappingITokens; // Tokens that are not common between underlying and input tokens
  uint8 public tvlUpdated;
  uint256 public lastTVLupdate;
  uint256 public tvlUpdatePeriod;

  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  address private constant POOL_ADDRESS_PROVIDER =
    0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e;

  ISwapRouter internal constant UNISWAP_EXCHANGE =
    ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

  mapping(address => address) public compoundV3Comet;

  address public tLContract;
  mapping(address => uint256) public userLockedAmount;
  mapping(address => bool) public isPausedForWithdrawals; // true if deposit token is paused(users can't withdraw in this token)

  event SetInitialValues(address indexed afiContract);
  event UpdateShares(address user, uint256 amount, bool lock);
  event Deposit(address indexed investor, uint256 amount, address depToken);
  event Withdraw(address indexed investor, uint256 amount, address withdrawnToken);
  event Initialized(address indexed afiContract);
  event InitializedToken(address indexed afiContract);
  event SupplyCompV3(address indexed afiContract, address tok, uint amount);
  event SupplyAave(address indexed afiContract, address tok, uint amount);
  event SupplyCompound(address indexed afiContract, address tok, uint amount);
  event WithdrawAave(address indexed afiContract, address tok, uint amount);
  event WithdrawCompound(address indexed afiContract, address tok, uint amount);
  event WithdrawCompoundV3(address indexed afiContract, address tok, uint amount);
  event UpdatePoolData(address indexed afiContract, bytes data);

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

  function initialize(
    address newOwner,
    string memory tokenName,
    string memory tokenSymbol,
    bytes memory data,
    bool _isActiveRebalanced,
    IAFiStorage _aFiStorage,
    address[] memory _nonOverlappingITokens
  ) external override nonReentrant {
    checkFalse(isBase);
    addressCheck(newOwner, address(0));
    _name = tokenName;
    _symbol = tokenSymbol;
    _transferOwnership(newOwner);
    delayModule = newOwner;
    aFiStorage = _aFiStorage;
    aFiOracle = aFiStorage.getAFiOracle();
    nonOverlappingITokens = _nonOverlappingITokens;
    IAFi.PoolsData memory pooldata = abi.decode(data, (IAFi.PoolsData));
    typeOfProduct = pooldata._typeOfProduct;
    preSwapDepositLimit = 1e20;
    factory = msg.sender;
    setInitialValues(data);
    defaultProportion = uTokenProportions;
    IAFiStorage(_aFiStorage).setAFiActive(address(this), true);
    IAFiStorage(_aFiStorage).setActiveRebalancedStatus(
      address(this),
      _isActiveRebalanced
    );

    IAFiFactory(factory).afiContractInitUpdate(address(this), 1);

    emit Initialized(address(this));
  }

  function initializeToken(
    address[] memory iToken,
    address[] memory _teamWallets,
    IPassiveRebal _rebalContract,
    address _aFiManager
  ) external override nonReentrant {
    checkFalse(isBase);
    isBase = true;
    aFiManager = _aFiManager;
    rebalContract = _rebalContract;
    aFiStorage.setTeamWallets(address(this), _teamWallets);
    uint iLen = iToken.length;
    unchecked {
      for (uint i = 0; i < iLen; i++) {
        updatetoken(iToken[i]);
        whitelistedTokens[iToken[i]] = true;
      }
    }
    IAFiFactory(factory).afiContractInitUpdate(address(this), 2);
    emit InitializedToken(address(this));
  }

  function updatetoken(address tok) internal {
    token.push(tok);
    safeApproveERC20(tok, aFiOracle, ~uint(0));
  }

  function getcSwapCounter() external view override returns (uint256) {
    return cSwapCounter;
  }

  function transferValidationAndSet(address from, address to, uint256 amount) internal {
    checkFalse(!isAfiTransferrable);
    address owner = from;

    require(
      amount <=
        (_balances[owner] -
          (userLockedAmount[owner] + nonWithdrawableShares[owner][cSwapCounter])),
      "AB333"
    );

    depositNAV[to] =
      ((depositNAV[to] * _balances[to]) + (depositNAV[owner] * amount)) /
      (_balances[to] + amount);
  }

  function checkNav(address target) internal {
    if (_balances[target] == 0) {
      delete depositNAV[target];
    }
  }

  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    transferValidationAndSet(_msgSender(), to, amount);
    _transfer(_msgSender(), to, amount);
    checkNav(_msgSender());
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    transferValidationAndSet(from, to, amount);
    address spender = _msgSender();
    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    checkNav(from);
    return true;
  }

  function setAfiTransferability(bool _afiTransferrable) external onlyOwner {
    isAfiTransferrable = _afiTransferrable;
  }

  function reinitializeHappened(bool status) external override {
    twoAddressCompare(aFiManager, aFiOracle);
    vaultReInitialized = status;
  }

  function setRebalanceController(address _pauseDepositController) external onlyOwner {
    addressCheck(_pauseDepositController, address(0));
    pauseDepositController = _pauseDepositController;
  }

  function getRebalanceController() external view returns (address) {
    return pauseDepositController;
  }

  /**
   * @notice Pauses / unpause deposits in the contract.
   * @dev Requirements: Can only be invoked by the Owner wallet.
   */
  function pauseUnpauseDeposit(bool status) external {
    twoAddressCompare(pauseDepositController, aFiOracle);
    depositPaused = status;
  }

  /**
   * @notice Pauses / unpause withdrawals in the contract.
   * @dev Requirements: Can only be invoked by the Delay Module.
   */
  function pauseWithdraw(bool status) external {
    checkDelayModule();
    withdrawPaused = status;
  }

  /**
   * @notice Returns the paused status of the contract.
   */
  function isPaused() external view override returns (bool, bool) {
    return (depositPaused, withdrawPaused);
  }

  /**
   * @notice To update the platform wallet address and zero address should not pass.
   * @dev Requirements: It can be invoked only by the owner.
   * @param _platformWallet Address of the platform wallet.
   */
  function setplatformWallet(address payable _platformWallet) external onlyOwner {
    addressCheck(_platformWallet, address(0));
    platformWallet = _platformWallet;
  }

  function getplatformWallet() external view returns (address) {
    return platformWallet;
  }

  function getPreSwapDepositLimit() external view override returns (uint256) {
    return preSwapDepositLimit;
  }

  function getTVLandRebalContractandType()
    external
    view
    override
    returns (uint256, address, uint256)
  {
    return (pool, address(rebalContract), typeOfProduct);
  }

  function checkFalse(bool flag) internal pure {
    require(!flag, "AB03");
  }

  function addressEqual(address add1, address add2) internal pure {
    require(add1 == add2, "AB30");
  }

  function twoAddressCompare(address add1, address add2) internal view {
    require(msg.sender == add1 || msg.sender == add2, "AB32");
  }

  function addressCheck(address add1, address add2) internal pure {
    require(add1 != add2, "AB05"); //solhint-disable-line reason-string
  }

  function greaterComparison(uint256 valA, uint256 valB) internal pure {
    require(valA >= valB, "AB24");
  }

  function togglePauseDepositTokenForWithdrawals(
    address tok,
    bool _pause
  ) external onlyOwner {
    if (_pause) {
      checkFalse(!whitelistedTokens[tok]);
    } else {
      checkFalse(!isPausedForWithdrawals[tok]);
    }
    isPausedForWithdrawals[tok] = _pause;
  }

  function safeApproveERC20(address tok, address spender, uint amount) internal {
    IERC20(tok).safeApprove(spender, amount);
  }

  function addToWhitelist(address tok) external onlyOwner {
    checkFalse(whitelistedTokens[tok]);
    (, bool isPresent) = token.indexOf(tok);
    (, bool isInputTokenPresent) = uTokens.indexOf(tok);
    if (!isPresent) {
      updatetoken(tok);
    }
    // Prevent duplication in nonOverlappingITokens
    (, bool isAlreadyInNonOverlapping) = nonOverlappingITokens.indexOf(tok);
    if (!isInputTokenPresent && !isAlreadyInNonOverlapping) {
      nonOverlappingITokens.push(tok);
    }
    whitelistedTokens[tok] = true;
  }

  function getPreDepositTokensBalance(
    address tok,
    uint256 _cSwapCounter
  ) internal view returns (uint) {
    return aFiStorage.getPreSwapDepositsTokens(address(this), _cSwapCounter, tok);
  }

  function removeFromWhitelist(
    address tok,
    address swapTok,
    uint256 deadline,
    uint256 amountOut
  ) external onlyOwner {
    checkFalse(!whitelistedTokens[tok]);
    checkFalse(!whitelistedTokens[swapTok]);
    delete whitelistedTokens[tok];
    if (getPreDepositTokensBalance(tok, cSwapCounter) > 0) {
      addressCheck(tok, swapTok);
      aFiStorage.doSwapForThewhiteListRemoval(
        tok,
        cSwapCounter,
        swapTok,
        deadline,
        amountOut
      );
    }

    token = rebalContract.removeToken(token, tok);
    safeApproveERC20(tok, aFiOracle, 0);

    // Remove tok from nonOverlappingITokens if present
    nonOverlappingITokens = rebalContract.removeToken(nonOverlappingITokens, tok);
  }

  function updateTVLUpdatePeriod(uint256 _tvlUpdatePeriod) external {
    checkDelayModule();
    tvlUpdatePeriod = _tvlUpdatePeriod;
  }

  function updatePool(uint256 _pool) external {
    (address cumulativeSwapController, ) = IUniswapOracleV3(aFiOracle).getControllers(
      address(this)
    );
    addressEqual(msg.sender, cumulativeSwapController);
    tvlDataUpdate(_pool);
  }

  function tvlDataUpdate(uint256 _tvl) internal {
    pool = _tvl;
    tvlUpdated = 1;
    lastTVLupdate = block.timestamp;
  }

  function checkTVL(bool _updateTVL) public override {
    if (tvlUpdated == 0 || (block.timestamp - lastTVLupdate) > tvlUpdatePeriod) {
      if (_updateTVL) {
        tvlDataUpdate(aFiStorage.calculatePoolInUsd(address(this)));
      } else {
        revert("AB111");
      }
    } else {
      delete tvlUpdated;
    }
  }

  function contractTransfers(address tok, address to, uint256 amount) private {
    IERC20(tok).safeTransfer(to, amount);
  }

  /**
   * @notice Stakes underlying tokens.
   * @dev This function is used to stake underlying tokens, triggering certain operations such as token conversion and rebalancing.
   * @param _depositTokens An array containing addresses of tokens to be deposited.
   */
  function underlyingTokensStaking(
    address[] memory _depositTokens
  ) external override returns (uint256 _totalProp) {
    checkOracle();
    uint256 toSwap;

    for (uint i = 0; i < _depositTokens.length; i++) {
      toSwap += aFiStorage.convertInUSDAndTok(
        _depositTokens[i],
        getPreDepositTokensBalance(_depositTokens[i], cSwapCounter),
        false
      );
    }

    greaterComparison(toSwap, preSwapDepositLimit);
    uint strategy = rebalContract.getRebalStrategyNumber(address(this));
    // Rebal block starts
    if (
      strategy == 1 && cSwapCounter > 0 && !vaultReInitialized
    ) {
      (uTokenProportions, _totalProp) = rebalContract.applyRebalForProportions(
        address(this),
        aFiManager,
        address(aFiStorage),
        uTokens,
        strategy
      );
    } else if (cSwapCounter == 0 || vaultReInitialized) {
      _totalProp = 10000000;
    }
    if (vaultReInitialized) {
      vaultReInitialized = false;
    }
    cSwapCounter++;
    delete tvlUpdated;
  }

  function swap(
    address inputToken,
    address uTok,
    uint256 amountAsPerProportion,
    uint _deadline,
    address middleToken,
    uint256 minimumReturnAmount
  ) external override returns (uint256) {
    checkOracle();

    if (inputToken != uTok && middleToken == address(0)) {
      return
        _uniswapV3Router(
          inputToken,
          uTok,
          amountAsPerProportion,
          _deadline,
          IUniswapOracleV3(aFiOracle).getMidToken(uTok),
          minimumReturnAmount
        );
    } else if (inputToken != uTok) {
      return
        _uniswapV3Router(
          inputToken,
          uTok,
          amountAsPerProportion,
          _deadline,
          middleToken,
          minimumReturnAmount
        );
    }
  }

  function isOTokenWhitelisted(address oToken) external view override returns (bool) {
    return whitelistedTokens[oToken];
  }

  function deposit(uint amount, address iToken, bool _updateTVL) external nonReentrant {
    greaterComparison((amount / (10 ** (IERC20(iToken).decimals()))), 100);
    checkTVL(_updateTVL);
    uint256 prevPool = pool;
    checkFalse(!whitelistedTokens[iToken]); // Added validation to check if the token is whitelisted
    checkFalse(depositPaused);
    IERC20(iToken).safeTransferFrom(msg.sender, address(this), amount);
    uint256 fee = (amount * 1) / (100); // 1% platform fees is deducted
    contractTransfers(iToken, platformWallet, fee);
    amount = amount - fee;
    aFiStorage.setPreDepositedInputToken(cSwapCounter, amount, iToken);

    (uint256 shares, uint256 newDepositNAV) = aFiStorage.calculateShares(
      address(this),
      amount, // assuming amount is defined somewhere
      prevPool,
      _totalSupply,
      iToken, // assuming iToken is defined somewhere
      depositNAV[msg.sender],
      _balances[msg.sender]
    );

    depositNAV[msg.sender] = newDepositNAV;
    _mint(msg.sender, shares);
    nonWithdrawableShares[msg.sender][cSwapCounter] += shares;

    emit Deposit(msg.sender, amount, iToken);
  }

  function validateWithdraw(
    address user,
    address oToken,
    uint256 _shares
  ) public view override {
    checkFalse(!whitelistedTokens[oToken]); // Added validation to check if the token is whitelisted
    checkFalse(isPausedForWithdrawals[oToken]);
    validateShares(user, _shares);
    greaterComparison(_shares, 1e17);
  }

  function validateShares(address user, uint256 _shares) internal view {
    greaterComparison(
      _balances[user] -
        (userLockedAmount[user] + nonWithdrawableShares[user][cSwapCounter]),
      _shares
    );
  }

  function withdraw(
    uint _shares,
    address oToken,
    uint deadline,
    uint[] memory minimumReturnAmount,
    bool _updateTVL,
    uint swapMethod
  ) external nonReentrant {
    require(!(aFiStorage.isSwapMethodPaused(address(this), swapMethod)), "AB011"); // Check if the swap method is paused
    checkFalse(withdrawPaused);
    validateWithdraw(msg.sender, oToken, _shares);
    checkTVL(_updateTVL);

    // Calculate the redemption amount before updating balances
    uint r = (pool * (_shares)) / (_totalSupply);

    IAFiStorage.RedemptionParams memory params = IAFiStorage.RedemptionParams({
      baseContract: address(this),
      r: r,
      oToken: oToken,
      cSwapCounter: cSwapCounter,
      uTokens: uTokens,
      iTokens: token,
      deadline: deadline,
      minimumReturnAmount: minimumReturnAmount,
      _pool: pool,
      tSupply: _totalSupply,
      depositNAV: depositNAV[msg.sender]
    });

    uint256 redFromContract = aFiStorage.handleRedemption(params, _shares, swapMethod);

    burn(msg.sender, _shares);
    greaterComparison(balance(oToken, address(this)), redFromContract);
    checkNav(msg.sender);

    contractTransfers(oToken, msg.sender, redFromContract);
    emit Withdraw(msg.sender, _shares, oToken);
  }

  function burn(address account, uint256 amount) internal {
    _balances[account] -= amount;
    _totalSupply -= amount;
    emit Transfer(account, address(0), amount);
  }

  function compareManagerAndStorage() internal view {
    twoAddressCompare(aFiManager, address(aFiStorage));
  }

  /**
   * @notice Executes a token swap using Uniswap V3 via either the AFiStorage or AFiManager contract.
   * @dev This function initiates a token swap operation through Uniswap V3, utilizing the provided parameters.
   * @param from The address of the token to swap from.
   * @param to The address of the token to receive.
   * @param amount The amount of tokens to swap.
   * @param deadline The deadline by which the swap must be executed.
   * @param midTok The address of the intermediary token for the swap.
   * @param minimumReturnAmount The minimum amount of tokens expected to receive from the swap.
   * @return _amountOut The amount of tokens received from the swap operation.
   */
  function swapViaStorageOrManager(
    address from,
    address to,
    uint amount,
    uint deadline,
    address midTok,
    uint minimumReturnAmount
  ) external override returns (uint256 _amountOut) {
    compareManagerAndStorage();
    _amountOut = _uniswapV3Router(
      from,
      to,
      amount,
      deadline,
      midTok,
      minimumReturnAmount
    );
  }

  function _uniswapV3Router(
    address _tokenIn,
    address _tokenOut,
    uint _amountIn,
    uint _maxTime,
    address middleToken,
    uint256 minimumReturnAmount
  ) internal returns (uint amountOut) {
    //approval
    approval(_tokenIn, address(UNISWAP_EXCHANGE), _amountIn);
    if (
      _tokenIn == WETH ||
      _tokenOut == WETH ||
      _tokenIn == middleToken ||
      _tokenOut == middleToken
    ) {
      bytes memory swapParams = rebalContract.uniswapV3Oracle(
        address(this),
        _tokenIn,
        _tokenOut,
        _amountIn,
        _maxTime,
        middleToken,
        minimumReturnAmount
      );
      ISwapRouter.ExactInputSingleParams memory params = abi.decode(
        swapParams,
        (ISwapRouter.ExactInputSingleParams)
      );
      amountOut = UNISWAP_EXCHANGE.exactInputSingle(params);
    } else {
      bytes memory swapParams = rebalContract.uniswapV3Oracle(
        address(this),
        _tokenIn,
        _tokenOut,
        _amountIn,
        _maxTime,
        middleToken,
        minimumReturnAmount
      );
      ISwapRouter.ExactInputParams memory params = abi.decode(
        swapParams,
        (ISwapRouter.ExactInputParams)
      );
      amountOut = UNISWAP_EXCHANGE.exactInput(params);
    }
    greaterComparison(amountOut, minimumReturnAmount);
  }

  /**
   * @notice Function sends profit to wallets in the process of proffir share.
   * @param wallet address to send profit to.
   * @param profitShare i.e. amount to be transferred.
   * @param oToken address of the token to consider for amount deduction.
   */
  function sendProfitOrFeeToManager(
    address wallet,
    uint profitShare,
    address oToken
  ) external override {
    compareManagerAndStorage();
    contractTransfers(oToken, wallet, profitShare);
  }

  function checkStorage() internal view {
    addressEqual(msg.sender, address(aFiStorage));
  }

  /**
   * @notice _supplyCompV3 function supply the fund of token to Compound V3 protocol for yield generation.
   * @dev this function should be called by AFiStorage only
   * @param tok address of the token to consider for supply.
   * @param amount i.e calculated amount of token to invest.
   */
  function _supplyCompV3(address tok, uint amount) external override {
    checkStorage();
    //approval
    approval(tok, compoundV3Comet[tok], amount);
    CompoundV3(compoundV3Comet[tok]).supply(tok, amount);
    emit SupplyCompV3(address(this), tok, amount);
  }

  /**
   * @notice _withdrawCompoundV3 function withdraws the fund of token from CompoundV3 protocol.
   * @param tok address of the token to consider to withdraw.
   * @param amount i.e calculated amount of token to withdraw.
   */
  function _withdrawCompoundV3(address tok, uint amount) external override {
    checkStorage();
    CompoundV3(compoundV3Comet[tok]).withdraw(tok, amount);
    emit WithdrawCompoundV3(address(this), tok, amount);
  }

  /**
   * @notice _supplyAave function supply the fund of token to AAVe protocol for yield generation.
   * @dev this function should be called by AFiStorage only
   * @param tok address of the token to consider for supply.
   * @param amount i.e calculated amount of token to invest.
   */
  function _supplyAave(address tok, uint amount) external override {
    checkStorage();
    //approval
    approval(tok, address(_lendingPool()), amount);
    _lendingPool().deposit(tok, amount, address(this), 0);
    emit SupplyAave(address(this), tok, amount);
  }

  /**
   * @notice _supplyCompound function supply the fund of token to Compound protocol for yield generation.
   * @dev this function should be called by AFiStorage only
   * @param tok address of the token to consider for supply.
   * @param amount i.e calculated amount of token to invest.
   */
  function _supplyCompound(address tok, uint amount) external override {
    checkStorage();
    //approval
    approval(tok, compound[tok], amount);
    require(Compound(compound[tok]).mint(amount) == 0, "AB18");
    emit SupplyCompound(address(this), tok, amount);
  }

  function approval(address tok, address sender, uint256 amount) internal {
    uint256 allowance = IERC20(tok).allowance(address(this), sender);
    if (allowance < amount) {
      IERC20(tok).safeIncreaseAllowance(sender, (amount - allowance));
    }
  }

  /**
   * @notice _withdrawAave function withdraws the fund of token from AAve protocol.
   * @param tok address of the token to consider to withdraw.
   * @param amount i.e calculated amount of token to withdraw.
   */
  function _withdrawAave(address tok, uint amount) external override {
    checkStorage();
    _lendingPool().withdraw(tok, amount, address(this));
    emit WithdrawAave(address(this), tok, amount);
  }

  /**
   * @notice _withdrawCompound function withdraws the fund of token from Compound protocol.
   * @param tok address of the token to consider to withdraw.
   * @param amount i.e calculated amount of token to withdraw.
   */
  function _withdrawCompound(address tok, uint amount) external override {
    checkStorage();
    require(Compound(compound[tok]).redeemUnderlying(amount) == 0, "AB20");
    emit WithdrawCompound(address(this), tok, amount);
  }

  /**
   * @notice updatePoolData function updates the pool data in the process of rebalance.
   * @param data encoded data to update.
   */
  function updatePoolData(bytes memory data) external override nonReentrant {
    checkManager();
    setInitialValues(data);
    emit UpdatePoolData(address(this), data);
  }

  /**
   * @notice Returns the array of underlying tokens.
   * @return uTokensArray Array of underlying tokens.
   */
  function getUTokens() external view override returns (address[] memory uTokensArray) {
    return uTokens;
  }

  function getProportions()
    external
    view
    override
    returns (uint[] memory, uint[] memory)
  {
    return (uTokenProportions, defaultProportion);
  }

  /**
   * @notice Sets unstaking data and returns necessary information.
   * @dev This function is used to set unstaking data and returns relevant information.
   * @param totalQueuedShares The total number of queued shares for unstaking.
   * @return token An array containing token addresses.
   * @return uTokens An array containing addresses of underlying tokens.
   * @return pool The address of the pool.
   * @return tSupply The total supply of tokens after considering queued shares.
   */
  function setUnstakeData(
    uint256 totalQueuedShares
  ) external override returns (address[] memory, address[] memory, uint256, uint256) {
    checkOracle();
    uint256 tSupply = _totalSupply;
    if (totalQueuedShares != 0) {
      _totalSupply -= totalQueuedShares;
    }
    return (token, uTokens, pool, tSupply);
  }

  /**
   * @notice Retrieves input tokens.
   * @dev This function is used to retrieve input token addresses and non-overlapping input token addresses.
   * @return token An array containing input token addresses.
   * @return nonOverlappingITokens An array containing non-overlapping input token addresses.
   */
  function getInputToken()
    external
    view
    override
    returns (address[] memory, address[] memory)
  {
    return (token, nonOverlappingITokens);
  }

  /**
   * @notice setInitialValues function initialises the pool and afi product data
   * @param data  i.e encoded data that contains pool, product data.
   */
  function setInitialValues(bytes memory data) internal {
    IAFi.PoolsData memory pooldata = abi.decode(data, (IAFi.PoolsData));
    IAFi.UnderlyingData memory uData = abi.decode(
      pooldata.underlyingData,
      (IAFi.UnderlyingData)
    );

    address tok;
    uint uLen = uData._underlyingTokens.length;
    for (uint i = 0; i < uLen; i++) {
      tok = uData._underlyingTokens[i];
      uTokens.push(uData._underlyingTokens[i]);
      uTokenProportions.push(pooldata._underlyingTokensProportion[i]);
      aaveToken[tok] = pooldata._aaveToken[i];
      compound[tok] = pooldata._compound[i];
      compoundV3Comet[tok] = pooldata.compoundV3Comet[i];
      aFiStorage.afiSync(
        address(this),
        tok,
        aaveToken[tok],
        compoundV3Comet[tok],
        compound[tok]
      );
    }

    emit SetInitialValues(address(this));
  }

  function updateuTokAndProp(address[] memory _uTokens) external override {
    checkManager();
    uTokens = _uTokens;
  }

  function checkManager() internal {
    addressEqual(msg.sender, aFiManager);
  }

  /**
   * @notice updateDp Function updates the default proportion after rebalance
   * @dev it should be called by the AFiManager contract only.
   * @param _defaultProportion i.e array of new default proportion
   */
  function updateDp(
    uint256[] memory _defaultProportion,
    uint256[] memory _uTokensProportion
  ) external override {
    checkManager();
    uTokenProportions = _uTokensProportion;
    defaultProportion = _defaultProportion;
  }

  /// @notice Retrieves Aave LendingPool address
  /// @return A reference to LendingPool interface
  function _lendingPool() internal view returns (ILendingPool) {
    return ILendingPool(IPoolAddressesProvider(POOL_ADDRESS_PROVIDER).getPool());
  }

  function checkOracle() internal {
    addressEqual(msg.sender, aFiOracle);
  }

  /**
   * @notice updateShares Function locks/unlocks afi token
   * @dev it should be called by the time lock contract only.
   * @param user address to lock the afi token from.
   * @param amount i.e. amount to be locked/unlocked.
   * @param lock i.e. status if amount should be locked or unlocked.
   */
  function stakeShares(address user, uint256 amount, bool lock) external {
    addressCheck(user, tLContract);
    if (lock) {
      validateShares(user, amount);
    } else {
      greaterComparison(userLockedAmount[user], amount);
    }
    updateLockedTokens(user, amount, lock, false, false, 0);
    emit UpdateShares(user, amount, lock);
  }

  function updateLockedTokens(
    address user,
    uint256 amount,
    bool lock,
    bool queue,
    bool unqueue,
    uint256 newNAV
  ) public override {
    twoAddressCompare(tLContract, aFiOracle);
    if (msg.sender == tLContract) {
      if (lock) {
        userLockedAmount[user] = userLockedAmount[user] + (amount);
      } else {
        userLockedAmount[user] = userLockedAmount[user] - (amount);
      }
    }

    if (queue) {
      _balances[user] -= amount;
      if (_balances[user] == 0 && userLockedAmount[user] == 0) {
        delete depositNAV[user];
      }
      emit Transfer(user, address(0), amount);
    }
    if (unqueue) {
      depositNAV[user] = newNAV;
      _balances[user] += amount;
      emit Transfer(address(0), user, amount);
    }
  }

  /**
   * @notice updateTimeLockContract Function updates timelock contract address and zero address should not pass
   * @param newTL address of the timelock contract.
   */
  function updateTimeLockContract(address newTL) external onlyOwner {
    addressCheck(newTL, address(0));
    tLContract = newTL;
  }

  /**
   * @notice Allows the owner to emergency withdraw tokens from the contract.
   * @dev Only the platform wallet can call this function.
   * @param tok Address of the token to be withdrawn.
   * @param wallet Address to receive the withdrawn tokens.
   */

  function emergencyWithdraw(address tok, address wallet) external {
    checkDelayModule();
    (, bool present) = uTokens.indexOf(tok);
    (, bool iPresent) = token.indexOf(tok);
    checkFalse(present);
    checkFalse(iPresent);
    contractTransfers(tok, wallet, balance(tok, address(this)));
  }

  function checkDelayModule() internal {
    addressEqual(msg.sender, delayModule);
  }

  /**
   * @notice Returns the balance of a specific token in the AFi contract.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return The token balance.
   */
  function balance(address tok, address afiContract) internal view returns (uint) {
    return IERC20(tok).balanceOf(afiContract);
  }

  /**
   * @notice Updates the list of input tokens for the contract.
   * @dev Only the contract owner can call this function.
   * @param _nonOverlappingITokens Array of addresses representing input tokens.
   */
  function updateInputTokens(
    address[] memory _nonOverlappingITokens
  ) external override {
    twoAddressCompare(owner(), aFiManager);
    nonOverlappingITokens = _nonOverlappingITokens;
  }

  /**
   * @notice Updates the limit for pre-swap deposits.
   * @dev Only the contract owner can call this function.
   * @param _preSwapDepositLimit New limit for pre-swap deposits.
   */
  function updatePreSwapDepositLimit(uint256 _preSwapDepositLimit) external onlyOwner {
    preSwapDepositLimit = _preSwapDepositLimit;
  }

  /**
   * @notice Returns the NAV (Net Asset Value) of a user's deposited funds.
   * @param user Address of the user.
   * @return The NAV of the user's deposited funds.
   */
  function depositUserNav(address user) external view override returns (uint256) {
    if (_balances[user] == 0) {
      return 0;
    } else {
      return depositNAV[user];
    }
  }
}
