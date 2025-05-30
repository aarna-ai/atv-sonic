// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;


interface IAFiFactory {
    event TokenCreated(address indexed token, string name, string symbol);
    event AddUnderlyingTokens(address indexed afiContract, address utoken);

    function allUnderlyingTokensLength() external view returns (uint256);

    function afiProductsCount() external view returns (uint256);
    
    function getPricePerFullShare(address afiContract, address afiStorage) external view returns (uint256);

    function afiContractInitUpdate(address aFiContract, uint256 order) external;

    function getAFiInitStatus(address aFiContract) external view returns (bool, bool);

    function getAFiTokenStatus(address _aFiContract) external view returns (bool);
}
