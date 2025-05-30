/* eslint-disable no-underscore-dangle */
const { assert, expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { time, constants } = require("@openzeppelin/test-helpers");
const { provider } = waffle;
const axios = require("axios");

const swapTokens = require('./getOneInchData.js');
const swapTokens2 = require('./getOneInchData2.js');




const { abi: AFIBASE_ABI } = require('../../artifacts/contracts/AtvBase.sol/AtvBase.json');

const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../../utils/constants');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

const getBigNumber = (number) => ethers.BigNumber.from(number);

describe('AFiOracle For OneInch flow', (accounts) => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let deployedAFiBase;
    let aTokenConInstance;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;

    before(async () => {
        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2] = userAccounts;

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

        aFiStorageInstance = await AFiStorage.deploy(
            aFiManagerInstance.address,
            aFiAFiOracleInstance.address,
            aFiPassiveRebalanceInstance.address,
            aFiFactoryInstance.address
        );
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
                "0x0000000000000000000000000000000000000000",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x0000000000000000000000000000000000000000",
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

        deployedAFiBase = await aFiFactoryInstance.aFiProducts(0);

        console.log("print the address of the aFiFactoryInstance", aFiFactoryInstance.address);

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
                "0x553303d460EE0afB37EdFf9bE42922D8FF63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
            ],
        );

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);

        await expect(aFiPassiveRebalanceInstance.connect(investor2).intializeStalePriceDelay([
            "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
            "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
            "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL

        ], [
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500
        ])).to.be.reverted;

        await expect(aFiPassiveRebalanceInstance.intializeStalePriceDelay([
            "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
            "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
            "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL

        ], [
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500
        ])).to.be.reverted;

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


        await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);
        await expect(aFiAFiOracleInstance.connect(investor1).setAFiStorage(aFiStorageInstance.address)).to.be.reverted;

        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        await aFiAFiOracleInstance.updateRebalContract(aFiPassiveRebalanceInstance.address);

        await expect(aFiAFiOracleInstance.connect(investor2).updateRebalContract(aFiPassiveRebalanceInstance.address)).to.be.reverted;


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
        const signer = await ethers.getSigner(accountToInpersonate)

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
        console.log("usdcBalance", usdcBalance);

        await usdcConInstance.connect(signer).transfer(investor1.address, "10000000000");
        await usdcConInstance.connect(signer).transfer(investor2.address, "10000000000");

        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 3;
        console.log("usdtBalance", usdtBalance)
        await usdtConInstance.connect(signer).transfer(investor1.address, "10000000000");
        await usdtConInstance.connect(signer).transfer(investor2.address, "10000000000");

        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);
        await aTokenConInstance.setMinDepLimit(100);

        console.log("funded account balance usdt", investorusdtBalance)
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);

        await aFiPassiveRebalanceInstance.updatePreSwapDepositLimit(100000000000000000000n);

    });

    context('queue flow testing', () => {

        it('transfer profit share to the team after redeem and swaps via OneInch', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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
                    ]],
                    [[
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
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };


            // getPriceInUSD

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );


            // getPriceInUSD

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );


            // getPriceInUSD

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            // getPriceInUSD

            const numbers = [
                "1250230",
                "211379301119179471",
                "80080613841879501949",
                "34816381824594232923",
                "5355788253"
            ];

            const bigNumbers = numbers.map(num => BigNumber.from(num));
            const stringRepresentations = bigNumbers.map(bn => bn.toString());

            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                ],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [3, 2, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            const oneInchParam = {
                firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
            }

            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0)).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await aTokenConInstance.balanceOf(investor1.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)


            // getPriceInUSD

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);


            // getPriceInUSD

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );


            // getPrice*InUSD

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
                cSwapCounter: 1,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                ],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [3, 2, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            var balInjection = await usdtConInstance.balanceOf(investor1.address);
            console.log("balInjection", balInjection);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, balInjection);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);


            // getPriceInUSD

            await aTokenConInstance.connect(investor2).deposit(
                1000000000, usdcConInstance.address
            );


            // getPriceInUSD

            //To check the profit distribution
            await aTokenConInstance.connect(investor1).withdraw(
                ether(2), usdtConInstance.address, deadline, returnString, 3, 0
            );

            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(2), usdtConInstance.address
            );

            var userQueuedShare = await aFiAFiOracleInstance.getUserQueuedShares(investor1.address, aTokenConInstance.address, usdtConInstance.address, 0);
            console.log("user's shares in queue", userQueuedShare);
            expect(Number(userQueuedShare)).to.greaterThan(0);

            await aFiAFiOracleInstance.connect(investor1).unqueueWithdraw(
                aTokenConInstance.address, usdtConInstance.address
            );

            userQueuedShare = await aFiAFiOracleInstance.getUserQueuedShares(investor1.address, aTokenConInstance.address, usdtConInstance.address, 0);
            console.log("user's shares to unqueue", userQueuedShare);
            expect(Number(userQueuedShare)).to.equal(0);

            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(2), usdtConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav - after queue", `${checkNav}`);

            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(2), usdcConInstance.address
            );

            // getPriceInUSD

            balInjection = await usdtConInstance.balanceOf(investor1.address);
            console.log("balInjection", balInjection);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, balInjection);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
            // getPriceInUSD

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav - before unstake", `${checkNav}`);

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, true);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
            // getPriceInUSD

            var _unstakeData = {
                iTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                oToken: usdtConInstance.address,
                deadline: deadline,
                minimumReturnAmount: [0, 0, 0, 0, 0],
                minOutForiToken: [0, 0, 0],
                unstakingFees: 0
            }

            let swapData;
            let swapData1;

            await aFiPassiveRebalanceInstance.setDexForTokenPair("0x514910771af9ca656af840dff83e8264ecf986ca", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 1);

            console.log(" unstake call starts here");

            let swap, swap1, swap2;
            try {

                let tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
                let tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // Provide your tokenOut address
                let amountIn = '433805988';  // Amount to swap
                let from = aTokenConInstance.address;     // Provide the from address
                let origin = aTokenConInstance.address;

                swap = await swapTokens2(
                    tokenIn,
                    tokenOut,
                    amountIn,
                    from,
                    origin
                );

                tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';  // Provide your tokenIn address
                tokenOut = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Provide your tokenOut address
                amountIn = '110028684928515441';  // Amount to swap
                from = aTokenConInstance.address;     // Provide the from address
                origin = aTokenConInstance.address;

                swap1 = await swapTokens2(
                    tokenIn,
                    tokenOut,
                    amountIn,
                    from,
                    origin
                );

            } catch (error) {
                console.error("Error during swaps:", error);
            }

            await aFiAFiOracleInstance.connect(investor1).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData,
                [
                    swap1,
                    "0x",
                    "0x"
                ],
                [
                    swap,
                    "0x",
                    "0x"
                ],
                0
            );
            await aFiPassiveRebalanceInstance.setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 1);


            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
            // getPriceInUSD

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav - after unstake", `${checkNav}`);
        });
    });
});