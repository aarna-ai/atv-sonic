// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {Clones} from "./Interfaces/Clones.sol";
import {OwnableDelayModule} from "./Interfaces/OwnableDelayModule.sol";
import "./Interfaces/IAFi.sol";
import "./Interfaces/IPassiveRebal.sol";

/**
 * @title AFiFactory.
 * @notice Factory contract for creating/deploying new ATokens.
 */
contract ParentAFiFactory is OwnableDelayModule {
  mapping(address => mapping(address => bool)) public isUnderlyingTokenPresent;
  address public aTokenImplementation;
  address[] public aFiProducts;
  mapping(address => bool) public isATokenPresent;
  mapping(address => bool) public initilizeStatus;
  mapping(address => bool) public initializeTokenStatus;

  event TokenCreated(address indexed token, string name, string symbol);
  event AddUnderlyingTokens(address indexed afiContract, address utoken);

  /**
   * @notice To initialize/deploy the AFiFactory contract.
   * @param _aTokenImplementation Address of AFiBase contract.
   */
  constructor(address _aTokenImplementation) {
    //solhint-disable-next-line reason-string
    require(_aTokenImplementation != address(0), "AF02");
    aTokenImplementation = _aTokenImplementation;
  }

  /**
   * @notice Returns afiProducts count.
   * @return uint256 Length of aFiProducts array
   */
  function afiProductsCount() external view returns (uint) {
    return aFiProducts.length;
  }

  /**
   * @notice To create new ATokens.
   * @dev The params must be equal. Aarna engine address & underlying token address cannot be zero address.
   * @param _name Name of AToken.
   * @param _symbol Symbol of AToken.
   * @param data encoded data.
   * @param _teamWallets array of team wallets.
   * @param _isActiveRebalanced i.e. active rebalance status of the afiContract.
   * @param _aFiStorage address of AFiStorage contract
   * @param _rebalContract address of AFiPassiveRebalStrategies contract
   * @param _aFiManager address of AFiManager
   * @return aTokenAddress returns address of created afi contract(aToken)
   */
  function createAToken(
    string memory _name,
    string memory _symbol,
    bytes memory data,
    address[] memory _teamWallets,
    bool _isActiveRebalanced,
    IAFiStorage _aFiStorage,
    IPassiveRebal _rebalContract,
    address _aFiManager,
    address[] memory _nonOverlappingITokens
  ) external onlyOwner returns (address aTokenAddress) {
    IAFi.PoolsData memory pooldata = abi.decode(data, (IAFi.PoolsData));
    require(
      pooldata._underlyingTokensProportion.length == pooldata._compound.length &&
        pooldata._compound.length == pooldata.compoundV3Comet.length &&
        pooldata.compoundV3Comet.length == pooldata._aaveToken.length &&
        pooldata._aaveToken.length == pooldata._priceOracles.length,
      "AF: Array lengths"
    );
    // Check if the sum of proportions is equal to 100%
    uint256 totalProportion;
    for (uint256 i = 0; i < pooldata._underlyingTokensProportion.length; i++) {
      totalProportion += pooldata._underlyingTokensProportion[i];
    }
    require(totalProportion == 10000000, "AF01");
    require(_aFiManager != address(0), "AF: zero addr");
    require(address(_aFiStorage) != address(0), "AF: zero addr");
    require(!checkForZeroAddress(_teamWallets), "AF: zero addr");
    require(_teamWallets.length > 0, "AF: Array Length");
    aTokenAddress = Clones.clone(aTokenImplementation);
    isATokenPresent[aTokenAddress] = true;
    aFiProducts.push(aTokenAddress);
    IAFi(aTokenAddress).initialize(
      msg.sender,
      _name,
      _symbol,
      data,
      _isActiveRebalanced,
      _aFiStorage,
      _nonOverlappingITokens
    );
    IAFi(aTokenAddress).initializeToken(
      pooldata._depositStableCoin,
      _teamWallets,
      _rebalContract,
      _aFiManager
    );
    emit TokenCreated(aTokenAddress, _name, _symbol);
  }

  function checkForZeroAddress(
    address[] memory inputAddresses
  ) internal pure returns (bool containZeroAddr) {
    uint len = inputAddresses.length;
    for (uint i = 0; i < len; i++) {
      if (inputAddresses[i] == address(0)) {
        return true;
      }
    }
    return false;
  }

  // The purpose of the function is to encode the pool data that follows the structure declared in IAFi.sol
  function encodePoolData(
    IAFi.PoolsData memory pooldata
  ) external pure returns (bytes memory) {
    return (abi.encode(pooldata));
  }

  // The purpose of the function is to encode the pool data that follows the structure declared in IAFi.sol
  function encodeUnderlyingData(
    IAFi.UnderlyingData memory uData
  ) external pure returns (bytes memory) {
    return (abi.encode(uData));
  }

  function getPricePerFullShare(
    address afiContract,
    address afiStorage
  ) public view returns (uint) {
    uint _pool = 0;
    uint256 _totalSupply = IERC20(afiContract).totalSupply();
    _pool = IAFiStorage(afiStorage).calculatePoolInUsd(afiContract);

    if (_totalSupply == 0) {
      return 1000000;
    }
    return (_pool * (10000)) / (_totalSupply);
  }

  // The purpose of this function is to call initialize functions of AFiContract only once
  function afiContractInitUpdate(address aFiContract, uint order) external {
    require(msg.sender == aFiContract, "NA");
    if (order == 1) {
      require(!initilizeStatus[aFiContract], "AF00");
      initilizeStatus[aFiContract] = true;
    } else if (order == 2) {
      require(!initializeTokenStatus[aFiContract], "AF00");
      initializeTokenStatus[aFiContract] = true;
    }
  }

  // Function returns the initialize status of an afi contract for all three initialize functions
  function getAFiInitStatus(address aFiContract) external view returns (bool, bool) {
    return (initilizeStatus[aFiContract], initializeTokenStatus[aFiContract]);
  }

  function getAFiTokenStatus(address _aFiContract) external view returns (bool) {
    return isATokenPresent[_aFiContract];
  }
}
