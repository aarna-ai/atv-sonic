// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./Interfaces/IAFiStorage.sol";
import "./Interfaces/IAFi.sol";
import "./Interfaces/IUniswapV3.sol";
import {SafeCast} from "./Interfaces/SafeCast.sol";
import {ReentrancyGuard} from "./Interfaces/ReentrancyGuard.sol";
import {OwnableDelayModule} from "./Interfaces/OwnableDelayModule.sol";
import "./Libraries/ArrayUtils.sol";
import {AggregatorV3Interface} from "./Interfaces/AggregatorV3Interface.sol";
import "./Interfaces/IPassiveRebal.sol";
import "./Interfaces/IAFiFactory.sol";

interface Compound {
  function exchangeRateStored() external view returns (uint);
}

/**
 * @title AFiStorage.
 * @notice Storage conntract for storing investors and teamwallets details and performig the storage changes.
 * @dev Error codes: AFS01: Cannot be address zero. AFS02: Unauthorized caller.
 */
contract ParentAFiStorage is OwnableDelayModule, IAFiStorage, ReentrancyGuard {
  using SafeCast for uint256;
  using ArrayUtils for uint[];
  using ArrayUtils for address[];

  address private aFiManager;
  // List of TeamWallets, helpful when fetching team wallets report
  mapping(address => address[]) internal teamWalletsOfAFi;
  // aFiContract => investor => Investor Struct
  mapping(address => mapping(address => Investor)) internal investorInAFi;
  // aFiContract => teamWallet => TeamWallet Struct
  mapping(address => mapping(address => TeamWallet)) internal teamWalletInAFi;
  mapping(address => uint) internal totalActiveTeamWallets;
  mapping(address => bool) internal onlyOnce;
  mapping(address => bool) public isAFiActive;
  mapping(address => RebalanceDetails[]) internal _rebalanceDetails;
  mapping(address => mapping(uint256 => mapping(address => uint256)))
    public preDepositedInputTokens;
  uint256 internal preDep;

  mapping(address => uint256) public stablesWithdrawalLimit; // Amount in USD that can be withdrawn in between cumulative swaps
  mapping(address => mapping(uint256 => uint256)) public stablesWithdrawn; // Amount in USD that has been withdrawn in between cumulative swaps
  uint256 public maxSwapFee; // We set this parameter in % to calculate max fee that can be deducted in a swap

  uint256 internal redFromContract;
  mapping(address => uint256) internal lastSwapTime;
  address internal rebal;
  address internal _afiTemp;

  //synData
  mapping(address => mapping(address => address)) public aaveTokenCopy; // aaveToken address for various u tokens
  mapping(address => mapping(address => address)) public compoundCometCopy;
  mapping(address => mapping(address => address)) public compoundCopy;
  mapping(address => mapping(address => uint)) public provider; // Protocol where each u token is invested
  mapping(address => mapping(address => bool)) internal _isStaked;

  // State variables
  mapping(address => mapping(uint => bool)) public swapMethodPaused; // Mapping to keep track of paused swap methods

  address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  address private constant USDC_ORACLE = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
  address public immutable uniswapOracleV3;
  address public immutable aFiFactory;

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
      IAFiFactory(aFiFactory).getAFiTokenStatus(aFiContract) || msg.sender == _owner1,
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
    require(totalActiveTeamWallets[aFiContract] > 0, "AFS05");
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

  /**
   * @notice syncs the pool data of a token to the pool data of aficontract.
   * @param afiContract address of the afi contract.
   * @param tok address of the token to sync the pool data.
   * @param aaveTok address of the aave pool.
   * @param compComet compound v3 comet address of tok.
   * @param compTok address of the compound pool.
   */
  function afiSync(
    address afiContract,
    address tok,
    address aaveTok,
    address compComet,
    address compTok
  ) external override {
    validateCaller(msg.sender, afiContract);
    aaveTokenCopy[afiContract][tok] = aaveTok;
    compoundCometCopy[afiContract][tok] = compComet;
    compoundCopy[afiContract][tok] = compTok;
  }

  function balanceCompound(
    address tok,
    address afiContract
  ) public view returns (uint) {
    return IERC20(compoundCopy[afiContract][tok]).balanceOf(afiContract);
  }

  function balanceCompoundInToken(
    address tok,
    address afiContract
  ) public view returns (uint) {
    // Mantisa 1e18 to decimals
    uint b = balanceCompound(tok, afiContract);
    if (b >= 1) {
      b =
        (b * (Compound(compoundCopy[afiContract][tok]).exchangeRateStored())) /
        (1e18);
    }
    return b;
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
  function balance(address tok, address afiContract) internal view returns (uint) {
    return IERC20(tok).balanceOf(afiContract);
  }

  /**
   * @notice Returns the balance of compound v3 wrapper tokens in the AFi contract for a specific token.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return bal cUSDCv3 token balance.
   */
  function balanceCompV3(
    address tok,
    address afiContract
  ) public view returns (uint256 bal) {
    if (compoundCometCopy[afiContract][tok] != address(0)) {
      bal = IERC20(compoundCometCopy[afiContract][tok]).balanceOf(afiContract);
    }
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
   * @notice Calculates the total value of a token locked by the AFi contract in USD.
   * @param tok The address of the token.
   * @param afiContract The address of the AFi contract.
   * @return The total value of the token in USD.
   */
  function calcPoolValue(
    address tok,
    address afiContract
  ) public view override returns (uint) {
    (uint256 price, uint256 multiplier) = getPriceInUSDC(tok);
    (uint256 bal, uint256 uTokensDecimal) = tvlRead(tok, afiContract);
    if (price != 0) {
      bal = (bal) * (uint(price));
      bal = ((bal * (10 ** uTokensDecimal)) / (multiplier));
    }
    return bal;
  }

  function tvlRead(
    address tok,
    address afiContract
  ) public view override returns (uint, uint256) {
    uint uTokensDecimal = IERC20(tok).decimals();
    validateGreaterEqual(18, uTokensDecimal);
    uTokensDecimal = 18 - uTokensDecimal;
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
      compoundCopy[afiContract][tok] != address(0) && provider[afiContract][tok] == 1
    ) {
      bal += balanceCompoundInToken(tok, afiContract);
    }
    if (
      aaveTokenCopy[afiContract][tok] != address(0) && provider[afiContract][tok] == 2
    ) {
      bal += balanceAave(tok, afiContract);
    }
    if (
      compoundCometCopy[afiContract][tok] != address(0) &&
      provider[afiContract][tok] == 3
    ) {
      bal += balanceCompV3(tok, afiContract);
    }
    bal = (bal + balance(tok, afiContract));
  }

  // returns the TVL by the external protocols
  function calcPoolValueSomeRead(
    address tok,
    address afiContract,
    uint256 price,
    uint256 multiplier
  ) internal view returns (uint) {
    (uint bal, uint256 uTokensDecimal) = tvlRead(tok, afiContract);
    if (price != 0) {
      bal = (bal - (balance(tok, afiContract))) * (uint(price));
      bal = ((bal * (10 ** uTokensDecimal)) / (multiplier));
    }
    return bal;
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
    address[] memory uToken = new address[](IAFi(afiContract).getUTokens().length);
    uToken = IAFi(afiContract).getUTokens();
    (, address[] memory iToken) = IAFi(afiContract).getInputToken();
    uint uLen = uToken.length > iToken.length ? uToken.length : iToken.length;
    uint256 cSwapCounter = IAFi(afiContract).getcSwapCounter();
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
   * @param val2 The second value.
   */
  function validateGreaterEqual(uint256 val1, uint256 val2) internal pure {
    require(val1 >= val2, "AFS19");
  }

  /**
   * @notice Rearranges the staking of uTokens, withdrawing from existing pools and staking in recommended pools.
   * @param aFiContract The address of the AFi contract.
   */
  //90% uTokens will be staked on pool and 10% remain on contract
  function rearrange(
    address aFiContract,
    address[] memory underlyingTokens,
    uint256[] memory newProviders
  ) external override {
    (, , uint256 productType) = IAFi(aFiContract).getTVLandRebalContractandType();
    if (productType == 2) {
      validateCaller(msg.sender, uniswapOracleV3);
      require(underlyingTokens.length == newProviders.length, "AFS03");
      for (uint i = 0; i < underlyingTokens.length; i++) {
        address uToken = underlyingTokens[i];
        uint256 newProvider = newProviders[i];

        // Assuming provider is now a mapping to uint
        if (newProvider != provider[aFiContract][uToken]) {
          _isStaked[aFiContract][uToken] = false;
          _withdrawAll(aFiContract, uToken);
        }

        if (balance(uToken, aFiContract) > 0) {
          // 1 for COMPOUND II, 2 for AAVE, 3 for COMPOUND III

          if (newProvider == 2) {
            // AAVE
            if (aaveTokenCopy[aFiContract][uToken] != address(0)) {
              _isStaked[aFiContract][uToken] = true;
              IAFi(aFiContract)._supplyAave(
                uToken,
                (balance(uToken, aFiContract) * (90)) / (100)
              );
            }
          } else if (newProvider == 3) {
            // Compound III
            if (compoundCometCopy[aFiContract][uToken] != address(0)) {
              _isStaked[aFiContract][uToken] = true;

              IAFi(aFiContract)._supplyCompV3(
                uToken,
                (balance(uToken, aFiContract) * (90)) / (100)
              );
            }
          } else if (newProvider == 1) {
            // COMPOUND II
            if (compoundCopy[aFiContract][uToken] != address(0)) {
              _isStaked[aFiContract][uToken] = true;
              IAFi(aFiContract)._supplyCompound(
                uToken,
                ((balance(uToken, aFiContract) * (90)) / (100))
              );
            }
          }
        }

        provider[aFiContract][uToken] = newProvider;
      }
    }
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
    (uint256 price, uint256 dec) = getPriceInUSDC(iToken);
    uint8 decimals = 18 - IERC20(iToken).decimals();
    uint256 amountCheck = (amount * price * (10 ** decimals)) / dec;

    if (_totalSupply == 0) {
      shares = amountCheck / 100;
    } else {
      require(prevPool > 0, "AFB00007");
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
    uint swapMethod
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
    } else if (swapMethod == 2) {
      redemptionFromContract = checkiToken(
        params.r,
        params.oToken,
        params.cSwapCounter,
        params.iTokens,
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
        params.uTokens
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

  /**
   * @notice Swaps tokens in the AFi contract for another product.
   * @param afiContract The address of the AFi contract.
   * @param r A parameter for the swap.
   * @param oToken The address of the output token.
   * @param deadline The deadline for the swap.
   * @return The total amount swapped from the contract.
   */
  function swapForOtherProduct(
    address afiContract,
    uint r,
    address oToken,
    uint deadline,
    uint[] memory minimumReturnAmount,
    address[] memory uToken
  ) public override returns (uint256) {
    validateAddress(afiContract, address(0));
    aFiVaultCaller(afiContract, uniswapOracleV3);
    (, rebal, ) = IAFi(afiContract).getTVLandRebalContractandType();
    redFromContract = 0;
    _afiTemp = afiContract;

    preDep = IAFiManager(aFiManager).inputTokenUSD(
      IAFi(afiContract),
      IAFi(afiContract).getcSwapCounter(),
      IAFiStorage(address(this))
    );
    checkIfTokenPresent(uToken, r, oToken, deadline, afiContract, minimumReturnAmount);
    swapInternal(uToken, r, oToken, deadline, minimumReturnAmount);

    return redFromContract;
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
    (price, multiplier) = getPriceInUSDC(tok);
    (tvl, , ) = IAFi(afiContract).getTVLandRebalContractandType();
    uint256 tokPreDep = preDepositedInputTokens[afiContract][
      IAFi(afiContract).getcSwapCounter()
    ][tok];
    if (price != 0) {
      uint256 uTokensDecimal = validateAndGetDecimals(tok);
      uint256 tokPredepInUSD = (tokPreDep) * (uint(price));
      tokPredepInUSD = ((tokPredepInUSD * (10 ** uTokensDecimal)) / (multiplier));
      redemptionValueFromContract = (((r) *
        (calcPoolValue(tok, afiContract) - tokPredepInUSD)) * (multiplier));
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
   * @param deadline The deadline for the withdrawal.
   */
  function withdrawFromPools(
    address tok,
    uint r,
    address oToken,
    uint redemptionFromContract,
    uint deadline,
    uint256 price,
    uint256 multiplier,
    uint256 minimumReturnAmount,
    uint256 tvl
  ) internal {
    address midTok = IUniswapOracleV3(uniswapOracleV3).getMidToken(tok);
    {
      uint256 redemptionFromPool = calcPoolValueSomeRead(
        tok,
        _afiTemp,
        price,
        multiplier
      );
      redemptionFromPool = redemptionFromPool * (r) * (multiplier);
      redemptionFromPool =
        (redemptionFromPool) /
        ((tvl) * (uint(price)) * (10 ** validateAndGetDecimals(tok)));

      _withdrawSome(_afiTemp, tok, redemptionFromPool);
    }
    internalSwap(
      _afiTemp,
      tok,
      oToken,
      midTok,
      deadline,
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
      if (IERC20(tok).balanceOf(afiContract) > 0) {
        redFromContract += IAFi(afiContract).swapViaStorageOrManager(
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
   * @notice Returns pool to invest in, amount to invest and
   * deducted amount if there is a fluctuation or insufficient balance(rare case).
   */
  function _withdrawSome(
    address afiContract,
    address tok,
    uint _amount
  ) internal returns (bool withdrawal) {
    if (
      aaveTokenCopy[afiContract][tok] != address(0) && provider[afiContract][tok] == 2
    ) {
      if (balanceAave(tok, afiContract) >= 1) {
        if (_amount > balanceAave(tok, afiContract)) {
          revert("Insufficient redemption balance!");
        } else {
          IAFi(afiContract)._withdrawAave(tok, _amount);
        }
      }
      return true;
    }

    if (
      compoundCopy[afiContract][tok] != address(0) && provider[afiContract][tok] == 1
    ) {
      if (balanceCompound(tok, afiContract) >= 1) {
        if (_amount > balanceCompoundInToken(tok, afiContract)) {
          revert("Insufficient redemption balance!");
        } else {
          IAFi(afiContract)._withdrawCompound(tok, _amount);
        }
      }
      return true;
    }

    if (
      compoundCometCopy[afiContract][tok] != address(0) &&
      provider[afiContract][tok] == 3
    ) {
      if (balanceCompV3(tok, afiContract) >= 1) {
        if (_amount > balanceCompV3(tok, afiContract)) {
          revert("Insufficient redemption balance!");
        } else {
          IAFi(afiContract)._withdrawCompoundV3(tok, _amount);
        }
      }
      return true;
    }
  }

  /**
   * @notice Checks if a token is of type USDC and retrieves its price and multiplier.
   * @param tok The address of the token.
   * @return The token's price and multiplier.
   */
  function getPriceInUSDC(address tok) public view override returns (uint256, uint256) {
    return (IUniswapOracleV3(uniswapOracleV3).getPriceInUSDC(tok));
  }

  /**
   * @notice Checks if a specific token is present, calculates redemption, and withdraws from pools.
   * @param uToken An array of token addresses.
   * @param r A parameter for calculation.
   * @param oToken The address of the output token.
   * @param deadline The deadline for the swap.
   * @param afiContract The address of the AFi contract.
   */
  function checkIfTokenPresent(
    address[] memory uToken,
    uint r,
    address oToken,
    uint deadline,
    address afiContract,
    uint[] memory minimumReturnAmount
  ) internal {
    uint256 redemptionFromContract;
    bool stakedStatus;
    uint256 price;
    uint256 multiplier;
    uint256 tvl;
    {
      (uint index, bool present) = ArrayUtils.indexOf(uToken, oToken);
      if (present) {
        (
          price,
          stakedStatus,
          redemptionFromContract,
          multiplier,
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
              deadline,
              price,
              multiplier,
              minimumReturnAmount[index],
              tvl
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
    uint deadline,
    uint[] memory minimumReturnAmount
  ) internal {
    address midTok;
    uint256 price;
    bool stakedStatus;
    uint256 redemptionFromContract;
    uint256 multiplier;
    uint256 tvl;
    unchecked {
      for (uint n = 0; n < uToken.length; n++) {
        (
          price,
          stakedStatus,
          redemptionFromContract,
          multiplier,
          tvl
        ) = calculateRedemptionFromContract(_afiTemp, uToken[n], r);

        if (!stakedStatus && uToken[n] != oToken) {
          if (IERC20(uToken[n]).balanceOf(_afiTemp) > 0) {
            midTok = IUniswapOracleV3(uniswapOracleV3).getMidToken(uToken[n]);

            if (redemptionFromContract <= IERC20(uToken[n]).balanceOf(_afiTemp)) {
              redFromContract += IAFi(_afiTemp).swapViaStorageOrManager(
                uToken[n],
                oToken,
                redemptionFromContract,
                deadline,
                midTok,
                minimumReturnAmount[n]
              );
            } else {
              redFromContract += IAFi(_afiTemp).swapViaStorageOrManager(
                uToken[n],
                oToken,
                IERC20(uToken[n]).balanceOf(_afiTemp),
                deadline,
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
              deadline,
              price,
              multiplier,
              minimumReturnAmount[n],
              tvl
            );
          }
        }
      }
    }
  }

  /**
   * @notice _withdrawAll Function withdraws whole diposited balance from the pools(protocols).
   * @dev It should only be called by the AFiManager, AFiStorage contracts.
   * @param tok address of the token to withdraw from protocols.
   */
  function _withdrawAll(
    address afiContract,
    address tok
  ) public override returns (bool) {
    require(msg.sender == uniswapOracleV3 || msg.sender == aFiManager, "AFS02");
    uint poolBal;
    if (
      provider[afiContract][tok] == 1 && compoundCopy[afiContract][tok] != address(0)
    ) {
      if (balanceCompound(tok, afiContract) >= 1) {
        IAFi(afiContract)._withdrawCompound(
          tok,
          balanceCompoundInToken(tok, afiContract) - (1)
        );
      }
    }
    if (
      provider[afiContract][tok] == 2 && aaveTokenCopy[afiContract][tok] != address(0)
    ) {
      poolBal = balanceAave(tok, afiContract);
      if (poolBal >= 1) {
        IAFi(afiContract)._withdrawAave(tok, poolBal);
      }
    }
    if (
      provider[afiContract][tok] == 3 &&
      compoundCometCopy[afiContract][tok] != address(0)
    ) {
      poolBal = balanceCompV3(tok, afiContract);
      if (poolBal >= 1) {
        IAFi(afiContract)._withdrawCompoundV3(tok, poolBal);
      }
    }
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
    uint256 redemptionFromContract;
    uint256 balToConsider;
    preDep = IAFiManager(aFiManager).inputTokenUSD(
      IAFi(afiContract),
      IAFi(afiContract).getcSwapCounter(),
      IAFiStorage(address(this))
    );

    for (uint i; i < uTokens.length; i++) {
      (, , redemptionFromContract, , ) = calculateRedemptionFromContract(
        afiContract,
        uTokens[i],
        r
      );

      balToConsider =
        IERC20(uTokens[i]).balanceOf(afiContract) -
        preDepositedInputTokens[afiContract][_cSwapCounter][uTokens[i]];
      if (balToConsider >= redemptionFromContract && uTokens[i] != oToken) {
        available += IAFi(afiContract).swapViaStorageOrManager(
          uTokens[i],
          oToken,
          redemptionFromContract,
          deadline,
          WETH,
          minimumAmountOut[i]
        );
      } else if (balToConsider >= redemptionFromContract && uTokens[i] == oToken) {
        available += redemptionFromContract;
      } else {
        revert("Insufficient balance!");
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
    (uint256 price, uint256 multiplier) = getPriceInUSDC(oToken);

    if (price != 0) {
      profitShare =
        ((redemptionNAV - (depositNAV)) * (share) * (multiplier)) /
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
    uint256 limit
  ) external onlyOwner {
    require(limit > 0, "AFS07");

    stablesWithdrawalLimit[afiContract] = limit;
  }

  function setMaxSwapFee(uint256 fee) external onlyOwner {
    require(fee > 0 && fee < 10000, "AFS08");
    maxSwapFee = fee; // 100 = 1%
  }

  /**
   * @notice Checks the iToken and performs necessary deductions.
   * @dev This external function checks the iToken and performs deductions based on specified conditions.
   * @param r The redemption amount to be deducted.
   * @param oToken The address of the output token.
   * @param deadline The deadline for the transaction.
   * @return redemptionBalance The amount to be deducted.
   */
  function checkiToken(
    uint r,
    address oToken,
    uint256 _cSwapCounter,
    address[] memory token,
    uint256 deadline,
    uint256[] memory minimumReturnAmount
  ) internal returns (uint256 redemptionBalance) {
    redemptionBalance = preDepositedInputTokens[msg.sender][_cSwapCounter][oToken];
    uint temp = convertInUSDAndTok(oToken, redemptionBalance, false);

    if (temp >= r) {
      redemptionBalance = convertInUSDAndTok(oToken, r, true);
      preDepositedInputTokens[msg.sender][_cSwapCounter][oToken] -= redemptionBalance;
    } else {
      delete preDepositedInputTokens[msg.sender][_cSwapCounter][oToken];
      temp = r - temp;
      uint temp1;
      for (uint i; i < token.length; i++) {
        if (
          preDepositedInputTokens[msg.sender][_cSwapCounter][token[i]] > 0 &&
          token[i] != oToken
        ) {
          temp1 = convertInUSDAndTok(token[i], temp, true);
          if (temp1 > preDepositedInputTokens[msg.sender][_cSwapCounter][token[i]]) {
            redemptionBalance += IAFi(msg.sender).swapViaStorageOrManager(
              token[i],
              oToken,
              preDepositedInputTokens[msg.sender][_cSwapCounter][token[i]],
              deadline,
              WETH,
              minimumReturnAmount[i]
            );
            temp -= convertInUSDAndTok(
              token[i],
              preDepositedInputTokens[msg.sender][_cSwapCounter][token[i]],
              false
            );
            delete preDepositedInputTokens[msg.sender][_cSwapCounter][token[i]];
          } else {
            redemptionBalance += IAFi(msg.sender).swapViaStorageOrManager(
              token[i],
              oToken,
              temp1,
              deadline,
              WETH,
              minimumReturnAmount[i]
            );
            preDepositedInputTokens[msg.sender][_cSwapCounter][token[i]] -= temp1;
            delete temp;
            break;
          }
        }
      }
    }
    temp = (convertInUSDAndTok(oToken, r, true) * (10000 - maxSwapFee)) / 10000;
    uint256 tempInUSD = convertInUSDAndTok(oToken, temp, false);
    if (
      redemptionBalance < temp ||
      (stablesWithdrawn[msg.sender][_cSwapCounter] + tempInUSD) >
      stablesWithdrawalLimit[msg.sender]
    ) {
      revert("Insufficient balance!");
    } else {
      stablesWithdrawn[msg.sender][_cSwapCounter] += tempInUSD;
    }
  }

  function convertInUSDAndTok(
    address tok,
    uint256 amt,
    bool usd
  ) public view override returns (uint256) {
    (uint256 price, uint256 decimal) = getPriceInUSDC(tok);
    uint iTokenDecimal = 18 - IERC20(tok).decimals();
    if (!usd) {
      return ((((amt) * (price)) * (10 ** iTokenDecimal)) / (decimal));
    } else {
      return (amt * (decimal)) / ((price) * (10 ** iTokenDecimal));
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
    validateCaller(msg.sender, aFiManager);
    preDepositedInputTokens[aficontract][_cSwapCounter][_oToken] += _amount;
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
    uint256 minAmountOut
  ) external override {
    uint256 redemptionBalance = preDepositedInputTokens[msg.sender][_cSwapCounter][tok];
    uint256 balToConsider = IERC20(swapToken).balanceOf(msg.sender);
    IAFi(msg.sender).swapViaStorageOrManager(
      tok,
      swapToken,
      redemptionBalance,
      deadline,
      WETH,
      minAmountOut
    );
    balToConsider = IERC20(swapToken).balanceOf(msg.sender) - balToConsider;
    delete preDepositedInputTokens[msg.sender][_cSwapCounter][tok];
    preDepositedInputTokens[msg.sender][_cSwapCounter][swapToken] += balToConsider;
  }

  /**
   * @notice Pauses / unpauses specific swap methods in the contract.
   * @dev Requirements: Can only be invoked by the Delay Module.
   * @param methods An array of swap method IDs to be paused or unpaused.
   * @param statuses The status to set (true to pause, false to unpause).
   */
  function pauseSwapMethods(
    address afiContract,
    uint[] memory methods,
    bool[] memory statuses
  ) external {
    require(msg.sender == delayModule, "Caller is not the Delay Module"); // Ensures only the Delay Module can call this function
    for (uint i = 0; i < methods.length; i++) {
      swapMethodPaused[afiContract][methods[i]] = statuses[i];
    }
  }

  /**
   * @notice Check if a swap method is paused.
   * @dev This function can be used in the `withdraw` function to validate if a swap method is paused.
   * @param swapMethod The ID of the swap method to check.
   */
  function isSwapMethodPaused(
    address afiContract,
    uint swapMethod
  ) public view override returns (bool) {
    return swapMethodPaused[afiContract][swapMethod];
  }
}
