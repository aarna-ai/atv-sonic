/* eslint-disable no-underscore-dangle */
const { assert, expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { time, constants } = require("@openzeppelin/test-helpers");
const { provider } = waffle;

const { abi: AFIBASE_ABI } = require('../artifacts/contracts/AtvBase.sol/AtvBase.json');

const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../utils/constants');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');


const getBigNumber = (number) => ethers.BigNumber.from(number);


describe('A', (accounts) => {
    let platformWallet; let recipient; let investor1; let investor2; let investor3;
    let rebalanceController;
    let deadline;
    let deployedAFiBase;
    let aTokenConInstance;
    let oneInchParam;


    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    let snapshotId;


    before(async () => {


        // Take EVM snapshot
        // snapshotId = await ethers.provider.send('evm_snapshot');


        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, investor3, rebalanceController] = userAccounts;
        const currentTime = await time.latest();
        deadline = currentTime + (60 * 60);
        const AFiBase = await ethers.getContractFactory('AtvBase');
        const AFiManager = await ethers.getContractFactory('AtvManager');
        const PassiveRebalanceStrategies = await ethers.getContractFactory('AtvPassiveRebalanceStrategies');
        const AFiStorage = await ethers.getContractFactory('AtvStorage');
        const AFiFacotry = await ethers.getContractFactory('AtvFactory');
        const AFiOracle = await ethers.getContractFactory('AtvOracle');
        console.log("check--------------------------1");

        // LOCAL CONTRACTS
        aFiBaseInstace = await AFiBase.deploy("AFi802", "AFi");
        aFiManagerInstance = await AFiManager.deploy();
        aFiPassiveRebalanceInstance = await PassiveRebalanceStrategies.deploy();
        aFiAFiOracleInstance = await AFiOracle.deploy(aFiPassiveRebalanceInstance.address);
        aFiFactoryInstance = await AFiFacotry.deploy(aFiBaseInstace.address);
        aFiStorageInstance = await AFiStorage.deploy(aFiManagerInstance.address, aFiAFiOracleInstance.address, aFiPassiveRebalanceInstance.address, aFiFactoryInstance.address);
        console.log("print the address of the aFiFactoryInstance", aFiFactoryInstance.address);

        const payload = [
            [
                "0x6B175474E89094C44Da98b954EedeAC495271d0F", // underlying - DAI
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
                "0xdAC17F958D2ee523a2206206994597C13D831ec7"  // USDT
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of USDT
            ]
        ]


        const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);


        const payloadnew = [
            ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
            ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
            uDataPayload,
            [
                "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
                "0x39AA39c021dfbaE8faC545936693aC917d5E7563",
                "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9"
            ],
            [
                "0x018008bfb33d285247A21d44E50697654f754e63",
                "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
                "0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a"
            ],
            [
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D"
            ],
            ["3000000", "3000000", "4000000"],
            ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
            2
        ]


        const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);


        result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, [], "0x0000000000000000000000000000000000000000");


        aTokenConInstance1 = await aFiFactoryInstance.aFiProducts(0);


        aTokenConInstance1 = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance1);


        console.log("check--------------------------1");



        aFiPassiveRebalanceInstance.intializeStalePriceDelay([
            "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        ], [
            86500,
            86500,
            86500
        ]);


        await aTokenConInstance1.setplatformWallet(platformWallet.address);
        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);


        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);


        // MAINNET CONTRACT INSTANCES
        daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

        const accountToInpersonate = "0x9E4E147d103deF9e98462884E7Ce06385f8aC540"
        const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [accountToInpersonate],
        });
        const signer = await ethers.getSigner(accountToInpersonate);


        // const ether = (amount) => {
        //     const weiString = ethers.utils.parseEther(amount.toString());
        //     return BigNumber.from(weiString);
        // };


        /**
        * GIVE APPROVAL TO AFi of DEPOSIT TOKEN
        * THIS IS REQUIRED WHEN 1% fee IS TRANSFEREED FROM INVESTOR TO PLATFORM WALLET
        */


        console.log("print the productttttttttttt", usdtConInstance.address);


        console.log("print the productttttttttttt", aTokenConInstance1.address);


        await usdtConInstance.connect(investor1).approve(
            aTokenConInstance1.address,
            ethers.constants.MaxUint256
        );


        await usdtConInstance.connect(investor2).approve(
            aTokenConInstance1.address,
            ethers.constants.MaxUint256
        );


        await usdcConInstance.connect(investor1).approve(
            aTokenConInstance1.address,
            ethers.constants.MaxUint256
        );


        await usdcConInstance.connect(investor2).approve(
            aTokenConInstance1.address,
            ethers.constants.MaxUint256
        );


        await daiConInstance.connect(investor1).approve(
            aTokenConInstance1.address,
            ethers.constants.MaxUint256
        );


        await daiConInstance.connect(investor2).approve(
            aTokenConInstance1.address,
            ethers.constants.MaxUint256
        );


        const daiBalance = await daiConInstance.balanceOf(accountToInpersonate)
        console.log("whale dai balance", daiBalance / 1e18)
        console.log("transfering to", accountToFund)




        // await daiConInstance.connect(signer).transfer(investor1.address, daiBalance);


        // const accountBalance = await daiConInstance.balanceOf(investor1.address)
        console.log("transfer complete")
        // console.log("funded account balance", accountBalance / 1e18)


        var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        usdcBalance = usdcBalance / 100;


        // console.log("usdcBalance",usdcBalance);
        // await usdcConInstance.connect(signer).transfer(investor1.address, "10654653354");
        // await usdcConInstance.connect(signer).transfer(investor2.address, "10654653354");


        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 100;
        console.log("usdtBalance", usdtBalance)
        await usdtConInstance.connect(signer).transfer(investor1.address, "10000000000");
        await usdtConInstance.connect(signer).transfer(investor2.address, "10000000000");


        await aFiPassiveRebalanceInstance.updateMidToken(
            [
                "0x6B175474E89094C44Da98b954EedeAC495271d0F", // underlying - DAI
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
                "0xdAC17F958D2ee523a2206206994597C13D831ec7"
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of USDT
            ]
        );


        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        await aFiPassiveRebalanceInstance.setPriceOracle(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F"
            ],
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
            ],
            [
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
            ], // USDT, USDC - chainlink oracles
            [
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
                "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
            ], // USDT, USDC - chainlink oracles
        );
        const poolPayload = [
            [
                "0x6B175474E89094C44Da98b954EedeAC495271d0F", // underlying - DAI
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
                "0xdAC17F958D2ee523a2206206994597C13D831ec7"
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of USDT
            ],
            [
                "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",  // pool DAI-WETH
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC - WETH
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"   // pool USDT - WETH
            ],
            [
                "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",  // pool DAI-WETH
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC - WETH
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"   // pool USDT - WETH
            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"  // Pool USDT-WETH (Stables- I/O tokens)
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"  // pool USDC-WETH (Stables- I/O tokens)
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
        ]
        const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
        await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata);


        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);
        await aFiManagerInstance.setRebalanceController(rebalanceController.address);
        await aTokenConInstance1.setMinDepLimit(100);
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance1.address, investor1.address);

        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        console.log("transfer completey")
        console.log("funded account balance usdttttttttt", investorusdtBalance)
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);

        oneInchParam = {
            firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
        }

    });
    describe('Basic checks for deposit and withdraw', () => {


        it('scenario 1 testing inmanager when stable token is usdt', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            console.log("Checkkkkkkkkk");
            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );


            const poolPayload = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
                    "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
                    "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"


                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
                    "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)


            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)


            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };


            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



            await aTokenConInstance1.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );


            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);


            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



            await aTokenConInstance1.connect(investor1).deposit(
                1000000000, usdtConInstance.address
            );


            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);


            let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);
            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



            let checkprop = await aTokenConInstance1.getProportions();
            console.log("before rebalance the proprtion==========>", checkprop);


            const numbers = [
                "1250230",
                "211379301119179471",
                "80080613841879501949",
                "34816381824594232923",
                "5355788253"
            ];


            const bigNumbers = numbers.map(num => BigNumber.from(num));


            const stringRepresentations = bigNumbers.map(bn => bn.toString());


            const swapParams = {
                afiContract: aTokenConInstance1.address,
                oToken: usdcConInstance.address,
                cSwapFee: 0,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0],
                iMinimumReturnAmount: [0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xdAC17F958D2ee523a2206206994597C13D831ec7"],
                newProviders: [2, 1, 3], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xc3d688B66703497DAA19211EEdff47f25384cdc3"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);


            const Afterbal1 = await aTokenConInstance1.balanceOf(investor1.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)


            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);


            const minimumReturnAmount =
                [
                    0,
                    0,
                    0,
                    0,
                    0
                ]


            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());


            console.log("check", Amount);


            usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("before withdraw usdtBalance", usdtBalance);


            const uniPayload = [[
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
                ]], [[
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]]


            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
            ]
            ]
            const encodedUniPayload = await aFiPassiveRebalanceInstance.encodePoolData(uniPayload);
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], encodedUniPayload)


            const newUToken = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
            const payload = [
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            ]
            const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)


            const bytesPayload = [
                ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], //USDT, USDC - payment tokens
                ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"], // USDT, USDC - chainlink oracles
                uDataPayload,


                [
                    "0x0000000000000000000000000000000000000000"
                ],
                [
                    "0x0000000000000000000000000000000000000000"
                ],
                [
                    "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
                ],
                ["0"],
                [
                    "0x0000000000000000000000000000000000000000"
                ],
                2,
            ]


            const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);
            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



            var res = await aTokenConInstance1.getProportions();
            console.log("uTokProp", res);


            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance1.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    1,
                    [],
                    res[0],
                    res[1],
                    1,
                    0
                ],
                deadline,
                [0, 0, 0],
                0,
                0,
                "0x",
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ]
            );


            res = await aTokenConInstance1.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance1.getProportions();
            console.log("after rebalance theproprtion", res);
            res = await aTokenConInstance1.getInputToken();
            console.log("after getInputToken theproprtion", res);
            // await ethers.provider.send('evm_revert', [snapshotId]);


        });


        // it('scenario 1 testing inmanager when stable token is usdt when adding a stable token again in the list and removing from the non overlapping', async () => {
        //     snapshotId = await ethers.provider.send('evm_snapshot');
        //     console.log("Checkkkkkkkkk");
        //     await aFiPassiveRebalanceInstance.updateMidToken(
        //         [
        //             "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //             "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //             "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //             "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
        //         ],
        //         [
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //         ]
        //     );


        //     const poolPayload = [
        //         [
        //             "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //             "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //             "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //             "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
        //             "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
        //         ],
        //         [
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //         ],
        //         [
        //             "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
        //             "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
        //             "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
        //             "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
        //             "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"


        //         ],
        //         [
        //             "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
        //             "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
        //             "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
        //             "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
        //             "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
        //         ],
        //         [
        //             [[
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //             ]],
        //             [[
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //             ]],
        //             [[
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //             ]]
        //         ],
        //         [
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //         ]
        //     ]


        //     const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
        //     await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)


        //     const accountBalance = await daiConInstance.balanceOf(investor1.address);


        //     console.log("transfer complete")
        //     console.log("funded account balance", accountBalance / 1e18)


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     await aTokenConInstance1.connect(investor1).deposit(
        //         3000000000, usdtConInstance.address
        //     );


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     await aTokenConInstance1.connect(investor1).deposit(
        //         1000000000, usdtConInstance.address
        //     );

        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);


        //     checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
        //     console.log("check nav ", `${checkNav}`);


        //     let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
        //     console.log("User NAVVVVV", `${nav2}`)
        //     let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
        //     console.log("after deposit usdtBalance", usdtBalance)
        //     await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);
        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     let checkprop = await aTokenConInstance1.getProportions();
        //     console.log("after rebalance theproprtion==========>", checkprop);


        //     const numbers = [
        //         "1250230",
        //         "211379301119179471",
        //         "80080613841879501949",
        //         "34816381824594232923",
        //         "5355788253"
        //     ];


        //     const bigNumbers = numbers.map(num => BigNumber.from(num));


        //     const stringRepresentations = bigNumbers.map(bn => bn.toString());


        //     const swapParams = {
        //         afiContract: aTokenConInstance1.address,
        //         oToken: usdcConInstance.address,
        //         cSwapFee: 0,
        //         cSwapCounter: 1,
        //         depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
        //         minimumReturnAmount: [0, 0, 0],
        //         iMinimumReturnAmount: [0, 0], // Adjust according to your contract's expectations
        //         underlyingTokens: ["0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xdAC17F958D2ee523a2206206994597C13D831ec7"],
        //         newProviders: [2, 3], // Fill this with the new providers' information
        //         _deadline: deadline,
        //         cometToClaim: ["0xc3d688B66703497DAA19211EEdff47f25384cdc3"],
        //         cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
        //         rewardTokenMinReturnAmounts: [0]
        //     };

        //     await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
        //     await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);


        //     const Afterbal1 = await aTokenConInstance1.balanceOf(investor1.address);
        //     console.log("Afterbal++++++3", `${Afterbal1}`)


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
        //     console.log("check nav ", `${checkNav}`);


        //     const minimumReturnAmount =
        //         [
        //             0,
        //             0,
        //             0,
        //             0,
        //             0
        //         ]


        //     const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
        //     const returnString = Amount.map(bn => bn.toString());


        //     console.log("check", Amount);


        //     usdtBalance = await usdtConInstance.balanceOf(investor1.address)
        //     console.log("before withdraw usdtBalance", usdtBalance);


        //     const uniPayload = [[
        //         "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        //     ],
        //     [
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //     ],
        //     [
        //         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
        //     ],
        //     [
        //         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
        //     ],
        //     [
        //         [[
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
        //         ]], [[
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
        //         ]]
        //     ],
        //     [
        //         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
        //         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        //         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //     ]
        //     ]
        //     const encodedUniPayload = await aFiPassiveRebalanceInstance.encodePoolData(uniPayload);
        //     await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], encodedUniPayload)


        //     const newUToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        //     const payload = [
        //         [
        //             "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        //         ],
        //         [
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //         ]
        //     ]
        //     const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)


        //     const bytesPayload = [
        //         ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], //USDT, USDC - payment tokens
        //         ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"], // USDT, USDC - chainlink oracles
        //         uDataPayload,
        //         [
        //             "0x0000000000000000000000000000000000000000"
        //         ],
        //         [
        //             "0x0000000000000000000000000000000000000000"
        //         ],
        //         [
        //             "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"
        //         ],
        //         ["0"],
        //         [
        //             "0x0000000000000000000000000000000000000000"
        //         ],
        //         2,
        //     ]


        //     const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

        //     var res = await aTokenConInstance1.getProportions();
        //     console.log("uTokProp", res);


        //     await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


        //     await aFiManagerInstance.connect(rebalanceController).rebalance(
        //         bytesData,
        //         [
        //             aTokenConInstance1.address,
        //             aFiStorageInstance.address,
        //             "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        //             newUToken,
        //             "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        //             2,
        //             [],
        //             res[0],
        //             res[1],
        //             1,
        //             2
        //         ],
        //         deadline,
        //         [0, 0],
        //         0,
        //         0,
        //         "0x",
        //         [
        //             "0x",
        //             "0x",
        //             "0x",
        //             "0x",
        //             "0x"
        //         ]
        //     );


        //     res = await aTokenConInstance1.getUTokens();
        //     console.log("uTokProp", res);
        //     res = await aTokenConInstance1.getProportions();
        //     console.log("after rebalance theproprtion", res);
        //     res = await aTokenConInstance1.getInputToken();
        //     console.log("after getInputToken theproprtion", res);
        //     await ethers.provider.send('evm_revert', [snapshotId]);
        // });


        // it('scenario 2 testing inmanager when stable token is usdt', async () => {
        //     snapshotId = await ethers.provider.send('evm_snapshot');
        //     console.log("Checkkkkkkkkk");
        //     await aFiPassiveRebalanceInstance.updateMidToken(
        //         [
        //             "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
        //         ],
        //         [
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //         ]
        //     );


        //     const poolPayload = [
        //         [
        //             "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
        //         ],
        //         [
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //         ],
        //         [
        //             "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"


        //         ],
        //         [
        //             "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
        //         ],
        //         [
        //             [[
        //                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)


        //             ]],
        //             [[
        //                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)


        //             ]],
        //             [[
        //                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",


        //             ]]
        //         ],
        //         [
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //         ]
        //     ]
        //     const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
        //     await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)


        //     const accountBalance = await daiConInstance.balanceOf(investor1.address)
        //     console.log("transfer complete")
        //     console.log("funded account balance", accountBalance / 1e18)


        //     const ether = (amount) => {
        //         const weiString = ethers.utils.parseEther(amount.toString());
        //         return BigNumber.from(weiString);
        //     };


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     await aTokenConInstance1.connect(investor1).deposit(
        //         3000000000, usdtConInstance.address
        //     );


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     await aTokenConInstance1.connect(investor1).deposit(
        //         1000000000, usdtConInstance.address
        //     );


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

        //     checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
        //     console.log("check nav ", `${checkNav}`);
        //     let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
        //     console.log("User NAVVVVV", `${nav2}`)
        //     let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
        //     console.log("after deposit usdtBalance", usdtBalance)
        //     await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);
        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

        //     const numbers = [
        //         "1250230",
        //         "211379301119179471",
        //         "80080613841879501949",
        //         "34816381824594232923",
        //         "5355788253"
        //     ];
        //     const bigNumbers = numbers.map(num => BigNumber.from(num));

        //     const stringRepresentations = bigNumbers.map(bn => bn.toString());
        //     const swapParams = {
        //         afiContract: aTokenConInstance1.address,
        //         oToken: usdcConInstance.address,
        //         cSwapFee: 0,
        //         cSwapCounter: 0,
        //         depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
        //         minimumReturnAmount: [0, 0, 0],
        //         iMinimumReturnAmount: [0, 0], // Adjust according to your contract's expectations
        //         underlyingTokens: ["0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xdAC17F958D2ee523a2206206994597C13D831ec7"],
        //         newProviders: [2, 1, 3], // Fill this with the new providers' information
        //         _deadline: deadline,
        //         cometToClaim: ["0xc3d688B66703497DAA19211EEdff47f25384cdc3"],
        //         cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
        //         rewardTokenMinReturnAmounts: [0]
        //     };

        //     await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
        //     await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);


        //     const Afterbal1 = await aTokenConInstance1.balanceOf(investor1.address);
        //     console.log("Afterbal++++++3", `${Afterbal1}`)


        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
        //     console.log("check nav ", `${checkNav}`);


        //     const minimumReturnAmount =
        //         [
        //             0,
        //             0,
        //             0,
        //             0,
        //             0
        //         ]


        //     const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
        //     const returnString = Amount.map(bn => bn.toString());


        //     console.log("check", Amount);


        //     usdtBalance = await usdtConInstance.balanceOf(investor1.address)
        //     console.log("before withdraw usdtBalance", usdtBalance);


        //     const uniPayload = [[
        //         "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
        //     ],
        //     [
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //     ],
        //     [
        //         "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
        //     ],
        //     [
        //         "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
        //     ],
        //     [
        //         [[
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
        //         ]], [[
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
        //         ]], [[
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //         ]]


        //     ],
        //     [
        //         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
        //         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        //         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //     ]
        //     ]
        //     const encodedUniPayload = await aFiPassiveRebalanceInstance.encodePoolData(uniPayload);
        //     await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], encodedUniPayload)


        //     const newUToken = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
        //     const payload = [
        //         [
        //             "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
        //         ],
        //         [
        //             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //         ]
        //     ]
        //     const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)


        //     const bytesPayload = [
        //         ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], //USDT, USDC - payment tokens
        //         ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"], // USDT, USDC - chainlink oracles
        //         uDataPayload,


        //         [
        //             "0x0000000000000000000000000000000000000000"
        //         ],
        //         [
        //             "0x0000000000000000000000000000000000000000"
        //         ],
        //         [
        //             "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
        //         ],
        //         ["0"],
        //         [
        //             "0x0000000000000000000000000000000000000000"
        //         ],
        //         2,
        //     ]


        //     const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);
        //     var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);



        //     res = await aTokenConInstance1.getUTokens();
        //     console.log("uTokens  before rebalance", res);


        //     var res = await aTokenConInstance1.getProportions();
        //     console.log("uTokProp", res);


        //     res = await aTokenConInstance1.getInputToken();
        //     console.log("after getInputToken theproprtion", res);



        //     aFiPassiveRebalanceInstance.intializeStalePriceDelay([
        //         "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"
        //     ], [
        //         86500
        //     ]);


        //     await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


        //     await aFiManagerInstance.connect(rebalanceController).rebalance(
        //         bytesData,
        //         [
        //             aTokenConInstance1.address,
        //             aFiStorageInstance.address,
        //             "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        //             newUToken,
        //             "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        //             2,
        //             [],
        //             res[0],
        //             res[1],
        //             1,
        //             2
        //         ],
        //         deadline,
        //         [0, 0, 0, 0, 0],
        //         0,
        //         0,
        //         "0x",
        //         [
        //             "0x",
        //             "0x",
        //             "0x",
        //             "0x",
        //             "0x"
        //         ]
        //     );


        //     res = await aTokenConInstance1.getUTokens();
        //     console.log("uTokens ", res);
        //     res = await aTokenConInstance1.getProportions();
        //     console.log("after rebalance theproprtion", res);
        //     res = await aTokenConInstance1.getInputToken();
        //     console.log("after getInputToken theproprtion", res);
        //     await ethers.provider.send('evm_revert', [snapshotId]);
        // });


        // it('should add a token to whitelist', async () => {
        //     // Add token to whitelist
        //     await aTokenConInstance1.addToWhitelist("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9");

        //     // Verify token is added to whitelist
        //     const isWhitelisted = await aTokenConInstance1.isOTokenWhitelisted("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9");
        //     assert.equal(isWhitelisted, true, 'Token should be whitelisted');

        //     res = await aTokenConInstance1.getUTokens();
        //     console.log("uTokProp", res);
        //     res = await aTokenConInstance1.getProportions();
        //     console.log("after rebalance theproprtion", res);
        //     res = await aTokenConInstance1.getInputToken();
        //     console.log("after getInputToken theproprtion", res);
        //     // await ethers.provider.send('evm_revert', [snapshotId]);
        // });

        // it('emergency withdraw', async () => {
        //     await aFiManagerInstance.emergencyRebalance(
        //         aTokenConInstance1.address,
        //         aFiStorageInstance.address,
        //         "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        //         [10000000]
        //     );

        //     res = await aTokenConInstance1.getUTokens();
        //     console.log("uTokProp", res);
        //     res = await aTokenConInstance1.getProportions();
        //     console.log("after rebalance theproprtion", res);
        //     res = await aTokenConInstance1.getInputToken();
        //     console.log("after getInputToken theproprtion", res);
        // });
    })
})