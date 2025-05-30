// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

interface IPassiveRebal {

  // Enum for supported DEXs
  enum DexChoice {
    UNISWAP_V3,
    ONE_INCH,
    NONE
  }

  function applyRebalForProportions(
    address _aFiContract,
    address _aFiManager,
    address _aFiStorage,
    address[] memory _tokens,
    uint256 strategy
  ) external view returns (uint[] memory proportions, uint256 totalProp);

  function getPauseStatus() external returns (bool);
  
  function getRebalStrategyNumber(address aFiContract) external view returns (uint);

  function uniswapV3Oracle(
    address afiContract,
    address _tokenIn,
    address _tokenOut,
    uint _amountIn,
    uint _maxTime,
    address middleToken,
    uint256 minimumReturnAmount
  ) external returns (bytes memory swapParams);


  function getMidToken(address tok) external view returns (address);

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

  function getDexType(address tokenIn, address tokenOut) external view returns (DexChoice);

  function getPauseDepositController(address afiContract) external view returns (address);

  function getStalePriceDelay(address uToken) external view returns (uint256);

  function isSwapMethodPaused(address afiContract,uint swapMethod) external view returns (bool);

  function getMinimumAmountOut(
    address _tokenIn,
    uint256 _amountIn,
    address _tokenOut,
    address _uniPool
  ) external view returns (uint256 amountOut);

  function updateMidToken(address[] memory tok, address[] memory midTok) external;

  function getPreSwapDepositLimit() external view returns (uint256);

  function validateAndApplyRebalanceStrategy(
    address afiContract,
    address[] memory uTokens,
    uint256 toSwap,
    uint256 cSwapCounter
  ) external returns ( uint256 );

  function getNormalizedLpToAssetRate(address market) external view returns (uint256);
}
