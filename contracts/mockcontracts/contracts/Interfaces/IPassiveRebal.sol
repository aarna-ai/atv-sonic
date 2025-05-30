// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

interface IPassiveRebal {
  function applyRebalForProportions(
    address _aFiContract,
    address _aFiManager,
    address _aFiStorage,
    address[] memory _tokens,
    uint256 strategy
  ) external returns (uint[] memory proportions, uint256 totalProp);

  function getPauseStatus() external returns (bool);
  function getRebalStrategyNumber(address aFiContract) external returns (uint);

  function uniswapV3Oracle(
    address afiContract,
    address _tokenIn,
    address _tokenOut,
    uint _amountIn,
    uint _maxTime,
    address middleToken,
    uint256 minimumReturnAmount
  ) external returns (bytes memory swapParams);
  function getPool(address tok, address midTok) external view returns (address);

  function upDateInputTokPool(address[] memory iToken, bytes memory uniData) external;

  function getPriceOracle(address tok) external view returns (address);

  function updateOracleData(
    address _uToken,
    address _oracleAddress
  ) external;

   function removeToken(
    address[] memory _nonOverlappingITokens,
    address token
  ) external pure returns (address[] memory);

  function initUniStructure(
    address[] memory inputTokens,
    bytes memory _poolData
  ) external;
}
