const payload = [
    [
        "0x6B175474E89094C44Da98b954EedeAC495271d0F", // underlying - DAI
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    ],
    [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    ],
    [
        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",  // pool DAI-WETH
        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
    ],
    [
        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",  // pool DAI-WETH
        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
    ],
    [
        [[
            "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
            "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"  // Pool USDT-WETH (Stables- I/O tokens)
        ]], [[
            "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
            "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"  // pool USDC-WETH (Stables- I/O tokens)
        ]]
    ],
    [
        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",   // deposit - weth 
        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"    // deposit - weth
    ]
]


module.exports = {
    payload
};
  