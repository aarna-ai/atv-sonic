// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {SafeERC20} from "./SafeERC20.sol";
import {ISwapRouter} from "./ISwapRouter.sol";
import {IPassiveRebal} from "./IPassiveRebal.sol";
import {IERC20} from "./IERC20.sol";
import {OwnableDelayModule} from "./OwnableDelayModule.sol";

interface IAFiBase {
  function invoke(
    address target,
    uint256 value,
    bytes calldata data
  ) external returns (bytes memory);
}

interface IOdosRouter {
  function swapCompact() external payable returns (uint256);

  function swap(
    SwapTokenInfo memory tokenInfo,
    bytes calldata pathDefinition,
    address executor,
    uint32 referralCode
  ) external payable returns (uint256);
}

struct SwapTokenInfo {
  address inputToken;
  uint256 inputAmount;
  address inputReceiver;
  address outputToken;
  uint256 outputQuote;
  uint256 outputMin;
  address outputReceiver;
}

contract AtvDexAdapter is OwnableDelayModule {
  using SafeERC20 for IERC20;

  // Mapping to track allowed AtvBase contracts
  mapping(address => bool) public allowedAtvContracts;
  mapping(address => address) internal atvContractController;

  event AtvContractAllowed(address indexed atvContract, bool allowed);

  ISwapRouter public immutable uniswapRouter;
  address public immutable odosRouter;
  IPassiveRebal public rebalContract;

  enum DexChoice {
    UNISWAP_V3,
    ODOS,
    NONE
  }

  constructor(address _uniswapRouter, address _odosRouter, address _rebalContract) {
    uniswapRouter = ISwapRouter(_uniswapRouter);
    odosRouter = _odosRouter;
    rebalContract = IPassiveRebal(_rebalContract);
  }

  function swap(
    address base,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 deadline,
    address middleToken,
    uint256 minimumReturnAmount,
    bytes calldata odosSwapData
  ) external returns (uint256 amountOut) {
    require(allowedAtvContracts[base], "Not an allowed AtvBase contract");
    require(msg.sender == base, "Caller must be AFiBase");
    IPassiveRebal.DexChoice rebalDex = rebalContract.getDexType(tokenIn, tokenOut);
    DexChoice dex = DexChoice(uint8(rebalDex));
    if (dex == DexChoice.UNISWAP_V3 || odosSwapData.length == 0) {
      amountOut = _swapUniswapV3(
        base,
        tokenIn,
        tokenOut,
        amountIn,
        deadline,
        middleToken,
        minimumReturnAmount
      );
    } else if (dex == DexChoice.ODOS) {
      amountOut = _swapOdos(
        base,
        tokenIn,
        tokenOut,
        amountIn,
        minimumReturnAmount,
        odosSwapData
      );
    }
    require(amountOut >= minimumReturnAmount, "Insufficient output amount");
    return amountOut;
  }

  function _swapUniswapV3(
    address base,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 deadline,
    address middleToken,
    uint256 minimumReturnAmount
  ) internal returns (uint256 amountOut) {
    bytes memory swapParams = rebalContract.uniswapV3Oracle(
      base,
      tokenIn,
      tokenOut,
      amountIn,
      deadline,
      middleToken,
      minimumReturnAmount
    );
    bytes memory callData;
    if (
      middleToken == address(0) || tokenIn == middleToken || tokenOut == middleToken
    ) {
      ISwapRouter.ExactInputSingleParams memory params = abi.decode(
        swapParams,
        (ISwapRouter.ExactInputSingleParams)
      );
      callData = abi.encodeWithSelector(ISwapRouter.exactInputSingle.selector, params);
    } else {
      ISwapRouter.ExactInputParams memory params = abi.decode(
        swapParams,
        (ISwapRouter.ExactInputParams)
      );
      callData = abi.encodeWithSelector(ISwapRouter.exactInput.selector, params);
    }

    bytes memory result = IAFiBase(base).invoke(address(uniswapRouter), 0, callData);
    amountOut = abi.decode(result, (uint256));
  }

  function _swapOdos(
    address base,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minimumReturnAmount,
    bytes calldata swapData
  ) internal returns (uint256 amountOut) {
    require(swapData.length >= 4, "Invalid swap data");

    // Verify it's the swapCompact function
    bytes4 selector = bytes4(swapData[:4]);
    require(selector == IOdosRouter.swapCompact.selector, "Invalid Odos function");

    // Get starting balances
    uint256 srcBalBefore = IERC20(tokenIn).balanceOf(base);
    uint256 destBalBefore = IERC20(tokenOut).balanceOf(base);

    // Execute the swap through the Odos router
    IAFiBase(base).invoke(odosRouter, 0, swapData);

    // Verify the correct amount of input token was used
    uint256 srcBalAfter = IERC20(tokenIn).balanceOf(base);
    uint256 spentAmount = srcBalBefore - srcBalAfter;
    require(spentAmount <= amountIn, "Spent more than allowed");

    // Calculate the amount received
    amountOut = IERC20(tokenOut).balanceOf(base) - destBalBefore;

    // Validate the output amount meets the minimum requirement
    require(amountOut >= minimumReturnAmount, "Insufficient output amount");
   
    return amountOut;
  }

  function getDexChoice(
    address tokenIn,
    address tokenOut,
    bytes calldata odosSwapData
  ) public view returns (DexChoice) {
    IPassiveRebal.DexChoice rebalDex = rebalContract.getDexType(tokenIn, tokenOut);
    DexChoice dex = DexChoice(uint8(rebalDex));
    if (dex == DexChoice.UNISWAP_V3 || odosSwapData.length == 0) {
      return DexChoice.UNISWAP_V3;
    } else if (dex == DexChoice.ODOS) {
      return DexChoice.ODOS;
    }
    return DexChoice.NONE;
  }

  function getDexType(
    address tokenIn,
    address tokenOut
  ) external view returns (DexChoice) {
    IPassiveRebal.DexChoice rebalDex = rebalContract.getDexType(tokenIn, tokenOut);
    return DexChoice(uint8(rebalDex));
  }

  /**
   * @notice Sets whether an AtvBase contract is allowed to interact with this contract
   * @param atvContract The AtvBase contract address
   * @param allowed True to allow, false to disallow
   */
  function setAtvContractAllowed(address atvContract, bool allowed) external {
    require(atvContract != address(0), "Invalid AtvBase contract address");
    require(msg.sender == atvContractController[atvContract], "Not authorized");
    allowedAtvContracts[atvContract] = allowed;
    emit AtvContractAllowed(atvContract, allowed);
  }

  function setAtvContractController(
    address atvContract,
    address _atvContractController
  ) external onlyOwner {
    require(_atvContractController != address(0), "Invalid controller address");
    atvContractController[atvContract] = _atvContractController;
  }

}
