// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract TimeDelayModule {
    address public admin;
    address public rescindController;
    address public rescindChangeController;
    uint256 public delay;
    uint256 public expirationPeriod;

    mapping(bytes32 => uint256) public queuedTransactions;

    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);

    constructor(address _rescindChangeController,  uint256 _delay, uint256 _expirationPeriod ) {
        require(_delay > 0, "Timelock: Delay must be greater than zero");
        admin = msg.sender;
        rescindController = msg.sender;
        delay = _delay;
        rescindChangeController = _rescindChangeController;
        expirationPeriod = _expirationPeriod;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Timelock: Caller is not the admin");
        _;
    }

    modifier onlyRescindController() {
        require(msg.sender == rescindController, "Timelock: Caller is not the rescind controller");
        _;
    }

    modifier onlyRescindChangeController() {
        require(msg.sender == rescindChangeController, "Timelock: Caller is not the rescindChangeController");
        _;
    }


    function queueTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 eta
    ) public onlyAdmin returns (bytes32) {
        require(eta >= block.timestamp + delay, "Timelock: Estimated execution block must satisfy delay");

        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        queuedTransactions[txHash] = eta;

        emit QueueTransaction(txHash, target, value, data, eta);
        return txHash;
    }

    function cancelTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 eta
    ) public onlyRescindController {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        require(queuedTransactions[txHash] != 0, "Timelock: Transaction not found");
        delete queuedTransactions[txHash];
        emit CancelTransaction(txHash, target, value, data, eta);
    }

    function executeTransaction(
        address target,
        uint256 value,
        bytes memory data,
        uint256 eta
    ) public payable onlyAdmin returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        require(queuedTransactions[txHash] != 0, "Timelock: Transaction not found");

        require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
        require(block.timestamp <= eta + expirationPeriod, "Timelock: Transaction is stale");

        delete queuedTransactions[txHash];      

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "Timelock: Transaction execution reverted");

        emit ExecuteTransaction(txHash, target, value, data, eta);

        return returnData;
    }

    function updateRescindController(address newController) public onlyRescindChangeController {
        rescindController = newController;
    }

    function updateAdmin(address newAdmin) public {
        require(msg.sender == address(this), "Timelock: must be called by this contract only");
        admin = newAdmin;
    }

    function updateDelay(uint256 newDelay) public onlyRescindController {
        require(newDelay > 0, "Timelock: Delay must be greater than zero");
        delay = newDelay;
    }

    function updateExpirationPeriod(uint256 newExpirationPeriod) public onlyRescindController {
        require(newExpirationPeriod > 0, "Timelock: Expiration Period must be greater than zero");
        expirationPeriod = newExpirationPeriod;
    }

    function encodeEmergencyWithdraw(address param1, address param2) public pure returns(bytes memory ) {
        bytes memory data = abi.encodeWithSignature("emergencyWithdraw(address,address)", param1, param2);
        return data;
    }

    function encodeTransferOwnership(address newOwner) public pure returns(bytes memory ) {
        bytes memory data = abi.encodeWithSignature("transferOwnership(address)", newOwner);
        return data;
    }

    function encodeUpdateAdmin(address newOwner) public pure returns(bytes memory ) {
        bytes memory data = abi.encodeWithSignature("updateAdmin(address)", newOwner);
        return data;
    }
}