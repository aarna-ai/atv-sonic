// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAtvWalletManager {
    struct TeamWallet {
        address walletAddress;
        bool isPresent;
        bool isActive;
    }

    // Events
    event TeamWalletAdd(address indexed aFiContract, address indexed wallet, bool isActive);
    event TeamWalletStatusChanged(address indexed aFiContract, address indexed wallet, bool isActive);
    event TeamWalletsInitialized(address indexed aFiContract, address[] wallets);
    event AFiManagerUpdated(address indexed newManager);

    // Wallet Management Functions
    function addTeamWallet(
        address aFiContract,
        address wallet,
        bool isActive,
        bool isPresent
    ) external;

    function deactivateTeamWallet(
        address aFiContract,
        address wallet
    ) external;

    function reActivateTeamWallet(
        address aFiContract,
        address wallet
    ) external;

    function setTeamWallets(
        address aFiContract,
        address[] memory _teamWallets
    ) external;

    // View Functions
    function getTeamWalletDetails(
        address aFiContract,
        address _wallet
    ) external view returns (bool isActive, bool isPresent);

    function getTeamWalletsOfAFi(
        address aFiContract
    ) external view returns (address[] memory);

    function getTotalActiveWallets(
        address aFiContract
    ) external view returns (uint);

    function hasInitializedWallets(
        address aFiContract
    ) external view returns (bool);

    // Configuration Functions
    function setAFiActive(address aFiContract, bool active) external;
    function updateAFiManager(address newManager) external;

    // State Accessors
    function aFiManager() external view returns (address);
    function aFiFactory() external view returns (address);
    function isAFiActive(address aFiContract) external view returns (bool);
}