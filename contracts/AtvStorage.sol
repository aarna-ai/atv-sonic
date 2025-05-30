// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./IAFiStorage.sol";
import "./IAFi.sol";
import "./IUniswapV3.sol";
import {SafeCast} from "./SafeCast.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import {OwnableDelayModule} from "./OwnableDelayModule.sol";
import "./ArrayUtils.sol";
import {AggregatorV3Interface} from "./AggregatorV3Interface.sol";
import "./IPassiveRebal.sol";
import "./IAFiFactory.sol";

interface Compound {
  function exchangeRateStored() external view returns (uint);
}


/**
 * @title AtvStorage.
 * @notice Storage conntract for storing investors and teamwallets details and performig the storage changes.
 * @dev Error codes: AFS01: Cannot be address zero. AFS02: Unauthorized caller.
 */
contract AtvStorage is OwnableDelayModule, IAFiStorage, ReentrancyGuard {
  using SafeCast for uint256;
  using ArrayUtils for uint[];
  using ArrayUtils for address[];

  address public aFiManager;

  uint256 internal preDep;
  uint256 internal tempStorage;
  uint256 internal tempMultiplier;
  uint256 internal redFromContract;
  address internal rebal;
  address internal _afiTemp;
  address public immutable uniswapOracleV3;
  address public immutable aFiFactory;

  uint256 public tempCounter;
  uint256 public stakingPercentage = 100;
  uint256 public pendlePercentage = 100;
  // List of TeamWallets, helpful when fetching team wallets report
  mapping(address => address[]) internal teamWalletsOfAFi;

  mapping(address => mapping(address => TeamWallet)) internal teamWalletInAFi;
  mapping(address => uint) internal totalActiveTeamWallets;
  mapping(address => bool) internal onlyOnce;
  mapping(address => bool) public isAFiActive;
  mapping(address => mapping(uint256 => mapping(address => uint256)))
    public preDepositedInputTokens;
  mapping(address => mapping(address => uint256)) public stablesWithdrawalLimit; // Amount in USD that can be withdrawn in between cumulative swaps
  mapping(address => mapping(address => mapping(uint256 => uint256)))
    public stablesWithdrawn; // Amount in USD that has been withdrawn in between cumulative swaps

  //synData
  mapping(address => mapping(address => address)) public aaveTokenCopy; // aaveToken address for various u tokens
  mapping(address => mapping(address => address)) public pendleMarketPalace;
  mapping(address => mapping(address => uint)) public provider; // Protocol where each u token is invested
  mapping(address => mapping(address => bool)) internal _isStaked;
  mapping(address => mapping(address => bool)) public isPendleStaked;

  address private constant WETH = 0x50c42dEAcD8Fc9773493ED674b675bE577f2634b;

  /*
    Is underlying token staked
    isUTokenStaked: AFi => UToken `isUTokenStaked[AFi][UToken]`
    isRebalanced: AFi `isRebalanced[AFi]`
  */
  mapping(address => bool) internal isActiveRebalanced;

  event SetActiveRebalancedStatus(address indexed aFiContract, bool status);
  event SetAFiActive(address indexed aFiContract, bool status);
  event ReActivateTeamWallet(address aFiContract, address wallet);
  event DeactivateTeamWallet(address aFiContract, address wallet);
  event SetAFiManager(address indexed afiContract, address manager);
  event SupplyAave(address indexed vault, address indexed token, uint256 amount);
  event SupplyPendle(address indexed vault, address indexed yieldToken, uint256 amount, uint256 lpOut);

  event WithdrawAave(address indexed afiContract, address tok, uint256 _amount);
  event WithdrawPendle(address afiContract, address tok, uint256 lpSharesAmount, uint256 aTokensOut);
  event ProfitShareDistributed(
    address indexed aFiContract,
    address indexed teamWallet,
    uint256 amount
  );
  

  constructor(
    address _aFiManager,
    address oracleV3,
    address _passiveRebal,
    address _aFiFactory
  ) {
    validateAddress(_aFiManager, address(0));
    validateAddress(_aFiFactory, address(0));
    validateAddress(oracleV3, address(0));
    aFiManager = _aFiManager;
    uniswapOracleV3 = oracleV3;
    rebal = _passiveRebal;
    aFiFactory = _aFiFactory;
  }

  function validateAddress(address addA, address addB) internal pure {
    require(addA != addB, "AFS01");
  }

  function aFiVaultCaller(address aFiContract, address _owner1) internal view {
    require(
      IAFiFactory(aFiFactory).getAFiTokenStatus(aFiContract) &&
        (msg.sender == _owner1 || msg.sender == aFiContract),
      "AFS09"
    );
  }

  /**
   * @notice To add a new team wallet.
   * @param aFiContract Address of the AFi contract.
   * @param wallet Wallet address that has to be added in the `teamWallets` array.
   * @param isActive Boolean indicating whether to set the wallet to either active/inactive.
   * @param isPresent Boolean indicating the present status of the wallet.
   */
  function addTeamWallet(
    address aFiContract,
    address wallet,
    bool isActive,
    bool isPresent
  ) external override nonReentrant {
    validateFlag(isAFiActive[aFiContract]);
    validateCaller(msg.sender, aFiManager);
    validateAddress(wallet, address(0));
    validateGreater(totalActiveTeamWallets[aFiContract]);
    if (!teamWalletInAFi[aFiContract][wallet].isPresent && isPresent) {
      teamWalletsOfAFi[aFiContract].push(wallet);
      teamWalletInAFi[aFiContract][wallet].isPresent = isPresent;

      // Write to contract storage
      if (!teamWalletInAFi[aFiContract][wallet].isActive && isActive) {
        teamWalletInAFi[aFiContract][wallet].isActive = isActive;
        totalActiveTeamWallets[aFiContract]++;
      }
      teamWalletInAFi[aFiContract][wallet].walletAddress = wallet;
    }
    emit TeamWalletAdd(wallet, true);
  }

  /**
   * @notice To deactivate a team wallet.
   * @param aFiContract Address of the AFi contract.
   * @param wallet Wallet address that has to be deactivated.
   */
  function deactivateTeamWallet(
    address aFiContract,
    address wallet
  ) external onlyOwner nonReentrant {
    // solhint-disable-next-line reason-string

    validateFlag(isAFiActive[aFiContract]);
    validateFlag(teamWalletInAFi[aFiContract][wallet].isActive);
    totalActiveTeamWallets[aFiContract]--;

    // Write to contract storage
    teamWalletInAFi[aFiContract][wallet].isActive = false;
    emit DeactivateTeamWallet(aFiContract, wallet);
  }

  /**
   * @notice To reactivated a team wallet.
   * @param aFiContract Address of the AFi contract.
   * @param wallet address that has to be reactivated.
   */
  function reActivateTeamWallet(
    address aFiContract,
    address wallet
  ) external onlyOwner nonReentrant {
    // solhint-disable-next-line reason-string

    validateFlag(isAFiActive[aFiContract]);
    validateFlag(teamWalletInAFi[aFiContract][wallet].isPresent);
    validateFlag(!teamWalletInAFi[aFiContract][wallet].isActive);
    totalActiveTeamWallets[aFiContract]++;

    // Write to contract storage
    teamWalletInAFi[aFiContract][wallet].isActive = true;
    emit ReActivateTeamWallet(aFiContract, wallet);
  }

  function getTotalActiveWallets(
    address aFiContract
  ) public view override returns (uint) {
    return totalActiveTeamWallets[aFiContract];
  }

  /**
   * @notice To add given wallet address to the contract storage.
   * @param aFiContract Address of the AFi contract.
   * @param _teamWallets An array of wallet addresses.
   */
  function setTeamWallets(
    address aFiContract,
    address[] memory _teamWallets
  ) external override nonReentrant {
    validateFlag(!onlyOnce[aFiContract]);
    validateCaller(msg.sender, aFiContract);
    uint tWalletLength = _teamWallets.length;

    // Check if the team wallets have already been set
    require(totalActiveTeamWallets[aFiContract] == 0, "AFS12");

    totalActiveTeamWallets[aFiContract] = tWalletLength;

    for (uint i = 0; i < tWalletLength; i++) {
      address wallet = _teamWallets[i];

      TeamWallet memory tWallet = teamWalletInAFi[aFiContract][wallet];

      if (!tWallet.isPresent) {
        teamWalletsOfAFi[aFiContract].push(wallet);
        tWallet.isPresent = true;
        tWallet.isActive = true;
        tWallet.walletAddress = wallet;

        // Write to contract storage
        teamWalletInAFi[aFiContract][wallet] = tWallet;

        emit TeamWalletActive(wallet, true);
      } else {
        // only for duplicacy
        totalActiveTeamWallets[aFiContract]--;
      }
    }
    onlyOnce[aFiContract] = true;
  }

  function setActiveRebalancedStatus(
    address aFiContract,
    bool status
  ) external override {
    aFiVaultCaller(aFiContract, aFiManager);
    isActiveRebalanced[aFiContract] = status;
    emit SetActiveRebalancedStatus(aFiContract, status);
  }

  /**
   * @notice Returns the team wallet details.
   * @param aFiContract Address of the AFi contract.
   * @param _wallet Team wallet address.
   * @return isActive Boolean indicating whether to set the wallet to either active/inactive.
   * @return isPresent Boolean indicating the present status of the wallet.
   */
  function getTeamWalletDetails(
    address aFiContract,
    address _wallet
  ) public view override returns (bool isActive, bool isPresent) {
    return (
      teamWalletInAFi[aFiContract][_wallet].isActive,
      teamWalletInAFi[aFiContract][_wallet].isPresent
    );
  }

  /**
   * @notice Returns the array of team wallet addresses.
   * @param aFiContract Address of the AFi contract.
   * @return _teamWallets Array of teamWallets.
   */
  function getTeamWalletsOfAFi(
    address aFiContract
  ) public view override returns (address[] memory _teamWallets) {
    _teamWallets = teamWalletsOfAFi[aFiContract];
  }

  function isAFiActiveRebalanced(
    address aFiContract
  ) external view override returns (bool _isActiveRebalanced) {
    _isActiveRebalanced = isActiveRebalanced[aFiContract];
  }

  /**
   * @notice To set the AFi contract status.
   * @dev Requirements: It can be invoked only by the contract owner.
   * @param aFiContract Address of the AFiContract.
   * @param active status for afiContracts.
   */
  function setAFiActive(address aFiContract, bool active) external override {
    require(msg.sender == aFiContract || msg.sender == owner(), "AFS04");
    // Check if the contract is already active and trying to activate it again
    require(active != isAFiActive[aFiContract], "AFS14");
    isAFiActive[aFiContract] = active;
    emit SetAFiActive(aFiContract, isAFiActive[aFiContract]);
  }

  // /**
  //  * @notice syncs the pool data of a token to the pool data of aficontract.
  //  * @param afiContract address of the afi contract.
  //  * @param tok address of the token to sync the pool data.
  //  * @param aaveTok address of the aave pool.
  //  * @param _pendleMarketPalace address of the pendle lp token.
  //  */
  function afiSync(
    address afiContract,
    address tok,
    address aaveTok,
    address _pendleMarketPalace
  ) external override {
    validateCaller(msg.sender, afiContract);
    aaveTokenCopy[afiContract][tok] = aaveTok;
    pendleMarketPalace[afiContract][tok] = _pendleMarketPalace;
  }

  function balancePendle(
    address tok,
    address afiContract
  ) public view returns (uint) {
    return IERC20(pendleMarketPalace[afiContract][tok]).balanceOf(afiContract);
  }

  /**
   * @notice Returns the balance of Aave tokens in the AFi contract for a specific token.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return The Aave token balance.
   */
  function balanceAave(address tok, address afiContract) public view returns (uint) {
    return IERC20(aaveTokenCopy[afiContract][tok]).balanceOf(afiContract);
  }

  /**
   * @notice Returns the balance of a specific token in the AFi contract.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return The token balance.
   */
  function balance(address tok, address afiContract) public view returns (uint) {
    return IERC20(tok).balanceOf(afiContract);
  }

 

  /**
   * @notice To set the AFiManager contract address.
   * @dev Requirements: It can be invoked only by the platform wallet.
   * @param _aFiManager Address of the AFiManager contract.
   */
  function setAFiManager(address _aFiManager) external onlyOwner {
    validateAddress(_aFiManager, address(0));
    aFiManager = _aFiManager;
    emit SetAFiManager(address(this), _aFiManager);
  }

  /**
  * @notice Gets the price of Pendle LP tokens in USD.
  * @param pendleMarket The address of the Pendle market.
  * @return Price and multiplier of the Pendle LP token.
  */
  function getPendleLPPriceInUSD(address pendleMarket) public view returns (uint256) {
    // Implement Pendle LP price oracle logic here
    // This could involve querying the Pendle protocol for market values
    // or using an external oracle for Pendle LP tokens
    return IPassiveRebal(rebal).getNormalizedLpToAssetRate(pendleMarket);
  }


  /**
   * @notice Calculates the total value of a token locked by the AFi contract in USD.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return The total value of the token in USD.
   */
  function calcPoolValue(
    address tok,
    address afiContract
  ) public view override returns (uint) {
    // Original calculation for other providers
    (uint256 price, uint256 multiplier) = getPriceInUSD(tok);
    (uint256 bal, uint256 uTokensDecimal) = tvlRead(tok, afiContract);
      // If token is staked in Pendle, use Pendle LP token price oracle
    if (provider[afiContract][tok] == 2 && isPendleStaked[afiContract][tok]) {
      address pendleMarket = pendleMarketPalace[afiContract][tok];
      uint256 lpPrice = getPendleLPPriceInUSD(pendleMarket);
      uint256 lpBalance = balancePendle(tok, afiContract);
      if (lpPrice != 0) {
        uint256 totalValue = (lpBalance * lpPrice);
        totalValue = ((totalValue * (10 ** uTokensDecimal))/ (1e18));

        uint unstakeTokenAmount = balance(tok, afiContract);
        unstakeTokenAmount = (unstakeTokenAmount) * (uint(price));
        unstakeTokenAmount = ((unstakeTokenAmount * (10 ** uTokensDecimal)) / (10 ** multiplier));
        totalValue += unstakeTokenAmount;
        return totalValue;
      }
      return 0;
    } else {
      if (price != 0) {
        bal = (bal) * (uint(price));
        bal = ((bal * (10 ** uTokensDecimal)) / (10 ** multiplier));
      }
      return bal;
    }
  }

  function tvlRead(
    address tok,
    address afiContract
  ) public view override returns (uint, uint256) {
    uint256 uTokensDecimal = validateAndGetDecimals(tok);
    uint bal = balanceOfUnderlyingInPoolsAndContract(tok, afiContract);
    return (bal, uTokensDecimal);
  }

  /**
   * @notice Calculates the balance of underlying tokens in the AFi contract for a specific token.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return The balance of underlying tokens.
   */
  function calculateBalanceOfUnderlying(
    address tok,
    address afiContract
  ) external view override returns (uint) {
    return balanceOfUnderlyingInPoolsAndContract(tok, afiContract);
  }

  /**
   * @notice Calculates the balance of underlying tokens in the AFi contract for a specific token.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return bal balance of underlying tokens.
   */
 function balanceOfUnderlyingInPoolsAndContract(
    address tok,
    address afiContract
  ) internal view returns (uint256 bal) {
    if (
        pendleMarketPalace[afiContract][tok] != address(0) && provider[afiContract][tok] == 2
    ) {
        bal += balancePendle(tok, afiContract);
    }
    if (
        aaveTokenCopy[afiContract][tok] != address(0) && provider[afiContract][tok] == 1
    ) {
        bal += balanceAave(tok, afiContract);
    }
 
    bal += balance(tok, afiContract);
}

  // returns the TVL by the external protocols
  function calcPoolValueSomeRead(
    address tok,
    address afiContract,
    uint256 price,
    uint256 multiplier
  ) internal view returns (uint) {
     // Original calculation for other providers
    (uint256 bal, uint256 uTokensDecimal) = tvlRead(tok, afiContract);
      // If token is staked in Pendle, use Pendle LP token price oracle
    if (provider[afiContract][tok] == 2 && isPendleStaked[afiContract][tok]) {
      address pendleMarket = pendleMarketPalace[afiContract][tok];
      uint256 lpPrice = getPendleLPPriceInUSD(pendleMarket);
      uint256 lpBalance = balancePendle(tok, afiContract);
      if (lpPrice != 0) {
        uint256 totalValue = (lpBalance * lpPrice);
        totalValue = ((totalValue * (10 ** uTokensDecimal))/ (1e18));
        return totalValue;
      }
      return 0;
    } else {
      if (price != 0) {
        bal = (bal - (balance(tok, afiContract))) * (uint(price));
        bal = ((bal * (10 ** uTokensDecimal)) / (10 ** multiplier));
      }
      return bal;

    }
  }

  /**
   * @notice Calculates the total value of all tokens locked by the AFi contract in USD.
   * @param afiContract The address of the AFi contract.
   * @return The total value of all tokens in USD.
   */
  function calculatePoolInUsd(
    address afiContract
  ) external view override returns (uint) {
    uint bal = 0;
   address[] memory uToken = IAFi(afiContract).getUTokens();
    (, address[] memory iToken) = IAFi(afiContract).getInputToken();
    uint uLen = uToken.length > iToken.length ? uToken.length : iToken.length;
    uint256 cSwapCounter =  getCSwapCounterFromVault(afiContract);
    uint256 preDepositStableBalance;
    for (uint i = 0; i < uLen; i++) {
      if (uLen == iToken.length) {
        if (i < uToken.length) {
          bal = bal + (calcPoolValue(uToken[i], afiContract));
        }
        preDepositStableBalance = convertInUSDAndTok(
          iToken[i],
          preDepositedInputTokens[afiContract][cSwapCounter][iToken[i]],
          false
        );
     
        bal = bal + (preDepositStableBalance);
      } else {
        if (i < iToken.length) {
          preDepositStableBalance = convertInUSDAndTok(
            iToken[i],
            preDepositedInputTokens[afiContract][cSwapCounter][iToken[i]],
            false
          );
          bal = bal + (preDepositStableBalance);
        }
        bal = bal + (calcPoolValue(uToken[i], afiContract));
      }
    }
    return bal;
  }

  /**
   * @notice Validates and returns the number of decimals for a given token.
   * @param tok The address of the token.
   * @return The number of decimals.
   */
  function validateAndGetDecimals(address tok) public view override returns (uint256) {
    uint uTokensDecimal = IERC20(tok).decimals();
    validateGreaterEqual(18, uTokensDecimal);
    return (18 - uTokensDecimal);
  }

  /**
   * @notice Validates that two addresses are equal.
   * @param add1 The first address.
   * @param add2 The second address.
   */
  function validateCaller(address add1, address add2) internal pure {
    require(add1 == add2, "AFS27");
  }

  /**
   * @notice Validates a boolean flag.
   * @param flag The boolean flag to validate.
   */
  function validateFlag(bool flag) internal pure {
    require(flag, "AFS28");
  }

  /**
   * @notice Validates that one value is greater than or equal to another.
   * @param val1 The first value.
   */
  function validateGreater(uint256 val1) internal pure {
    require(val1 > 0, "AFS19");
  }

  /**
   * @notice Validates that one value is greater than or equal to another.
   * @param val1 The first value.
   * @param val2 The second value.
   */
  function validateGreaterEqual(uint256 val1, uint256 val2) internal pure {
    require(val1 >= val2, "AFS20");
  }

  
/**
 * @notice Rearranges the staking of uTokens, withdrawing from existing pools and staking in recommended pools.
 * @param aFiContract The address of the AFi contract.
 * @param underlyingTokens Array of underlying token addresses to rearrange.
 * @param newProviders Array of provider IDs for each token (1=Aave, 2=Aave+Pendle).
 * @param pendleData Encoded data for interacting with Pendle router.
 */
function rearrange(
  address aFiContract,
  address[] memory underlyingTokens,
  uint256[] memory newProviders,
  bytes calldata pendleData
) external override returns (uint256 lpOut){
  (, , uint256 productType) = getVaultData(aFiContract);
  if (productType == 2) {
    validateCaller(msg.sender, uniswapOracleV3);
    require(underlyingTokens.length == newProviders.length, "AFS03");
  
    for (uint i = 0; i < underlyingTokens.length; i++) {
      address uToken = underlyingTokens[i];
      uint256 newProvider = newProviders[i];

      // Withdraw all only if provider is changing
      if (newProvider != provider[aFiContract][uToken]) {
        _isStaked[aFiContract][uToken] = false;
        _withdrawAll(aFiContract, uToken, pendleData);
      }

      uint256 stakeAmount = (balance(uToken, aFiContract) * stakingPercentage) / 100;

      if (stakeAmount > 0) {
        if (newProvider == 1 && aaveTokenCopy[aFiContract][uToken] != address(0)) {
          // Only Aave staking
          _isStaked[aFiContract][uToken] = true;
          IAFi(aFiContract)._supplyAave(uToken, stakeAmount);
          emit SupplyAave(aFiContract, uToken, stakeAmount);
          
          // Reset Pendle staking flag if it was previously set
          isPendleStaked[aFiContract][uToken] = false;
        } 
        else if (newProvider == 2 && aaveTokenCopy[aFiContract][uToken] != address(0)) {
          // Aave + Pendle staking
          require(pendleData.length > 0, "AFS08"); // Add this line
          _isStaked[aFiContract][uToken] = true;
          
          // First supply to Aave
          IAFi(aFiContract)._supplyAave(uToken, stakeAmount);
          emit SupplyAave(aFiContract, uToken, stakeAmount);
          
          uint256 pendleAmount = (IERC20(aaveTokenCopy[aFiContract][uToken]).balanceOf(aFiContract) * pendlePercentage) / 100;
       
          if (pendleAmount > 0 && pendleData.length > 0) {
            // Execute Pendle staking through router call
            (lpOut) = IAFi(aFiContract).executeRouterCall(
              aaveTokenCopy[aFiContract][uToken],
              pendleAmount,
              pendleData
            );
            
            // Store Pendle staking info
            isPendleStaked[aFiContract][uToken] = true;
            emit SupplyPendle(aFiContract, aaveTokenCopy[aFiContract][uToken], pendleAmount, lpOut);
          }
        }
      }

      provider[aFiContract][uToken] = newProvider;
    }
  }
  return lpOut;
}


  // Function to update staking percentage
  function setStakingPercentage(uint256 newPercentage) external onlyOwner{
    require(newPercentage <= 100, "Invalid percentage");
    stakingPercentage = newPercentage;
  }

  function setPendlePercentage(uint256 _percentage) external onlyOwner {
    require(_percentage <= 100, "Invalid %");
    pendlePercentage = _percentage;
  }
  /**
   * @notice Checks the staked status of a uToken.
   * @param aFiContract The address of the AFi contract.
   * @param uToken The address of the uToken.
   * @return Whether the uToken is staked or not.
   */
  function getStakedStatus(
    address aFiContract,
    address uToken
  ) public view override returns (bool) {
    return _isStaked[aFiContract][uToken];
  }

  function setPreDepositedInputTokenInReInitialize(
    address aficontract,
    uint256 _cSwapCounter,
    uint256 _amount,
    address _oToken
  ) external override {
    validateCaller(msg.sender, aFiManager);
    preDepositedInputTokens[aficontract][_cSwapCounter][_oToken] -= _amount;
  }

  function calculateShares(
    address afiContract,
    uint256 amount,
    uint256 prevPool,
    uint256 _totalSupply,
    address iToken,
    uint256 currentDepositNAV,
    uint256 prevBalance
  ) external view override returns (uint256 shares, uint256 newDepositNAV) {
    validateAddress(afiContract, address(0));
    validateCaller(msg.sender, afiContract);
    (uint256 price, uint256 dec) = getPriceInUSD(iToken);
    uint256 decimals = validateAndGetDecimals(iToken);
    uint256 amountCheck = (amount * price * (10 ** decimals)) / (10 ** dec);

    if (_totalSupply == 0) {
      shares = amountCheck / 100;
    } else {
      validateGreater(prevPool);
      shares = (amountCheck * _totalSupply) / prevPool;
    }

    if (currentDepositNAV == 0) {
      if (_totalSupply == 0) {
        newDepositNAV = 1000000;
      } else {
        newDepositNAV = (prevPool * 10000) / _totalSupply;
      }
    } else {
      uint256 newNav = (prevPool * 10000) / _totalSupply;
      newDepositNAV =
        ((currentDepositNAV * prevBalance) + (shares * newNav)) /
        (prevBalance + shares);
    }
  }

  function handleRedemption(
    RedemptionParams memory params,
    uint _shares,
    uint swapMethod,
    bytes[] calldata swapData,
    bytes calldata pendleWithdrawData
  ) external override returns (uint256 redemptionFromContract) {
    validateAddress(params.baseContract, address(0));
    aFiVaultCaller(msg.sender, params.baseContract);
    if (swapMethod == 1) {
      redemptionFromContract = checkUnderlyingToken(
        params.baseContract,
        params.r,
        params.oToken,
        params.cSwapCounter,
        params.uTokens,
        params.deadline,
        params.minimumReturnAmount
      );
    } else {
      redemptionFromContract = swapForOtherProduct(
        params.baseContract,
        params.r,
        params.oToken,
        params.deadline,
        params.minimumReturnAmount,
        params.uTokens,
        pendleWithdrawData
      );
    }

    uint256 redemptionNAV = (params._pool * 10000) / params.tSupply;
    if (redemptionNAV > params.depositNAV) {
      redemptionFromContract -= _distributeProfitShare(
        params.baseContract,
        _shares,
        params.oToken,
        params.depositNAV,
        redemptionNAV
      );
    }

    return redemptionFromContract;
  }

  function getVaultData(address afiContract) internal view returns(uint256 tvl, address rebalContract, uint256 productType) {
    (tvl, rebalContract, productType) = IAFi(afiContract).getTVLandRebalContractandType();
  }

  /**
   * @notice Swaps tokens in the AFi contract for another product.
   * @param afiContract The address of the AFi contract.
   * @param r A parameter for the swap.
   * @param oToken The address of the output token.
   * @return The total amount swapped from the contract.
   */
  function swapForOtherProduct(
    address afiContract,
    uint r,
    address oToken,
    uint deadline,
    uint[] memory minimumReturnAmount,
    address[] memory uToken,
    bytes calldata pendleWithdrawData
  ) public override returns (uint256) {
    validateAddress(afiContract, address(0));
    aFiVaultCaller(afiContract, uniswapOracleV3);

    (, rebal, ) = getVaultData(afiContract);
    redFromContract = 0;
    _afiTemp = afiContract;

    preDep = IAFiManager(aFiManager).inputTokenUSD(
      IAFi(afiContract),
     getCSwapCounterFromVault(afiContract),
      IAFiStorage(address(this))
    );

    tempStorage = deadline;
    checkIfTokenPresent(uToken, r, oToken, afiContract, minimumReturnAmount, pendleWithdrawData);
    swapInternal(uToken, r, oToken, minimumReturnAmount, pendleWithdrawData);

    return redFromContract;
  }

  
  function getCSwapCounterFromVault(
    address afiContract
  ) internal view returns (uint256) {
    return IAFi(afiContract).getcSwapCounter();
  }

  function calculateRedemptionFromContract(
    address afiContract,
    address tok,
    uint256 r
  )
    public
    view
    override
    returns (
      uint256 price,
      bool stakedStatus,
      uint256 redemptionValueFromContract,
      uint256 multiplier,
      uint256 tvl
    )
  {
    validateAddress(afiContract, address(0));
    (price, multiplier) = getPriceInUSD(tok);
    (tvl, , ) = getVaultData(afiContract);
    uint256 tokPreDep = preDepositedInputTokens[afiContract][
       getCSwapCounterFromVault(afiContract)
    ][tok];
    if (price != 0) {
      uint256 uTokensDecimal = validateAndGetDecimals(tok);
      uint256 tokPredepInUSD = (tokPreDep) * (uint(price));
      tokPredepInUSD = ((tokPredepInUSD * (10 ** uTokensDecimal)) / (10 ** multiplier));
      redemptionValueFromContract = (((r) *
        (calcPoolValue(tok, afiContract) - tokPredepInUSD)) * (10 ** multiplier));
      redemptionValueFromContract =
        (redemptionValueFromContract) /
        (((tvl - preDep) * (uint(price)) * (10 ** (validateAndGetDecimals(tok)))));
      tvl -= preDep;
      return (
        price,
        getStakedStatus(afiContract, tok),
        redemptionValueFromContract,
        multiplier,
        tvl
      );
    }
  }

  /**
   * @notice Withdraws funds from pools and performs an internal swap.
   * @param tok The address of the token.
   * @param r A parameter for the withdrawal.
   * @param oToken The address of the output token.
   * @param redemptionFromContract The redemption amount from the contract.
   */
  function withdrawFromPools(
    address tok,
    uint r,
    address oToken,
    uint redemptionFromContract,
    uint256 price,
    uint256 minimumReturnAmount,
    uint256 tvl,
    bytes calldata pendleWithdrawData
  ) internal {
    address midTok = IPassiveRebal(rebal).getMidToken(tok);
    {
      uint256 redemptionFromPool = calcPoolValueSomeRead(
        tok,
        _afiTemp,
        price,
        tempMultiplier
      );
     
      redemptionFromPool = redemptionFromPool * (r) * (10 ** tempMultiplier);
      redemptionFromPool =
        (redemptionFromPool) /
        ((tvl) * (uint(price)) * (10 ** validateAndGetDecimals(tok)));
    
      _withdrawSome(_afiTemp, tok, redemptionFromPool, pendleWithdrawData);
    }
    internalSwap(
      _afiTemp,
      tok,
      oToken,
      midTok,
      tempStorage,
      redemptionFromContract,
      minimumReturnAmount
    );
  }

  function internalSwap(
    address afiContract,
    address tok,
    address oToken,
    address midTok,
    uint deadline,
    uint redeem,
    uint minimumReturnAmount
  ) internal {
    if (tok != oToken) {
      if (balance(tok, afiContract) > 0) {
        redFromContract += doSwapUsingDex(
          afiContract,
          tok,
          oToken,
          redeem,
          deadline,
          midTok,
          minimumReturnAmount
        );
      }
    } else {
      redFromContract = redFromContract + redeem;
    }
  }

/**
 * @notice Converts asset amount to the equivalent LP shares for Pendle withdrawals
 * @param afiContract The address of the AFi contract
 * @param tok The address of the underlying token
 * @param assetAmount The amount of assets to withdraw
 * @return shareAmount The equivalent amount of Pendle LP shares to withdraw
 */
function convertAssetsToShares(
    address afiContract,
    address tok,
    uint256 assetAmount
) public view returns (uint256 shareAmount) {
    require(provider[afiContract][tok] == 2 && isPendleStaked[afiContract][tok], "Not staked in Pendle");
    
    address pendleMarket = pendleMarketPalace[afiContract][tok];
    uint256 lpPrice = getPendleLPPriceInUSD(pendleMarket);
    require(lpPrice > 0, "Invalid LP price");
    
    // Get token price in USD
    (uint256 tokenPrice, uint256 tokenMultiplier) = getPriceInUSD(tok);
    require(tokenPrice > 0, "Invalid token price");
    
    // Convert token amount to USD value
    uint256 assetValueUSD = (assetAmount * tokenPrice) / (10 ** tokenMultiplier);
    
    // Calculate LP token amount based on USD value
    uint256 lpDecimals = IERC20(pendleMarket).decimals();
    shareAmount = (assetValueUSD * (10 ** lpDecimals)) / lpPrice;
    
    // Ensure we don't try to withdraw more than available
    uint256 availableShares = balancePendle(tok, afiContract);

    if (shareAmount > availableShares) {
        shareAmount = availableShares;
    }
    
    return shareAmount;
  }


/**
 * @notice Withdraws a specific amount of tokens from the appropriate provider
 * @param afiContract The address of the AFi contract
 * @param tok The address of the token to withdraw
 * @param _amount The amount of tokens to withdraw
 * @param pendleWithdrawData Encoded data for Pendle withdrawal
 * @return withdrawal Boolean indicating if withdrawal was successful
 */
function _withdrawSome(
    address afiContract,
    address tok,
    uint256 _amount,
    bytes calldata pendleWithdrawData
) internal returns (bool withdrawal) {
    // Pendle withdrawal (provider 2)
    if (pendleMarketPalace[afiContract][tok] != address(0) && 
        provider[afiContract][tok] == 2 &&
        isPendleStaked[afiContract][tok]) {
        
        uint256 pendleBalance = balancePendle(tok, afiContract);
        if (pendleBalance >= 1) {
            // Convert token amount to LP shares
         
            uint256 lpSharesAmount = convertAssetsToShares(afiContract, tok, _amount);
          
            if (lpSharesAmount > 0) {
            
                // Execute Pendle withdrawal through router call
                (uint256 aTokensOut) = IAFi(afiContract).executeRouterCall(
                    pendleMarketPalace[afiContract][tok],
                    lpSharesAmount,
                    pendleWithdrawData
                );
                
                emit WithdrawPendle(afiContract, tok, lpSharesAmount, aTokensOut);
                
                // After withdrawing from Pendle, we might need to withdraw the aTokens from Aave
                address aToken = aaveTokenCopy[afiContract][tok];
                if (aToken != address(0)) {
                    // Calculate how many aTokens to withdraw based on the original asset amount
                    uint256 aTokensToWithdraw = aTokensOut;
                    if (aTokensToWithdraw > 0) {
                        IAFi(afiContract)._withdrawAave(tok, aTokensToWithdraw);
                        emit WithdrawAave(afiContract, tok, aTokensToWithdraw);
                    }
                }
                
                return true;
            }
        }
    }

    // Aave withdrawal (provider 1)
    if (aaveTokenCopy[afiContract][tok] != address(0) && provider[afiContract][tok] == 1) {
        uint256 aaveBalance = balanceAave(tok, afiContract);
        if (aaveBalance >= 1) {
            if (_amount > aaveBalance) {
                revert("Insufficient redemption balance!");
            } else {
                IAFi(afiContract)._withdrawAave(tok, _amount);
                emit WithdrawAave(afiContract, tok, _amount);
                return true;
            }
        }
    }
    
    // No matching provider found or insufficient balance
    return false;
}

  /**
   * @notice Checks if a token is of type USDC and retrieves its price and multiplier.
   * @param tok The address of the token.
   * @return The token's price and multiplier.
   */
  function getPriceInUSD(address tok) public view override returns (uint256, uint256) {
    return (IUniswapOracleV3(uniswapOracleV3).getPriceInUSD(tok));
  }

  /**
   * @notice Checks if a specific token is present, calculates redemption, and withdraws from pools.
   * @param uToken An array of token addresses.
   * @param r A parameter for calculation.
   * @param oToken The address of the output token.
   * @param afiContract The address of the AFi contract.
   */
  function checkIfTokenPresent(
    address[] memory uToken,
    uint r,
    address oToken,
    address afiContract,
    uint[] memory minimumReturnAmount,
    bytes calldata pendleWithdrawData
  ) internal {
    uint256 redemptionFromContract;
    bool stakedStatus;
    uint256 price;
    uint256 tvl;
    {
      (uint index, bool present) = ArrayUtils.indexOf(uToken, oToken);
      if (present) {
        (
          price,
          stakedStatus,
          redemptionFromContract,
          tempMultiplier,
          tvl
        ) = calculateRedemptionFromContract(afiContract, uToken[index], r);

        if (!stakedStatus) {
          redFromContract += redemptionFromContract;
        }
        if (stakedStatus) {
          if (price != 0) {
            withdrawFromPools(
              uToken[index],
              r,
              oToken,
              redemptionFromContract,
              price,
              minimumReturnAmount[index],
              tvl,
              pendleWithdrawData
            );
          }
        }
      }
    }
  }

  function swapInternal(
    address[] memory uToken,
    uint r,
    address oToken,
    uint[] memory minimumReturnAmount,
    bytes calldata pendleWithdrawData
  ) internal {
    address midTok;
    uint256 price;
    bool stakedStatus;
    uint256 redemptionFromContract;
    uint256 tvl;
    unchecked {
      for (uint n = 0; n < uToken.length; n++) {
        (
          price,
          stakedStatus,
          redemptionFromContract,
          tempMultiplier,
          tvl
        ) = calculateRedemptionFromContract(_afiTemp, uToken[n], r);
        if (!stakedStatus && uToken[n] != oToken) {
          if (balance(uToken[n], _afiTemp) > 0) {
            midTok = IPassiveRebal(rebal).getMidToken(uToken[n]);

            if (redemptionFromContract <= balance(uToken[n], _afiTemp)) {
              redFromContract += doSwapUsingDex(
                _afiTemp,
                uToken[n],
                oToken,
                redemptionFromContract,
                tempStorage,
                midTok,
                minimumReturnAmount[n]
              );
            } else {
              redFromContract += doSwapUsingDex(
                _afiTemp,
                uToken[n],
                oToken,
                IERC20(uToken[n]).balanceOf(_afiTemp),
                tempStorage,
                midTok,
                minimumReturnAmount[n]
              );
            }
          }
          continue;
        }
        if (stakedStatus && uToken[n] != oToken) {
          if (price != 0) {
            withdrawFromPools(
              uToken[n],
              r,
              oToken,
              redemptionFromContract,
              price,
              minimumReturnAmount[n],
              tvl,
              pendleWithdrawData
            );
          }
        }
      }
    }
  }

/**
 * @notice Withdraws all deposited balance from the protocols.
 * @dev Should only be called by the AFiManager, AFiStorage contracts.
 * @param afiContract The address of the AFi contract.
 * @param tok Address of the token to withdraw from protocols.
 * @param pendleWithdrawData Encoded data for Pendle withdrawal.
 * @return Boolean indicating if withdrawal was successful.
 */
function _withdrawAll(
    address afiContract,
    address tok,
    bytes calldata pendleWithdrawData
) public override returns (bool) {
    checkOracleAndManager();
    
    // Handle Pendle withdrawals if this token is staked in Pendle
    if (provider[afiContract][tok] == 2 && isPendleStaked[afiContract][tok]) {
        address pendleMarket = pendleMarketPalace[afiContract][tok];
        uint256 pendleLpBalance = balancePendle(tok, afiContract);
        
        if (pendleLpBalance > 1) {
            // Execute Pendle withdrawal using the provided withdrawal data
            (uint256 aTokensOut) = IAFi(afiContract).executeRouterCall(
                pendleMarket,
                pendleLpBalance - 1,
                pendleWithdrawData
            );
            
            emit WithdrawPendle(afiContract, tok, pendleLpBalance - 1, aTokensOut);
            
            // Reset Pendle staking flag
            isPendleStaked[afiContract][tok] = false;
        }
    }
    
    // Handle Aave withdrawals
    if (aaveTokenCopy[afiContract][tok] != address(0)) {
        uint256 aaveBalance = balanceAave(tok, afiContract);
        
        if (aaveBalance >= 1) {
            IAFi(afiContract)._withdrawAave(tok, aaveBalance);
            emit WithdrawAave(afiContract, tok, aaveBalance);
        }
    }
    
    // Reset staking flag
    _isStaked[afiContract][tok] = false;
    
    return true;
}

  function getAFiOracle() external view override returns (address) {
    return uniswapOracleV3;
  }

  function checkUnderlyingToken(
    address afiContract,
    uint r,
    address oToken,
    uint256 _cSwapCounter,
    address[] memory uTokens,
    uint256 deadline,
    uint256[] memory minimumAmountOut
  ) internal returns (uint256 available) {
    (, , uint256 typeOfProduct) = getVaultData(afiContract);
    require(typeOfProduct == 1 || typeOfProduct == 3, "AFS05");
    uint256 redemptionFromContract;
    uint256 balToConsider;
    preDep = IAFiManager(aFiManager).inputTokenUSD(
      IAFi(afiContract),
       getCSwapCounterFromVault(afiContract),
      IAFiStorage(address(this))
    );

    {
      (uint index, bool present) = ArrayUtils.indexOf(uTokens, oToken);
      if (present) {
        (,,redemptionFromContract,,) = calculateRedemptionFromContract(afiContract, uTokens[index], r);
       
        balToConsider =
        IERC20(uTokens[index]).balanceOf(afiContract) -
        preDepositedInputTokens[afiContract][_cSwapCounter][uTokens[index]];

        if (balToConsider >= redemptionFromContract){
          available += redemptionFromContract;
        } else {
          revert("Insufficient balance!");
        }
      }
    }

    for (uint i; i < uTokens.length; i++) {
      if(uTokens[i] != oToken){
        (, , redemptionFromContract, , ) = calculateRedemptionFromContract(
          afiContract,
          uTokens[i],
          r
        );

        balToConsider =
          IERC20(uTokens[i]).balanceOf(afiContract) -
          preDepositedInputTokens[afiContract][_cSwapCounter][uTokens[i]];
        if (balToConsider >= redemptionFromContract) {
          available += IAFi(afiContract).swapfromSelectiveDex(
            uTokens[i],
            oToken,
            redemptionFromContract,
            deadline,
            WETH,
            minimumAmountOut[i],
            new bytes(0)
          );
        } else {
          revert("Insufficient balance!");
        }
      }
    }
  }

  /**
   * @notice Distributes the profit share amongst team wallets.
   * @dev Only a specific address can call this function.
   * @param aFiContract Address of the aFi contract.
   * @param share The profit amount that is distributed amongst team wallets.
   * @param oToken Output token.
   * @param depositNAV NAV (Net Asset Value) at the time of deposit.
   * @param redemptionNAV NAV at the time of redemption.
   * @return totalProfitShare Returns the total profit share that was distributed amongst the team wallets.
   */
  function _distributeProfitShare(
    address aFiContract,
    uint share,
    address oToken,
    uint256 depositNAV,
    uint256 redemptionNAV
  ) internal returns (uint totalProfitShare) {
    uint256 profitShare;
    (uint256 price, uint256 multiplier) = getPriceInUSD(oToken);

    if (price != 0) {
      profitShare =
        ((redemptionNAV - (depositNAV)) * (share) * (10 ** multiplier)) /
        (((uint(price)) * (10 ** (validateAndGetDecimals(oToken)))) * (10000));
      totalProfitShare = profitDistribution(aFiContract, profitShare, oToken);
    }
  }

  function profitDistribution(
    address aFiContract,
    uint256 profitShare,
    address oToken
  ) internal returns (uint totalProfitShare) {
    // Investor has made a profit, let us distribute the profit share amongst team wallet
    address[] memory _teamWallets = getTeamWalletsOfAFi(aFiContract);
    uint256 teamProfitShare;
    uint256 totalProfit = IUniswapOracleV3(uniswapOracleV3).getTotalProfit();
    uint256 daoProfit = IUniswapOracleV3(uniswapOracleV3).getDaoProfit();
    // Alpha Creator gets 4% of gain

    uint totalActive = getTotalActiveWallets(aFiContract);
    if (totalActive > 1) {
      teamProfitShare =
        (profitShare * (totalProfit - daoProfit)) /
        ((totalActive - 1) * (100));
    }

    for (uint i = 0; i < _teamWallets.length; i++) {
      (bool isActive, ) = getTeamWalletDetails(aFiContract, _teamWallets[i]);

      if (isActive) {
        if (i == 0) {
          // /**
          //   Always at i==0 address must be of Aarna Dao
          //   Aarna DAO gets 6% of gain
          // */
          uint256 daoProfitShare = (profitShare * (daoProfit)) / (100);
          profitShare = daoProfitShare;
        } else {
          profitShare = teamProfitShare;
        }

        totalProfitShare = totalProfitShare + profitShare;

        IAFi(aFiContract).sendProfitOrFeeToManager(
          _teamWallets[i],
          profitShare,
          oToken
        );

        emit ProfitShareDistributed(aFiContract, _teamWallets[i], profitShare);
      }
    }
  }

  function setStablesWithdrawalLimit(
    address afiContract,
    address iToken,
    uint256 limit
  ) external onlyOwner {
    validateGreater(limit);
    stablesWithdrawalLimit[afiContract][iToken] = limit;
  }


  function doSwapUsingDex(
    address aFiContract,
    address tok,
    address oToken,
    uint256 amount,
    uint256 deadline,
    address midTok,
    uint256 _minimumReturnAmount
  ) internal returns (uint256 returnAmount) {
    (returnAmount) = IAFi(aFiContract).swapfromSelectiveDex(
      tok,
      oToken,
      amount,
      deadline,
      midTok,
      _minimumReturnAmount,
      new bytes(0)
    );
  }

  function convertInUSDAndTok(
    address tok,
    uint256 amt,
    bool usd
  ) public view override returns (uint256) {
    (uint256 price, uint256 decimal) = getPriceInUSD(tok);
    uint256 iTokenDecimal = validateAndGetDecimals(tok);
    if (!usd) {
      return ((((amt) * (price)) * (10 ** iTokenDecimal)) / (10 ** decimal));
    } else {
      return (amt * (10 ** decimal)) / ((price) * (10 ** iTokenDecimal));
    }
  }

  function setPreDepositedInputToken(
    uint256 _cSwapCounter,
    uint256 _amount,
    address _oToken
  ) external override {
    preDepositedInputTokens[msg.sender][_cSwapCounter][_oToken] += _amount;
  }

  /**
   * @notice sets the pre-swap deposits of a specific stable token and request should come from afimanager.
   * @param aficontract Address of the afi vault.
   * @param _cSwapCounter value of the current cswap counter of the aficontract.
   * @param _amount of oToken.
   * @param _oToken address of oToken.
   */
  function setPreDepositedInputTokenInRebalance(
    address aficontract,
    uint256 _cSwapCounter,
    uint256 _amount,
    address _oToken
  ) external override {
    checkOracleAndManager();
    preDepositedInputTokens[aficontract][_cSwapCounter][_oToken] += _amount;
  }

  function checkOracleAndManager() internal view {
    require(msg.sender == uniswapOracleV3 || msg.sender == aFiManager, "AFS02");
  }

  function deletePreDepositedInputToken(
    address aFiContract,
    address oToken,
    uint256 currentCounter
  ) external override {
    validateCaller(msg.sender, aFiManager);
    delete preDepositedInputTokens[aFiContract][currentCounter][oToken];
  }

  /**
   * @notice Returns the pre-swap deposits of a specific stable token.
   * @param stableToken Address of the stable token.
   * @return The amount of pre-swap deposits for the specified stable token.
   */
  function getPreSwapDepositsTokens(
    address aFiContract,
    uint256 _cSwapCounter,
    address stableToken
  ) external view override returns (uint256) {
    return preDepositedInputTokens[aFiContract][_cSwapCounter][stableToken];
  }

  function doSwapForThewhiteListRemoval(
    address tok,
    uint256 _cSwapCounter,
    address swapToken,
    uint256 deadline,
    uint256 minAmountOut,
    bytes calldata swapData
  ) external override {
    uint256 redemptionBalance = preDepositedInputTokens[msg.sender][_cSwapCounter][tok];
    address[] memory uTokens = IAFi(msg.sender).getUTokens();
    (, bool isPresent) = uTokens.indexOf(tok);
    uint256 balToConsider = IERC20(swapToken).balanceOf(msg.sender);
    uint256 totalBalanceInputToken = IERC20(tok).balanceOf(msg.sender);
    if (totalBalanceInputToken > redemptionBalance && !isPresent) {
      redemptionBalance = totalBalanceInputToken;
    }
    IAFi(msg.sender).swapfromSelectiveDex(
      tok,
      swapToken,
      redemptionBalance,
      deadline,
      WETH,
      minAmountOut,
      swapData
    );
    balToConsider = IERC20(swapToken).balanceOf(msg.sender) - balToConsider;
    delete preDepositedInputTokens[msg.sender][_cSwapCounter][tok];
    preDepositedInputTokens[msg.sender][_cSwapCounter][swapToken] += balToConsider;
  }

  function getPendleStakeStatus(address atvContract, address token) public override view returns (bool){
    return isPendleStaked[atvContract][token];
  }
}
