// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
pragma abicoder v2;

import {IAFiStorage} from "./IAFiStorage.sol";
import {OwnableDelayModule} from "./OwnableDelayModule.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import {SafeERC20} from "./SafeERC20.sol";
import {SafeCast} from "./SafeCast.sol";
import {ILendingPool} from "./ILendingPool.sol";
import {IPoolAddressesProvider} from "./ILendingPoolAddressesProvider.sol";
import {ISwapRouter} from "./ISwapRouter.sol";
import {IUniswapOracleV3} from "./IUniswapV3.sol";
import "./IAFi.sol";
import "./IPassiveRebal.sol";
import "./ArrayUtils.sol";
import "./IUniswapV3Factory.sol";
import {ERC20} from "./ERC20.sol";

interface IAFiDexAdapter {
    enum DexChoice { UNISWAP_V3, ODOS, NONE }
    function swap(
        address base,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 deadline,
        address middleToken,
        uint256 minimumReturnAmount,
        bytes calldata odosRouterSwapData
    ) external returns (uint256);
    function getDexChoice(address tokenIn, address tokenOut, bytes calldata odosRouterSwapData) external view returns (DexChoice);
    function uniswapRouter() external view returns (ISwapRouter);
    function odosRouter() external view returns (address);  
}


interface IAaveDistributor {
  function claim(
    address[] calldata users,
    address[] calldata tokens,
    uint256[] calldata amounts,
    bytes32[][] calldata proofs
  ) external;
}

interface IAFiFactory {
  
  function afiContractInitUpdate(address aFiContract, uint order) external;
}

interface LendingPoolAddressesProvider {
  function getLendingPool() external view returns (address);

  function getLendingPoolCore() external view returns (address);
}

contract AFiVariableStorage {
  uint internal pool;
  address payable internal platformWallet =
    payable(0xB60C61DBb7456f024f9338c739B02Be68e3F545C);
  address[] internal token; // deposit stable coin
  address[] internal uTokens;
  uint[] internal uTokenProportions;
  uint[] internal defaultProportion;
  mapping(address => address) internal pendleMarketPalace; // pendleMarketPalace address for various u tokens
  mapping(address => uint) internal depositNAV;
  mapping(address => bool) internal whitelistedTokens;
}

contract AtvBase is
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

  bool internal depositPaused;
  bool internal withdrawPaused;
  bool public migrated;
  bool public vaultReInitialized;
  bool internal isBase;
  bool public isAfiTransferrable; // true if AFi tokens are transferrable
  uint internal typeOfProduct;
  uint256 internal cSwapCounter;
  uint256 public minimumDepositLimit;
  address public dexAdapter; // Added for DEX adapter
  address public factory;
  address public aFiOracle;
  address public tLContract;
  address public PARENT_VAULT;
  IPassiveRebal public rebalContract;
  IAFiStorage public aFiStorage;
  address public aFiManager;
  address[] internal nonOverlappingITokens; // Tokens that are not common between underlying and input tokens
  address private constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
  address private constant POOL_ADDRESS_PROVIDER =
    0x5C2e738F6E27bCE0F7558051Bf90605dD6176900;
   address private constant PENDLE_ROUTER =
    0x888888888889758F76e7103c6CbF23ABbF58F946;
  IAaveDistributor internal constant MERKLE_DISTRIBUTOR = IAaveDistributor(0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae);         
  mapping(address => mapping(uint => uint)) internal nonWithdrawableShares;
  mapping(address => address) public compoundV3Comet;
  mapping(address => uint256) public userLockedAmount;
  mapping(address => bool) public isPausedForWithdrawals;

  event UpdateShares(address user, uint256 amount, bool lock);
  event Deposit(address indexed investor, uint256 amount, address depToken);
  event Withdraw(address indexed investor, uint256 amount, address withdrawnToken);
  event Initialized(address indexed afiContract);
  event InitializedToken(address indexed afiContract);

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

  function initialize(
    address newOwner,
    string memory tokenName,
    string memory tokenSymbol,
    bytes memory data,
    bool _isActiveRebalanced,
    IAFiStorage _aFiStorage,
    address[] memory _nonOverlappingITokens,
    address parentVault
  ) external override nonReentrant {
    checkFalse(isBase);
    PARENT_VAULT = parentVault;
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
    factory = msg.sender;
    setInitialValues(data);
    defaultProportion = uTokenProportions;
    IAFiStorage(_aFiStorage).setAFiActive(address(this), true);
    IAFiStorage(_aFiStorage).setActiveRebalancedStatus(
      address(this),
      _isActiveRebalanced
    );
    IAFiFactory(factory).afiContractInitUpdate(address(this), 1);
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
    minimumDepositLimit = 500;
    aFiStorage.setTeamWallets(address(this), _teamWallets);
    uint iLen = iToken.length;
    unchecked {
      for (uint i = 0; i < iLen; i++) {
        updatetoken(iToken[i]);
        setWhitelistedTok(iToken[i]);
      }
    }
    IAFiFactory(factory).afiContractInitUpdate(address(this), 2);
  }

  // Added invoke function for DEX adapter
  function invoke(
    address target,
    uint256 value,
    bytes calldata data
  ) external returns (bytes memory) {
    require(msg.sender == dexAdapter, "Only dexAdapter can invoke");
    (bool success, bytes memory result) = target.call{value: value}(data);
    require(success, "Invoke failed");
    return result;

  }

  // Added setter for dexAdapter
  function setDexAdapter(address _dexAdapter) external onlyOwner {
    require(_dexAdapter != address(0), "Invalid adapter address");
    dexAdapter = _dexAdapter;
  }

  function getNonWithdrawableShares(
    address user,
    uint256 csCounterValue
  ) public view override returns (uint256) {
    return nonWithdrawableShares[user][csCounterValue];
  }

  function updatetoken(address tok) internal {
    token.push(tok);
    approval(tok, aFiOracle, ~uint(0));
  }

  function getcSwapCounter() external view override returns (uint256) {
    return cSwapCounter;
  }

  function transferValidationAndSet(address from, address to, uint256 amount) internal {
    checkFalse(!isAfiTransferrable);
    address owner = from;
    validateShares(owner, amount);
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

  function getReinitializeStatus()
    external
    view
    override
    returns (bool _vaultReInitialized)
  {
    _vaultReInitialized = vaultReInitialized;
  }

  function pauseUnpauseDeposit(bool status) external {
    twoAddressCompare(
      rebalContract.getPauseDepositController(address(this)),
      aFiOracle
    );
    depositPaused = status;
  }

  function pauseWithdraw(bool status) external {
    checkDelayModule();
    withdrawPaused = status;
  }

  function isPaused() external view override returns (bool, bool) {
    return (depositPaused, withdrawPaused);
  }

  function setplatformWallet(address payable _platformWallet) external onlyOwner {
    addressCheck(_platformWallet, address(0));
    platformWallet = _platformWallet;
  }

  function setMinDepLimit(uint256 limit) external onlyOwner {
    greaterEqualComparison(limit, 100);
    minimumDepositLimit = limit;
  }

  function getplatformWallet() external view returns (address) {
    return platformWallet;
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
    require(add1 != add2, "AB05");
  }

  function greaterEqualComparison(uint256 valA, uint256 valB) internal pure {
    require(valA >= valB, "AB24");
  }

  function greaterComparision(uint256 valA, uint256 valB) internal pure {
    require(valA > valB, "AB25");
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

  function checkTokInList(address tok) internal view returns (bool istok, bool isUTok) {
    (, istok) = token.indexOf(tok);
    (, isUTok) = uTokens.indexOf(tok);
  }

  function setWhitelistedTok(address tok) internal {
    whitelistedTokens[tok] = true;
  }

  function getPreDepositTokensBalance(
    address tok,
    uint256 _cSwapCounter
  ) internal view returns (uint) {
    return aFiStorage.getPreSwapDepositsTokens(address(this), _cSwapCounter, tok);
  }

  function contractTransfers(address tok, address to, uint256 amount) private {
    IERC20(tok).safeTransfer(to, amount);
  }

  function underlyingTokensStaking() external override {
    checkOracle();
    if (vaultReInitialized) {
      vaultReInitialized = false;
    }
    increasecsCounter();
  }

  function updateCp(uint256[] memory newCp) external {
    addressEqual(msg.sender, address(rebalContract));
    uTokenProportions = newCp;
  }

  function increasecsCounter() internal {
    cSwapCounter++;
  }

  function swap(
    address inputToken,
    address uTok,
    uint256 amountAsPerProportion,
    uint _deadline,
    address middleToken,
    uint256 minimumReturnAmount,
    bytes calldata swapData
  ) external override returns (uint256 returnAmount) {
      checkOracle();
    
      if (inputToken != uTok) {
          address dexTarget = approveDexTarget(
              inputToken,
              amountAsPerProportion,
              inputToken,
              uTok,
              swapData
          );
          IAFiDexAdapter adapter = IAFiDexAdapter(dexAdapter);
          address midToken = middleToken == address(0) ? rebalContract.getMidToken(uTok) : middleToken;
          returnAmount = adapter.swap(
              address(this),
              inputToken,
              uTok,
              amountAsPerProportion,
              _deadline,
              midToken,
              minimumReturnAmount,
              swapData
          );
          IERC20(inputToken).safeApprove(dexTarget, 0);
      }
      return returnAmount;
  }

  function approveDexTarget(
    address token,
    uint256 amount,
    address tokenIn,
    address tokenOut,
    bytes calldata swapData
  ) internal returns (address) {
      IAFiDexAdapter adapter = IAFiDexAdapter(dexAdapter);
      address dexTarget = _getDexTarget(adapter, tokenIn, tokenOut, swapData);
      IERC20(token).safeApprove(dexTarget, amount);
      return dexTarget;
  }

  function _getDexTarget(
      IAFiDexAdapter adapter,
      address tokenIn,
      address tokenOut,
      bytes calldata swapData
  ) internal view returns (address) {
      IAFiDexAdapter.DexChoice dex = adapter.getDexChoice(tokenIn, tokenOut, swapData);
      return (dex == IAFiDexAdapter.DexChoice.UNISWAP_V3 || swapData.length == 0)
          ? address(adapter.uniswapRouter())  // Cast ISwapRouter to address
          : adapter.odosRouter();
  }

  function isOTokenWhitelisted(address oToken) external view override returns (bool) {
    return whitelistedTokens[oToken];
  }

  function updateTVL() public override {
    pool = aFiStorage.calculatePoolInUsd(address(this));
  }

  function tokenTransfer(address token, uint256 amount) internal {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
  }

  function deposit(uint amount, address iToken) external nonReentrant {
    if (PARENT_VAULT != address(0)) {
      checkFalse(!migrated);
    }
    greaterEqualComparison(
      (amount / (10 ** (IERC20(iToken).decimals()))),
      minimumDepositLimit
    );
    updateTVL();
    uint256 prevPool = pool;
    checkFalse(!whitelistedTokens[iToken]);
    checkFalse(depositPaused);
    tokenTransfer(iToken, amount);
    uint256 fee = (amount * 1) / (100); // 1% platform fees
    contractTransfers(iToken, platformWallet, fee);
    amount = amount - fee;
    setPreDeposit(iToken, amount);
    (uint256 shares, uint256 newDepositNAV) = aFiStorage.calculateShares(
      address(this),
      amount,
      prevPool,
      _totalSupply,
      iToken,
      depositNAV[msg.sender],
      _balances[msg.sender]
    );
    greaterComparision(shares, 0);
    _mint(msg.sender, shares);
    makeUpdates(newDepositNAV, shares);
    emit Deposit(msg.sender, amount, iToken);
  }

  function setPreDeposit(address tok, uint256 amount) internal {
    aFiStorage.setPreDepositedInputToken(cSwapCounter, amount, tok);
  }

  function validateWithdraw(
    address user,
    address oToken,
    uint256 _shares
  ) public view override {
    checkFalse(!whitelistedTokens[oToken]);
    checkFalse(isPausedForWithdrawals[oToken]);
    validateShares(user, _shares);
    greaterEqualComparison(_shares, 1e17);
  }

  function validateShares(address user, uint256 _shares) internal view {
    greaterEqualComparison(
      _balances[user] -
        (userLockedAmount[user] + getNonWithdrawableShares(user, cSwapCounter)),
      _shares
    );
  }

  function withdraw(
    uint _shares,
    address oToken,
    uint deadline,
    uint[] memory minimumReturnAmount,
    uint swapMethod,
    uint minAmountOut,
    bytes calldata pendleWithdrawData,
    uint slippageBasisPoints
  ) external nonReentrant {
    checkFalse((rebalContract.isSwapMethodPaused(address(this), swapMethod)));
    checkFalse(withdrawPaused);
    validateWithdraw(msg.sender, oToken, _shares);
    updateTVL();
    uint r = (pool * (_shares)) / (_totalSupply);
    greaterComparision(r, 0);
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
      depositNAV: depositNAV[msg.sender],
      minAmountOut: minAmountOut
    });
    uint256 redFromContract = aFiStorage.handleRedemption(
      params,
      _shares,
      swapMethod,
      new bytes[](uTokens.length + token.length),
      pendleWithdrawData
    );
    burn(msg.sender, _shares);
       // Check Pendle stake status
    bool isStaked = aFiStorage.getPendleStakeStatus(address(this), uTokens[0]);
   
    // Apply slippage if staked
    if (isStaked) {
        uint256 slippage = (redFromContract * slippageBasisPoints) / 10000; // 0.01%
        redFromContract -= slippage;
       
    }

    greaterEqualComparison(balance(oToken, address(this)), redFromContract);
    greaterEqualComparison(redFromContract, minAmountOut);
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

 function swapfromSelectiveDex(
    address from,
    address to,
    uint amount,
    uint deadline,
    address midTok,
    uint minimumReturnAmount,
    bytes calldata _odosRouterSwapData
) external override returns (uint256 _amountOut) {
    compareManagerAndStorage();
    if (from != to) {
        address dexTarget = approveDexTarget(from, amount, from, to, _odosRouterSwapData);
        _amountOut = _executeSwap(from, to, amount, deadline, midTok, minimumReturnAmount, _odosRouterSwapData);
        approval(from, dexTarget, 0);
    }
    return _amountOut;
}

function _executeSwap(
    address from,
    address to,
    uint amount,
    uint deadline,
    address midTok,
    uint minimumReturnAmount,
    bytes calldata odosRouterSwapData
) internal returns (uint256 amountOut) {
    IAFiDexAdapter adapter = IAFiDexAdapter(dexAdapter);
    address midToken = midTok == address(0) ? rebalContract.getMidToken(to) : midTok;
    return adapter.swap(
        address(this),
        from,
        to,
        amount,
        deadline,
        midToken,
        minimumReturnAmount,
        odosRouterSwapData
    );
}

  function approval(address tok, address sender, uint256 amount) internal {
    uint256 allowance = IERC20(tok).allowance(address(this), sender);
    if (allowance < amount) {
      IERC20(tok).safeIncreaseAllowance(sender, (amount - allowance));
    }
  }

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


  // Assuming this is part of a larger contract where MERKLE_DISTRIBUTOR is defined
  function claimMerkleRewards(
      address afiContract,
      address rewardToken,
      uint256 rewardAmount,
      bytes32[] calldata proof
  ) external returns (bool success) {
      checkOracle();
      
      // Create arrays with single elements to match the interface
      address[] memory users = new address[](1);
      users[0] = afiContract;
      
      address[] memory tokens = new address[](1);
      tokens[0] = rewardToken;
      
      uint256[] memory amounts = new uint256[](1);
      amounts[0] = rewardAmount;
      
      bytes32[][] memory proofs = new bytes32[][](1);
      proofs[0] = proof;

      MERKLE_DISTRIBUTOR.claim(
          users,
          tokens,
          amounts,
          proofs
      );
  }

  function _supplyAave(address tok, uint amount) external override {
    checkStorage();
    approval(tok, address(_lendingPool()), amount);
    _lendingPool().deposit(tok, amount, address(this), 0);
  }

  // ========== Pendle Functions ========== //
  // This function will simply forward any calldata to the Pendle router
  function executeRouterCall(address tokenIn,
      uint256 amountIn,
      bytes calldata callData) external payable returns (uint256 lpOut) {
      checkStorage();
    
      // Approve router to spend tokens 
      approval(tokenIn, PENDLE_ROUTER, type(uint256).max);
      (bool success, bytes memory result) = PENDLE_ROUTER.call{value: msg.value}(callData);
      if (!success) {
          if (result.length > 0) {
              // Decode the revert reason
              assembly {
                  let returndata_size := mload(result)
                  revert(add(32, result), returndata_size)
              }
          } else {
              revert("AT01");
          }
      }
      // Decode the result (returns 3 uint256 values)
      if (result.length > 0) {
          (lpOut, ,) = abi.decode(result, (uint256, uint256, uint256));
      }
      approval(tokenIn, PENDLE_ROUTER, 0);
      return (lpOut);
  }

  function _withdrawAave(address tok, uint amount) external override {
      twoAddressCompare(aFiOracle, address(aFiStorage));
    _lendingPool().withdraw(tok, amount, address(this));
  }

  function updatePoolData(bytes memory data) external override nonReentrant {
    checkManager();
    setInitialValues(data);
  }

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

  function getInputToken()
    external
    view
    override
    returns (address[] memory, address[] memory)
  {
    return (token, nonOverlappingITokens);
  }

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
      pendleMarketPalace[tok] = pooldata._pendleMarketPalace[i];
      aFiStorage.afiSync(
        address(this),
        tok,
        pooldata._aaveToken[i],
        pendleMarketPalace[tok]
      );
    }
  }

  function updateuTokAndProp(address[] memory _uTokens) external override {
    checkManager();
    uTokens = _uTokens;
  }

  function checkManager() internal {
    addressEqual(msg.sender, aFiManager);
  }

  function updateDp(
    uint256[] memory _defaultProportion,
    uint256[] memory _uTokensProportion
  ) external override {
    checkManager();
    uTokenProportions = _uTokensProportion;
    defaultProportion = _defaultProportion;
  }

  function _lendingPool() internal view returns (ILendingPool) {
    return ILendingPool(IPoolAddressesProvider(POOL_ADDRESS_PROVIDER).getPool());
  }

  function checkOracle() internal {
    addressEqual(msg.sender, aFiOracle);
  }

  function stakeShares(address user, uint256 amount, bool lock) external {
    addressCheck(user, tLContract);
    if (lock) {
      validateShares(user, amount);
    } else {
      greaterEqualComparison(userLockedAmount[user], amount);
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

  function updateTimeLockContract(address newTL) external onlyOwner {
    addressCheck(newTL, address(0));
    tLContract = newTL;
  }

  function emergencyWithdraw(address tok, address wallet) external {
    checkDelayModule();
    contractTransfers(tok, wallet, balance(tok, address(this)));
  }

  function checkDelayModule() internal {
    addressEqual(msg.sender, delayModule);
  }

  function balance(address tok, address user) internal view returns (uint) {
    return IERC20(tok).balanceOf(user);
  }

  function updateInputTokens(
    address[] memory _nonOverlappingITokens
  ) external override {
    twoAddressCompare(owner(), aFiManager);
    nonOverlappingITokens = _nonOverlappingITokens;
  }

  function depositUserNav(address user) external view override returns (uint256) {
    if (_balances[user] == 0) {
      return 0;
    } else {
      return depositNAV[user];
    }
  }

  function migration(address iToken) external onlyOwner {
    addressCheck(PARENT_VAULT, address(0));
    checkFalse(migrated);
    _totalSupply += IERC20(PARENT_VAULT).totalSupply();
    migrated = true;
    increasecsCounter();
    setPreDeposit(iToken, balance(iToken, address(this)));
  }

  function checkEqual(uint256 valA, uint256 valB) internal {
    require(valA == valB, "AB222");
  }

  function exchangeToken() external {
    checkFalse(!migrated);
    uint256 shares = balance(PARENT_VAULT, msg.sender);
    greaterComparision(shares, 0);
    uint256 userNAV = IAFi(PARENT_VAULT).depositUserNav(msg.sender);
    IERC20(PARENT_VAULT).safeTransferFrom(msg.sender, DEAD_ADDRESS, shares);
    uint256 nav = depositNAV[msg.sender];
    uint256 bal = _balances[msg.sender];
    if (nav != 0 && bal > 0) {
      userNAV = ((nav * bal) + (shares * userNAV)) / (bal + shares);
    }
    _balances[msg.sender] += shares;
    emit Transfer(address(0), msg.sender, shares);
    makeUpdates(userNAV, 0);
  }

  function makeUpdates(uint256 userNAV, uint256 nonwithdrawable) internal {
    depositNAV[msg.sender] = userNAV;
    nonWithdrawableShares[msg.sender][cSwapCounter] += nonwithdrawable;
  }

  function setPreDep(address tok, uint256 amt) internal {
    aFiStorage.setPreDepositedInputToken(cSwapCounter, amt, tok);
  }

  function handleOrphanTokens(
    address tok, 
    address oToken, 
    address middleTok, 
    uint256 _deadline, 
    uint256 minimumReturnAmount,
    bytes calldata swapData
    ) external onlyOwner {
    ( bool iPresent, ) = checkTokInList(oToken);
    checkFalse(!iPresent);
    bool present;
    (iPresent, present) = checkTokInList(tok);
    uint256 tokBal = balance(tok, address(this));
    if(iPresent && !present){
      uint256 preDep = getPreDepositTokensBalance(tok, cSwapCounter);
      if(tokBal >  preDep){
        setPreDep(tok, (tokBal - preDep));
      }
    }else if(!iPresent && !present){
      (uint256 returnAmount ) = _executeSwap(
        tok,
        oToken,
        tokBal,
        _deadline,
        middleTok,
        minimumReturnAmount,
        swapData
      );
      setPreDep(oToken, (returnAmount));
    }
  }
}
