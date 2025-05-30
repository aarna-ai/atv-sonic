// // SPDX-License-Identifier: BUSL-1.1
// pragma solidity ^0.8.0;


// import "./IAFiFactory.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// contract AtvWalletManager is Ownable, ReentrancyGuard {
//     address public aFiManager;
//     address public immutable aFiFactory;

    
//   /**
//    * @notice Struct representing TeamWallet details.
//    * @param isPresent Boolean indicating whether a wallet exists.
//    * @param isActive Boolean indicating whether a wallet is active.
//    * @param walletAddress Wallet address.
//    */
//   struct TeamWallet {
//     bool isPresent;
//     bool isActive;
//     address walletAddress;
//   }

//     // Storage mappings
//     mapping(address => address[]) private _teamWalletsOfAFi;
//     mapping(address => mapping(address => TeamWallet)) private _teamWalletInAFi;
//     mapping(address => uint) private _totalActiveTeamWallets;
//     mapping(address => bool) private _onlyOnce;
//     mapping(address => bool) public isAFiActive;

//     event TeamWalletAdd(address indexed aFiContract, address indexed wallet, bool isActive);
//     event TeamWalletStatusChanged(address indexed aFiContract, address indexed wallet, bool isActive);
//     event TeamWalletsInitialized(address indexed aFiContract, address[] wallets);
//     event AFiManagerUpdated(address indexed newManager);

//     constructor(address _aFiManager, address _aFiFactory) {
//         require(_aFiManager != address(0), "WM01: Invalid AFiManager");
//         require(_aFiFactory != address(0), "WM01: Invalid AFiFactory");
//         aFiManager = _aFiManager;
//         aFiFactory = _aFiFactory;
//     }

//     // ============ MODIFIERS ============
//     modifier onlyAFiManager() {
//         require(msg.sender == aFiManager, "WM02: Caller is not AFiManager");
//         _;
//     }

//     modifier onlyAFiContract(address aFiContract) {
//         require(
//             IAFiFactory(aFiFactory).getAFiTokenStatus(aFiContract) &&
//             (msg.sender == aFiContract || msg.sender == aFiManager),
//             "WM03: Caller is not AFi contract"
//         );
//         _;
//     }

//     modifier validAFiContract(address aFiContract) {
//         require(aFiContract != address(0), "WM04: Invalid AFi contract");
//         require(isAFiActive[aFiContract], "WM05: AFi contract not active");
//         _;
//     }

//     // ============ WALLET MANAGEMENT ============
//     /**
//      * @notice To add a new team wallet
//      * @param aFiContract Address of the AFi contract
//      * @param wallet Wallet address to add
//      * @param isActive Whether wallet should be active
//      * @param isPresent Whether to mark wallet as present
//      */
//     function addTeamWallet(
//         address aFiContract,
//         address wallet,
//         bool isActive,
//         bool isPresent
//     ) external onlyAFiManager validAFiContract(aFiContract) nonReentrant {
//         require(wallet != address(0), "WM06: Invalid wallet address");
//         require(!_teamWalletInAFi[aFiContract][wallet].isPresent, "WM07: Wallet already exists");
//         require(_totalActiveTeamWallets[aFiContract] > 0 || !_onlyOnce[aFiContract], "WM08: No active wallets");

//         _teamWalletsOfAFi[aFiContract].push(wallet);
//         _teamWalletInAFi[aFiContract][wallet] = TeamWallet({
//             walletAddress: wallet,
//             isPresent: isPresent,
//             isActive: isActive
//         });

//         if (isActive) {
//             _totalActiveTeamWallets[aFiContract]++;
//         }

//         emit TeamWalletAdd(aFiContract, wallet, isActive);
//     }

//     /**
//      * @notice To deactivate a team wallet
//      * @param aFiContract Address of the AFi contract
//      * @param wallet Wallet address to deactivate
//      */
//     function deactivateTeamWallet(
//         address aFiContract,
//         address wallet
//     ) external onlyOwner validAFiContract(aFiContract) nonReentrant {
//         require(_teamWalletInAFi[aFiContract][wallet].isPresent, "WM09: Wallet not found");
//         require(_teamWalletInAFi[aFiContract][wallet].isActive, "WM10: Wallet already inactive");

//         _teamWalletInAFi[aFiContract][wallet].isActive = false;
//         _totalActiveTeamWallets[aFiContract]--;

//         emit TeamWalletStatusChanged(aFiContract, wallet, false);
//     }

//     /**
//      * @notice To reactivate a team wallet
//      * @param aFiContract Address of the AFi contract
//      * @param wallet Wallet address to reactivate
//      */
//     function reActivateTeamWallet(
//         address aFiContract,
//         address wallet
//     ) external onlyOwner validAFiContract(aFiContract) nonReentrant {
//         require(_teamWalletInAFi[aFiContract][wallet].isPresent, "WM11: Wallet not found");
//         require(!_teamWalletInAFi[aFiContract][wallet].isActive, "WM12: Wallet already active");

//         _teamWalletInAFi[aFiContract][wallet].isActive = true;
//         _totalActiveTeamWallets[aFiContract]++;

//         emit TeamWalletStatusChanged(aFiContract, wallet, true);
//     }

//     /**
//      * @notice Initialize team wallets for an AFi contract
//      * @param aFiContract Address of the AFi contract
//      * @param _teamWallets Array of wallet addresses to initialize
//      */
//     function setTeamWallets(
//         address aFiContract,
//         address[] memory _teamWallets
//     ) external onlyAFiContract(aFiContract) nonReentrant {
//         require(!_onlyOnce[aFiContract], "WM13: Wallets already initialized");
//         require(_teamWallets.length > 0, "WM14: Empty wallet list");

//         _totalActiveTeamWallets[aFiContract] = _teamWallets.length;

//         for (uint i = 0; i < _teamWallets.length; i++) {
//             address wallet = _teamWallets[i];
//             require(wallet != address(0), "WM15: Invalid wallet address");
//             require(!_teamWalletInAFi[aFiContract][wallet].isPresent, "WM16: Duplicate wallet");

//             _teamWalletsOfAFi[aFiContract].push(wallet);
//             _teamWalletInAFi[aFiContract][wallet] = TeamWallet({
//                 walletAddress: wallet,
//                 isPresent: true,
//                 isActive: true
//             });
//         }

//         _onlyOnce[aFiContract] = true;
//         emit TeamWalletsInitialized(aFiContract, _teamWallets);
//     }

//     // ============ VIEW FUNCTIONS ============
//     function getTeamWalletDetails(
//         address aFiContract,
//         address _wallet
//     ) public view  validAFiContract(aFiContract) returns (bool isActive, bool isPresent) {
//         TeamWallet memory wallet = _teamWalletInAFi[aFiContract][_wallet];
//         return (wallet.isActive, wallet.isPresent);
//     }

//     function getTeamWalletsOfAFi(
//         address aFiContract
//     ) public view  validAFiContract(aFiContract) returns (address[] memory) {
//         return _teamWalletsOfAFi[aFiContract];
//     }

//     function getTotalActiveWallets(
//         address aFiContract
//     ) public view  validAFiContract(aFiContract) returns (uint) {
//         return _totalActiveTeamWallets[aFiContract];
//     }

//     // ============ ADMIN FUNCTIONS ============
//     function setAFiActive(address aFiContract, bool active) external  onlyOwner {
//         require(active != isAFiActive[aFiContract], "WM17: Status already set");
//         isAFiActive[aFiContract] = active;
//     }

//     function updateAFiManager(address newManager) external onlyOwner {
//         require(newManager != address(0), "WM18: Invalid manager address");
//         require(newManager != aFiManager, "WM19: Same manager address");
//         aFiManager = newManager;
//         emit AFiManagerUpdated(newManager);
//     }
// }