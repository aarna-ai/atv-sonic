// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "./IUniswapV3Factory.sol";
import "./IAFi.sol";

interface IUniswapOracleV3 {
  function PERIOD() external returns (uint256);

  function factory() external returns (address);

  function getTotalProfit() external view returns (uint256);

  function getDaoProfit() external view returns (uint256);
  
  function update(address _tokenIn, address _tokenOut) external;

  function quotePrice(IAFi aFiContract,address _tokenIn, address _depositToken, uint256 _amount) external view returns (uint256 price);


  function consult(
    address _tokenIn,
    uint256 _amountIn,
    address _tokenOut
  ) external view returns (uint256 _amountOut);

  function estimateAmountOut(
    address tokenIn,
    uint128 amountIn,
    address tokenOut
  ) external view returns (uint amountOut);

  function estimateAmountOutMin(
    address tokenIn,
    uint128 amountIn,
    address tokenOut,
    address pool
  ) external view returns (uint amountOut);

  function updateAndConsult(
    address _tokenIn,
    uint256 _amountIn,
    address _tokenOut
  ) external returns (uint256 _amountOut);

  function checkUnderlyingPool(address token) external view returns (bool hasPool);

  function getStalePriceDelay(address aFiContract, address uToken) external view returns(uint256);

  function getPriceAndDecimals(address aFiContract, address uToken, address feed) external view returns(int256 , uint8 );

  function getPriceInUSD(address tok) external view returns (uint256, uint256);

  function getControllers(address afiContract) external view returns(address, address);

  function cumulativeSwap(IAFi.SwapParameters memory params, uint256 pauseDepositFees, IAFi.SwapDataStructure calldata dexdata, bytes calldata cometSwapData, uint256 minAmountOut) external;
  
  function untrackedTokenSetByManager(address afiContract, address[] memory depositTokens, address[] memory uTok, uint256 csCounter) external;
}
