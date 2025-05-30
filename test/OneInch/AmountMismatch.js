/* eslint-disable no-underscore-dangle */
const { assert, expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { time, constants } = require("@openzeppelin/test-helpers");
const { provider } = waffle;
const axios = require("axios");
const swapTokens = require('./getOneInchData.js');
const swapTokens2 = require('./getOneInchData2.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const { abi: AFIBASE_ABI } = require('../../artifacts/contracts/AtvBase.sol/AtvBase.json');

const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../../utils/constants');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const exp = require('constants');
const { zeroAddress } = require('ethereumjs-util');

const getBigNumber = (number) => ethers.BigNumber.from(number);

describe('AFiBase', () => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let aTokenConInstance;
    let aTokenConInstance1;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    // let aFiDelayModule;
    let snapshotId;


    beforeEach(async () => {
        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, other, gnosisWallet] = userAccounts;

        const currentTime = await time.latest();
        deadline = currentTime + (60 * 60);

        const AFiBase = await ethers.getContractFactory('AtvBase');
        const AFiManager = await ethers.getContractFactory('AtvManager');
        const PassiveRebalanceStrategies = await ethers.getContractFactory('AtvPassiveRebalanceStrategies');

        const AFiStorage = await ethers.getContractFactory('AtvStorage');
        const AFiFacotry = await ethers.getContractFactory('AtvFactory');
        const AFiOracle = await ethers.getContractFactory('AtvOracle');

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
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            ]
        ]

        const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)

        const payloadnew = [
            ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
            ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
            uDataPayload,
            [
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0xFAce851a4921ce59e912d19329929CE6da6EB0c7",
            ],
            [
                "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
                "0xF6D2224916DDFbbab6e6bd0D1B7034f4Ae0CaB18",
                "0x5E8C8A7243651DB1384C0dDfDbE39761E8e7E51a",
            ],
            [
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
            ],
            ["5000000", "2500000", "2500000"],
            [
                "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
            ],
            2
        ]

        const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

        result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

        aTokenConInstance = await aFiFactoryInstance.aFiProducts(0);

        //let txObject = await result.wait()

        //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance);
        //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));

        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address,usdtConInstance.address, 500000000000000000000n);
        await aFiStorageInstance.setMaxSwapFee(100);

        await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
            "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
            "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
            "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
            "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
            "0xD533a949740bb3306d119CC777fa900bA034cd52"

        ], [
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500
        ]);


        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);


        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

        // MAINNET CONTRACT INSTANCES
        daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);


        const accountToInpersonate = "0x54edC2D90BBfE50526E333c7FfEaD3B0F22D39F0"
        const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [accountToInpersonate],
        });
        const signer = await ethers.getSigner(accountToInpersonate);



        const ether = (amount) => {
            const weiString = ethers.utils.parseEther(amount.toString());
            return BigNumber.from(weiString);
        };

        /**
        * GIVE APPROVAL TO AFi of DEPOSIT TOKEN
        * THIS IS REQUIRED WHEN 1% fee IS TRANSFEREED FROM INVESTOR TO PLATFORM WALLET
        */

        console.log("print the productttttttttttt", usdtConInstance.address);

        console.log("print the productttttttttttt", aTokenConInstance.address);

        await usdtConInstance.connect(investor1).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdtConInstance.connect(investor2).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdcConInstance.connect(investor1).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdcConInstance.connect(investor2).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await daiConInstance.connect(investor1).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await daiConInstance.connect(investor2).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        const daiBalance = await daiConInstance.balanceOf(accountToInpersonate)
        console.log("whale dai balance", daiBalance / 1e18)
        console.log("transfering to", accountToFund)

        var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        // usdcBalance = usdcBalance / 2;

        console.log("usdcBalance", usdcBalance);
        await usdcConInstance.connect(signer).transfer(investor1.address, usdcBalance);
        // await usdcConInstance.connect(signer).transfer(investor2.address, usdcBalance);

        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 100;
        console.log("usdtBalance", usdtBalance)
        await usdtConInstance.connect(signer).transfer(investor1.address, "10000000000");
        await usdtConInstance.connect(signer).transfer(investor2.address, "10000000000");

        await aFiPassiveRebalanceInstance.updateMidToken(
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            ]
        );

        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        const poolPayload = [
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                ]],
                [[
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
        await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata);

        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);
        await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);
        await aTokenConInstance.setMinDepLimit(100);

        const pwallet = await aTokenConInstance.getplatformWallet();
        console.log("Platform wallet => ", pwallet);

        // const data = await aFiDelayModule.encodeupdateTVLTransaction(3000);
        // console.log("data generated", `${data}`);

        const delayModuleaddress = await aTokenConInstance.getDelayModule();
        console.log("delay module address", `${delayModuleaddress}`);

        const ownerOfBase = await aTokenConInstance.owner();
        console.log("owner of the vault", `${ownerOfBase}`);


        await aFiPassiveRebalanceInstance.setPriceOracle(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F"
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            ],
            [
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
            ], // USDT, USDC - chainlink oracles
            [
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
            ],
        );

        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        console.log("transfer complete")
        console.log("funded account balance usdttttttttt", investorusdtBalance);
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);

        await aFiPassiveRebalanceInstance.updatePreSwapDepositLimit(10000000000000000000n);

    });

    context('OneInch testing', () => {
        it("when srcAmount > desc.srcAmount", async () => {
           
            snapshotId = await ethers.provider.send('evm_snapshot');

            const beforeUSDTDep = await usdtConInstance.balanceOf(investor1.address)
            console.log("before Deposit user usdt balance", `${beforeUSDTDep}`);
            console.log("check --1")

            await aTokenConInstance.connect(investor1).deposit(
                100000000, usdtConInstance.address
            );

            let AfterusdtBalance1 = await usdtConInstance.balanceOf(investor1.address);
            console.log("After Deposit user usdt balance", `${AfterusdtBalance1}`);

            const nav1 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("user nav1", `${nav1}`);

            const NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage", `${NavfromStorage}`);

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                ],  // Fill this array if your function expects specific tokens
                newProviders: [3, 2, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };


            let swap, swap1, swap2;
            try {

                const tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
                const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // Provide your tokenOut address
                const amountIn = '5000000';  // Amount to swap
                const from = aTokenConInstance.address;     // Provide the from address
                const origin = aTokenConInstance.address;

                swap = await swapTokens2(
                    tokenIn,
                    tokenOut,
                    amountIn,
                    from,
                    origin
                );

                const tokenIn1 = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
                const tokenOut1 = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // Provide your tokenOut address
                const amountIn1 = '24500000';  // Amount to swap
                const from1 = aTokenConInstance.address;     // Provide the from address
                const origin1 = aTokenConInstance.address;

                await sleep(1000);

                swap1 = await swapTokens2(
                    tokenIn1,
                    tokenOut1,
                    amountIn1,
                    from1,
                    origin1
                );

                await sleep(1000);

                swap2 = await swapTokens2(
                    "0xdac17f958d2ee523a2206206994597c13d831ec7",
                    "0x514910771af9ca656af840dff83e8264ecf986ca",
                    "24500000",
                    aTokenConInstance.address,
                    aTokenConInstance.address
                );

            } catch (error) {
                console.error("Error during swaps:", error);
            }

            const oneInchParam = {
                firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationCumulativeSwap: [
                    swap,
                    swap1,
                    swap2
                ]
            }

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            console.log("(((((((((((((((((((((())))))))))))))))))))))");

            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 1);
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", 1);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const NavfromStorageAfter = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after cswap", `${NavfromStorageAfter}`);

            const AfterusdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("After Deposit user usdt balance", `${AfterusdtBalance}`)
            const AfterusdcBalance = await usdcConInstance.balanceOf(aTokenConInstance.address)
            console.log("After deposit user usdc balance", `${AfterusdcBalance}`)

            const afibalance = await usdtConInstance.balanceOf(aTokenConInstance.address)
            console.log("aficontract usdt balance", `${afibalance}`)

            const Afterbal = await aTokenConInstance.balanceOf(
                investor1.address
            );
            console.log("Afterbal", `${Afterbal}`)

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);

            const AfterwithusdcBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("Before withdraw user usdt balance", `${AfterwithusdcBalance}`)
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it("when srcAmount < desc.srcAmount", async () => {
            const beforeUSDTDep = await usdtConInstance.balanceOf(investor1.address)
            console.log("before Deposit user usdt balance", `${beforeUSDTDep}`);
            console.log("check --1")

            await aTokenConInstance.connect(investor1).deposit(
                100000000, usdtConInstance.address
            );

            let AfterusdtBalance1 = await usdtConInstance.balanceOf(investor1.address);
            console.log("After Deposit user usdt balance", `${AfterusdtBalance1}`);

            const nav1 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("user nav1", `${nav1}`);

            const NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage", `${NavfromStorage}`);

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                ],  // Fill this array if your function expects specific tokens
                newProviders: [3, 2, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };


            let swap, swap1, swap2;
            try {

                const tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
                const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // Provide your tokenOut address
                const amountIn = '4800000';  // Amount to swap
                const from = aTokenConInstance.address;     // Provide the from address
                const origin = aTokenConInstance.address;

                swap = await swapTokens2(
                    tokenIn,
                    tokenOut,
                    amountIn,
                    from,
                    origin
                );

                const tokenIn1 = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
                const tokenOut1 = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // Provide your tokenOut address
                const amountIn1 = '24500000';  // Amount to swap
                const from1 = aTokenConInstance.address;     // Provide the from address
                const origin1 = aTokenConInstance.address;

                await sleep(1000);

                swap1 = await swapTokens2(
                    tokenIn1,
                    tokenOut1,
                    amountIn1,
                    from1,
                    origin1
                );

                await sleep(1000);

                swap2 = await swapTokens2(
                    "0xdac17f958d2ee523a2206206994597c13d831ec7",
                    "0x514910771af9ca656af840dff83e8264ecf986ca",
                    "24500000",
                    aTokenConInstance.address,
                    aTokenConInstance.address
                );

            } catch (error) {
                console.error("Error during swaps:", error);
            }

            const oneInchParam = {
                firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationCumulativeSwap: [
                    swap,
                    swap1,
                    swap2
                ]
            }

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            console.log("(((((((((((((((((((((())))))))))))))))))))))");

            // await aTokenConInstance.connect(investor1).approveForOneInch(["0xdAC17F958D2ee523a2206206994597C13D831ec7"],["73000000"]);
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 1);
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", 1);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const NavfromStorageAfter = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after cswap", `${NavfromStorageAfter}`);

            const AfterusdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("After Deposit user usdt balance", `${AfterusdtBalance}`)
            const AfterusdcBalance = await usdcConInstance.balanceOf(aTokenConInstance.address)
            console.log("After deposit user usdc balance", `${AfterusdcBalance}`)


            const afibalance = await usdtConInstance.balanceOf(aTokenConInstance.address)
            console.log("aficontract usdt balance", `${afibalance}`)

            const Afterbal = await aTokenConInstance.balanceOf(
                investor1.address
            );

            console.log("Afterbal", `${Afterbal}`)

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);


            const minimumReturnAmount = [0, 0, 0, 0, 0];

            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());

            const AfterwithusdcBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("Before withdraw user usdt balance", `${AfterwithusdcBalance}`)
        });
    });
});