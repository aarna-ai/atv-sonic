// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {Ownable2Step} from "./Ownable2Step.sol";

contract OwnableDelayModule is Ownable2Step {
  address internal delayModule;

  constructor() {
    delayModule = msg.sender;
  }

  function isDelayModule() internal view {
    require(msg.sender == delayModule, "NA");
  }

  function setDelayModule(address _delayModule) external {
    isDelayModule();
    require(_delayModule != address(0), "ODZ");
    delayModule = _delayModule;
  }

  function getDelayModule() external view returns (address) {
    return delayModule;
  }

  /**
   * @dev Starts the ownership transfer of the contract to a new account. Replaces the pending transfer if there is one.
   * Can only be called by the current owner.
   */
  function transferOwnership(address newOwner) public override {
    isDelayModule();
    _pendingOwner = newOwner;
    emit OwnershipTransferStarted(owner(), newOwner);
  }
}
