// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AFiExchangeMock is Ownable {
    IERC20 public usdtToken;
    IERC20 public afiToken;
    uint256 public constant USDT_TO_AFI_RATE = 100; // 100 USDT = 1 AFi

    mapping(address => uint256) public balanceOf;

    constructor(address _afiToken, address _usdtToken){  
        afiToken = IERC20(_afiToken);
        usdtToken = IERC20(_usdtToken);
    }

    // Function to swap USDT for AFi tokens
    function swapUSDTForAFi(uint256 usdtAmount) external {
        require(usdtAmount > 0, "Invalid USDT amount");

        // Calculate equivalent AFi amount
        uint256 afiAmount = usdtAmount / USDT_TO_AFI_RATE;

        require(usdtToken.transferFrom(msg.sender, address(this), usdtAmount), "USDT Transfer failed");

        require(afiToken.transfer(msg.sender, afiAmount), "AFi Transfer failed");

    }

    function depositAFiToken(uint256 afiAmount) external{
        require(afiToken.transferFrom(msg.sender, address(this), afiAmount), "AFi Transfer failed");
        balanceOf[address(this)] += afiAmount;
    }

   
}