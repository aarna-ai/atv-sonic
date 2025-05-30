// SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

/**
 * @title IAFiStorage.
 * @notice Interface of the AFiStorage.
 */

interface IIEarnManager {
  function recommend(
    address _token,
    address afiBase,
    address afiStorage
  ) external view returns (string memory choice, uint capr, uint aapr, uint dapr);
}

interface IAFiStorage {
  /**
   * @notice Struct representing investor details.
   * @param isPresent Boolean indicating whether an investor exists.
   * @param uTokenBalance Investor underlying token balance.
   * @param investedAmount Amount of StableCoin invested in the underlying token
   */
  struct Investor {
    bool isPresent;
    uint depositNAV;
    uint redemptionNAV;
  }

  struct RedemptionParams {
        address baseContract;
        uint r;
        address oToken;
        uint256 cSwapCounter;
        address[] uTokens;
        address[] iTokens;
        uint256 deadline;
        uint256[] minimumReturnAmount;
        uint256 _pool;
        uint256 tSupply;
        uint256 depositNAV;
    }

  /**
   * @notice Struct representing TeamWallet details.
   * @param isPresent Boolean indicating whether a wallet exists.
   * @param isActive Boolean indicating whether a wallet is active.
   * @param walletAddress Wallet address.
   */
  struct TeamWallet {
    bool isPresent;
    bool isActive;
    address walletAddress;
  }

  /**
   * @notice Struct representing Rebalance details.
   * @param scenario Scenario can be either of 0, 1 or 2.
   * @param rebalancedUToken Address of the underlying token that is rebalanced.
   * @param rebalancedToUTokens Array of addresses of underlying tokens to which the uToken has been rebalanced.
   */
  struct RebalanceDetails {
    uint8 scenario;
    address rebalancedUToken;
    address[] rebalancedToUTokens;
  }

  /**
   * @param walletAddress Address of the wallet.
   * @param isActive Boolean indicating wallet active status.
   */
  event TeamWalletActive(address indexed walletAddress, bool isActive);

  /**
   * @param walletAddress Address of the wallet.
   * @param isActive Boolean indicating wallet active status.
   */
  event TeamWalletAdd(address indexed walletAddress, bool isActive);

  /**
   * @notice Returns the team wallet details.
   * @param aFiContract Address of the AFi contract.
   * @param _wallet Wallet address
   * @return isPresent Boolean indicating the present status of the wallet.
   * @return isActive Boolean indicating whether to set the wallet to either active/inactive.
   */
  function getTeamWalletDetails(
    address aFiContract,
    address _wallet
  ) external view returns (bool isPresent, bool isActive);



   function handleRedemption(RedemptionParams memory params, uint _shares, uint swapMethod) external  returns (uint256 redemptionFromContract);

  /**
   * @notice To add a new team wallet.
   * @param aFiContract Address of the AFi contract.
   * @param _wallet Wallet address that has to be added in the `teamWallets` array.
   * @param isActive Boolean indicating whether to set the wallet to either active/inactive.
   * @param isPresent Boolean indicating the present status of the wallet.
   */
  function addTeamWallet(
    address aFiContract,
    address _wallet,
    bool isActive,
    bool isPresent
  ) external;

  /**
   * @notice Returns the team wallets for an AFi.
   * @param aFiContract Address of the AFi contract.
   * @return _teamWallets Array of teamWallets.
   */
  function getTeamWalletsOfAFi(
    address aFiContract
  ) external view returns (address[] memory _teamWallets);

  /**
   * @notice Sets the address for team wallets.
   * @param aFiContract Address of the AFi contract.
   * @param _teamWallets Array of addresses for the team wallets.
   */
  function setTeamWallets(address aFiContract, address[] memory _teamWallets) external;

  /**
   * @notice Sets the status for the AFi in the storage contract.
   * @param aFiContract Address of the AFi contract.
   * @param active status for afiContracts.
   */
  function setAFiActive(address aFiContract, bool active) external;

  /**
   * @notice Sets Active Rebalance status of an AFi.
   * @param aFiContract Address of the AFi contract.
   * @param status indicating active rebalance status of the AFi contract.
   */
  function setActiveRebalancedStatus(address aFiContract, bool status) external;

  /**
   * @notice gets Active Rebalance status of an AFi.
   * @param aFiContract Address of the AFi contract.
   * @return _isActiveRebalanced bool indicating active rebalance status of the AFi contract.
   */
  function isAFiActiveRebalanced(
    address aFiContract
  ) external view returns (bool _isActiveRebalanced);

  function getTotalActiveWallets(address aFiContract) external view returns (uint);

  function calcPoolValue(
    address tok,
    address afiContract
  ) external view returns (uint);

  function calculateBalanceOfUnderlying(
    address tok,
    address afiContract
  ) external view returns (uint);

  function calculatePoolInUsd(address afiContract) external view returns (uint);

  function afiSync(
    address afiContract,
    address tok,
    address aaveTok,
    address compV3Comet,
    address compTok
  ) external;

  function getPriceInUSDC(
    address tok
  ) external view returns (uint256, uint256);

  function validateAndGetDecimals(address tok) external view returns (uint256);

  function getStakedStatus(
    address aFiContract,
    address uToken
  ) external view returns (bool);

  function rearrange(address aFiContract,address[] memory underlyingTokens, uint256[] memory newProviders) external;

  function swapForOtherProduct(
    address afiContract,
    uint r,
    address oToken,
    uint deadline,
    uint[] memory minimumReturnAmount,
    address[] memory uToken
  ) external returns (uint256);

  function _withdrawAll(address afiContract, address tok) external returns(bool);
  function getAFiOracle() external view returns(address);

  function calculateRedemptionFromContract(
    address afiContract,
    address tok,
    uint256 r
  ) external view returns (uint256, bool, uint256, uint256, uint256);



  function tvlRead(
    address tok,
    address afiContract
  ) external view returns (uint, uint256);

  function getPreSwapDepositsTokens(
    address aFiContract,
    uint256 _cSwapCounter,
    address stableToken
  ) external view returns (uint256);

  function setPreDepositedInputToken(uint256 _cSwapCounter, uint256 _amount,address _oToken) external;
  function setPreDepositedInputTokenInRebalance(
    address aficontract,
    uint256 _cSwapCounter,
    uint256 _amount,
    address _oToken
  ) external;

  function convertInUSDAndTok(
    address tok,
    uint256 amt,
    bool usd
  ) external view returns (uint256);

  function calculateShares(
    address afiContract,
    uint256 amount,
    uint256 prevPool,
    uint256 _totalSupply,
    address iToken,
    uint256 currentDepositNAV,
    uint256 prevBalance
  ) external view returns (uint256 shares, uint256 newDepositNAV);

  function deletePreDepositedInputToken(
    address aFiContract,
    address oToken,
    uint256 currentCounter
  )external;

  function doSwapForThewhiteListRemoval(
    address tok,
    uint256 _cSwapCounter,
    address swapToken,
    uint256 deadline,
    uint256 minAmountOut
  ) external;

  function isSwapMethodPaused(address afiContract,uint swapMethod) external view returns (bool);
}
