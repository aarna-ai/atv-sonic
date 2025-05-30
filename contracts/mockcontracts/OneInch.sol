// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;
// import "../Interfaces/IERC20.sol";
// import "../Interfaces/SafeERC20.sol";
// import "hardhat/console.sol";

// interface IAggregationExecutor {
//   function callBytes(bytes calldata data) external payable;
// }

// interface IAggregationRouterV6 {
//   struct SwapDescription {
//     IERC20 srcToken;
//     IERC20 dstToken;
//     address srcReceiver;
//     address dstReceiver;
//     uint256 amount;
//     uint256 minReturnAmount;
//     uint256 flags;
//   }

//   function swap(
//     IAggregationExecutor caller,
//     SwapDescription calldata desc,
//     bytes calldata data
//   ) external payable returns (uint256 returnAmount, uint256 spentAmount);
// }

// contract OneInch {
//   using SafeERC20 for IERC20;
//   address public immutable ONEINCH_ROUTER;

//   event SwapExecuted(
//     address indexed srcToken,
//     address indexed dstToken,
//     uint256 srcAmount,
//     uint256 dstAmount
//   );

//   constructor(address _router) {
//     require(_router != address(0), "Invalid router address");
//     ONEINCH_ROUTER = _router;
//   }

//   function swapTokensOneInchV6(
//     bytes calldata swapdata,
//     address srcToken,
//     uint256 srcAmount
//   ) external payable returns (uint256 amountOut) {
//     //require(swapdata.length >= 4, "Invalid swap data length");

//     // Transfer tokens first if not ETH
//     if (srcToken != address(0)) {
//       IERC20(srcToken).safeTransferFrom(msg.sender, address(this), srcAmount);

//       // Approve 1inch router
//       IERC20(srcToken).safeApprove(ONEINCH_ROUTER, 0); // Reset approval
//       IERC20(srcToken).safeApprove(ONEINCH_ROUTER, srcAmount);
//     }

//     bytes calldata dataToValidate = swapdata[4:];
//     (   
//       address executor1,
//       IAggregationRouterV6.SwapDescription memory desc, // Use fully qualified name here // bytes memory data
//       bytes memory data1
//     ) = abi.decode(
//         dataToValidate,
//         (address, IAggregationRouterV6.SwapDescription, bytes)
//       );
//     desc.amount = srcAmount;
//     desc.minReturnAmount = 0;
//     console.log("srcAmount", srcAmount);
//     require(srcAmount >= desc.amount, "revert check");
//     console.log("desc.amount", desc.amount);

//     // // Forward the call to 1inch router
//     // (bool success, bytes memory returnData) = ONEINCH_ROUTER.call{value: msg.value}(swapdata);

//     (bool success, ) = ONEINCH_ROUTER.call{value: msg.value}(
//       abi.encodeWithSelector(
//         IAggregationRouterV6.swap.selector,
//         executor1,
//         desc,
//         data1
//       )
//     );
//     require(success, "Swap failed");

//     // // Decode the return value
//     // if (returnData.length >= 64) {
//     //   amountOut = abi.decode(returnData, (uint256));
//     // }

//     // // Reset approval
//     // if (srcToken != address(0)) {
//     //   IERC20(srcToken).safeApprove(ONEINCH_ROUTER, 0);
//     // }
//     return amountOut;
//   }

// // function swapTokensOneInchV6(
// //     bytes calldata swapdata,
// //     address srcToken,
// //     uint256 srcAmount
// // ) external payable returns (uint256 amountOut) {
// //     // Handle token approval first
// //     if (srcToken != address(0)) {
// //         IERC20(srcToken).safeTransferFrom(msg.sender, address(this), srcAmount);
// //         IERC20(srcToken).safeApprove(ONEINCH_ROUTER, srcAmount);
// //     }

// //     // Decode the entire swap data
// //     (address executor, IAggregationRouterV6.SwapDescription memory desc, bytes memory data) = 
// //         abi.decode(swapdata[4:], (address, IAggregationRouterV6.SwapDescription, bytes));
    
// //     // Validate amounts and add console logs
// //     require(srcAmount > 0, "Invalid source amount");
// //     console.log("srcAmount", srcAmount);
// //     console.log("desc.amount", desc.amount);
// //     //require(srcAmount >= desc.amount, "Amount check failed");

// //     if (srcAmount > desc.amount) {
// //         uint256 scalingFactor = (srcAmount * 1e18) / desc.amount;
// //         desc.minReturnAmount = (desc.minReturnAmount * scalingFactor) / 1e18;
// //         desc.amount = srcAmount;
// //     } else {
// //         revert("Amount cannot be less than quoted");
// //     }
    
// //     // Create new swap description with updated amount
// //     IAggregationRouterV6.SwapDescription memory newDesc = IAggregationRouterV6.SwapDescription({
// //         srcToken: desc.srcToken,
// //         dstToken: desc.dstToken,
// //         srcReceiver: desc.srcReceiver,
// //         dstReceiver: desc.dstReceiver,
// //         amount: srcAmount,  // Use the new amount
// //         minReturnAmount: 1,
// //         flags: desc.flags
// //     });

// //     // Add debug logs for the new description
// //     console.log("newDesc.amount", newDesc.amount);
// //     console.log("newDesc.minReturnAmount", newDesc.minReturnAmount);
// //     console.log("executor address", executor);

// //     // Make the swap call
// //     try IAggregationRouterV6(ONEINCH_ROUTER).swap{value: msg.value}(
// //         IAggregationExecutor(executor),
// //         newDesc,
// //         data
// //     ) returns (uint256 returnAmount, uint256 spentAmount) {
// //         console.log("Swap successful");
// //         console.log("returnAmount", returnAmount);
// //         console.log("spentAmount", spentAmount);
        
// //         amountOut = returnAmount;
// //         emit SwapExecuted(
// //             address(desc.srcToken),
// //             address(desc.dstToken),
// //             spentAmount,
// //             returnAmount
// //         );
// //     } catch (bytes memory reason) {
// //         console.log("Swap failed");
// //         // Revert with the actual error
// //         assembly {
// //             revert(add(reason, 0x20), mload(reason))
// //         }
// //     }

// //     // Reset approval
// //     if (srcToken != address(0)) {
// //         IERC20(srcToken).safeApprove(ONEINCH_ROUTER, 0);
// //     }

// //     return amountOut;
// // }

// //   receive() external payable {}

// //   fallback() external payable {}
// }
