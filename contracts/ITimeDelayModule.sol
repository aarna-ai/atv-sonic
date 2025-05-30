// SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

/**
 * @title ITimeDelayModule.
 * @notice Interface of the DelayModule contract.
 */
interface ITimeDelayModule {

    function addToWhitelist(address _wCaller) external;
    
    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external returns (bytes32);

    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external;

    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external returns (bytes memory);

    function updateDelay(uint256 newDelay) external;
}