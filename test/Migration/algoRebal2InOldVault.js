/* eslint-disable no-underscore-dangle */
const { assert, expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { time, constants } = require("@openzeppelin/test-helpers");
const { provider } = waffle;


const { abi: AFIBASE_ABI } = require('../../artifacts/contracts/AtvBase.sol/AtvBase.json');
const { abi: PARENT_AFIBASE_ABI } = require('../../artifacts/contracts/mockcontracts/contracts/ParentAFiBase.sol/ParentAFiBase.json');


const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../../utils/constants');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const exp = require('constants');
const { zeroAddress } = require('ethereumjs-util');

const getBigNumber = (number) => ethers.BigNumber.from(number);

describe('AFiBase - migration testing', () => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let aTokenConInstance;
    let aTokenConInstanceNew;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    // let aFiDelayModule;
    let oneInchParam;
    let snapshotId;



    beforeEach(async () => {


        oneInchParam = {
            firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
        }
        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, other, gnosisWallet, rebalanceController] = userAccounts;

        const currentTime = await time.latest();
        deadline = currentTime + (60 * 60);

        //Parent contract
        const ParentAFiBase = await ethers.getContractFactory('ParentAFiBase');
        const ParentAFiFacotry = await ethers.getContractFactory('ParentAFiFactory');
        const ParentAFiManager = await ethers.getContractFactory('ParentAFiManager');
        const ParentPassiveRebalanceStrategies = await ethers.getContractFactory('ParentAFiPassiveRebalanceStrategies');
        const ParentAFiStorage = await ethers.getContractFactory('ParentAFiStorage');
        const ParentAFiOracle = await ethers.getContractFactory('ParentAFiOracle');


        const AFiBase = await ethers.getContractFactory('AtvBase');
        const AFiManager = await ethers.getContractFactory('AtvManager');
        const PassiveRebalanceStrategies = await ethers.getContractFactory('AtvPassiveRebalanceStrategies');
        const AFiStorage = await ethers.getContractFactory('AtvStorage');
        const AFiFacotry = await ethers.getContractFactory('AtvFactory');
        const AFiOracle = await ethers.getContractFactory('AtvOracle');

        parentaFiBaseInstace = await ParentAFiBase.deploy("AFi802 OLD", "OLDAFi");
        parentaFiFactoryInstance = await ParentAFiFacotry.deploy(parentaFiBaseInstace.address);
        parentaFiManagerInstance = await ParentAFiManager.deploy();
        parentaFiPassiveRebalanceInstance = await ParentPassiveRebalanceStrategies.deploy();
        parentaFiAFiOracleInstance = await ParentAFiOracle.deploy(parentaFiPassiveRebalanceInstance.address);
        parentaFiStorageInstance = await ParentAFiStorage.deploy(parentaFiManagerInstance.address, parentaFiAFiOracleInstance.address, parentaFiPassiveRebalanceInstance.address, parentaFiFactoryInstance.address);
        console.log("print the address of the parent aFiFactoryInstance", parentaFiFactoryInstance.address);

        // LOCAL CONTRACTS // child contract
        aFiBaseInstace = await AFiBase.deploy("AFi802", "AFi");
        aFiManagerInstance = await AFiManager.deploy();
        aFiPassiveRebalanceInstance = await PassiveRebalanceStrategies.deploy();
        aFiAFiOracleInstance = await AFiOracle.deploy(aFiPassiveRebalanceInstance.address);
        aFiFactoryInstance = await AFiFacotry.deploy(aFiBaseInstace.address);
        aFiStorageInstance = await AFiStorage.deploy(aFiManagerInstance.address, aFiAFiOracleInstance.address, aFiPassiveRebalanceInstance.address, aFiFactoryInstance.address);
        console.log("print the address of the aFiFactoryInstance", aFiFactoryInstance.address);

        const payload = [
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
        ]

        const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)
        const parentuDataPayload = await parentaFiFactoryInstance.encodeUnderlyingData(payload)


        const payloadnew = [
            ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
            ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
            uDataPayload,
            [
                "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0xFAce851a4921ce59e912d19329929CE6da6EB0c7",
                "0x0000000000000000000000000000000000000000"
            ],
            [
                "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8",
                "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
                "0xF6D2224916DDFbbab6e6bd0D1B7034f4Ae0CaB18",
                "0x5E8C8A7243651DB1384C0dDfDbE39761E8e7E51a",
                "0x0000000000000000000000000000000000000000"
            ],
            [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x4ffc43a60e009b551865a93d232e33fce9f01507"
            ],
            ["2000000", "2000000", "2000000", "2000000", "2000000"],
            [
                "0x0000000000000000000000000000000000000000",
                "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
            ],
            3
        ]

        const parentpayloadnew = [
            ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
            ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
            parentuDataPayload,
            [
                "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0xFAce851a4921ce59e912d19329929CE6da6EB0c7",
                "0x0000000000000000000000000000000000000000"
            ],
            [
                "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8",
                "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
                "0xF6D2224916DDFbbab6e6bd0D1B7034f4Ae0CaB18",
                "0x5E8C8A7243651DB1384C0dDfDbE39761E8e7E51a",
                "0x0000000000000000000000000000000000000000"
            ],
            [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x4ffc43a60e009b551865a93d232e33fce9f01507"
            ],
            ["2000000", "2000000", "2000000", "2000000", "2000000"],
            [
                "0x0000000000000000000000000000000000000000",
                "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
            ],
            2
        ]

        const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);
        const parentbytesPayload2 = await parentaFiFactoryInstance.encodePoolData(parentpayloadnew);


        result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

        aTokenConInstance = await aFiFactoryInstance.aFiProducts(0);
        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance);

        await parentaFiFactoryInstance.createAToken("AFiBase", "ATOK", parentbytesPayload2, [investor1.address, investor2.address], true, parentaFiStorageInstance.address,
            parentaFiPassiveRebalanceInstance.address, parentaFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"]);

        parentaTokenConInstance = await parentaFiFactoryInstance.aFiProducts(0);
        parentaTokenConInstance = await ethers.getContractAt(PARENT_AFIBASE_ABI, parentaTokenConInstance);

        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdtConInstance.address, 500000000000000000000n);
      

        await parentaFiStorageInstance.setStablesWithdrawalLimit(parentaTokenConInstance.address, 500000000000000000000n);
        await parentaFiStorageInstance.setMaxSwapFee(100);

        await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], parentaTokenConInstance.address);

        aTokenConInstanceNew = await aFiFactoryInstance.aFiProducts(1);
        aTokenConInstanceNew = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstanceNew);

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



        await parentaFiAFiOracleInstance.intializeStalePriceDelay([
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
        await parentaFiAFiOracleInstance.setAFiStorage(parentaFiStorageInstance.address);

        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

        // MAINNET CONTRACT INSTANCES
        daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);
        rebalToken = await ethers.getContractAt(DAI_ABI, "0x58b6a8a3302369daec383334672404ee733ab239");



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

        console.log("print the parent product", parentaTokenConInstance.address);
        console.log("print the product", aTokenConInstance.address);

        await usdtConInstance.connect(investor1).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdtConInstance.connect(investor1).approve(
            parentaTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdtConInstance.connect(investor1).approve(
            aTokenConInstanceNew.address,
            ethers.constants.MaxUint256
        );

        await usdtConInstance.connect(investor2).approve(
            aTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdtConInstance.connect(investor2).approve(
            parentaTokenConInstance.address,
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

        await usdcConInstance.connect(investor1).approve(
            parentaTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await usdcConInstance.connect(investor2).approve(
            parentaTokenConInstance.address,
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

        await daiConInstance.connect(investor1).approve(
            parentaTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        await daiConInstance.connect(investor2).approve(
            parentaTokenConInstance.address,
            ethers.constants.MaxUint256
        );

        const daiBalance = await daiConInstance.balanceOf(accountToInpersonate)
        console.log("whale dai balance", daiBalance / 1e18)
        console.log("transfering to", accountToFund)

        var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        usdcBalance = usdcBalance / 100;

        console.log("usdcBalance", usdcBalance);
        // await usdcConInstance.connect(signer).transfer(investor1.address, "10000000000");
        // await usdcConInstance.connect(signer).transfer(investor2.address, "10000000000");

        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 100;
        console.log("usdtBalance", usdtBalance)
        await usdtConInstance.connect(signer).transfer(investor1.address, "10000000000");
        await usdtConInstance.connect(signer).transfer(investor2.address, "10000000000");

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
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);


        await parentaFiAFiOracleInstance.updateMidToken(
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
        await parentaFiPassiveRebalanceInstance.setStorage(parentaFiStorageInstance.address);

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
                ]], [[
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
        await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata);

        const parentunipooldata = await parentaFiPassiveRebalanceInstance.encodePoolData(poolPayload)
        await parentaFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], parentunipooldata);

        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address);

        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);

        await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);

        await parentaFiAFiOracleInstance.updateVaultControllers(parentaTokenConInstance.address, investor1.address, investor1.address);
        await parentaTokenConInstance.setRebalanceController(investor1.address);
        await parentaTokenConInstance.setplatformWallet(platformWallet.address);
        await parentaFiManagerInstance.setRebalanceController(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(rebalanceController.address);
        await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

        const pwallet = await aTokenConInstance.getplatformWallet();
        console.log("Platform wallet => ", pwallet);

        const parentpwallet = await parentaTokenConInstance.getplatformWallet();
        console.log("Platform wallet of the parent contract => ", parentpwallet);

        const delayModuleaddress = await aTokenConInstance.getDelayModule();
        console.log("delay module address", `${delayModuleaddress}`);

        const ownerOfBase = await aTokenConInstance.owner();
        console.log("owner of the vault", `${ownerOfBase}`);

        const parentdelayModuleaddress = await parentaTokenConInstance.getDelayModule();
        console.log("delay module address", `${parentdelayModuleaddress}`);
        const parentownerOfBase = await parentaTokenConInstance.owner();
        console.log("owner of the vault", `${parentownerOfBase}`);

        await aFiPassiveRebalanceInstance.setPriceOracle(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F"
            ],
            [
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
            ],
            [
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
            ], // USDT, USDC - chainlink oracles
            [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x4ffc43a60e009b551865a93d232e33fce9f01507"
            ],
        );
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);

        await parentaFiPassiveRebalanceInstance.setPriceOracle(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F"
            ],
            [
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
            ],
            [
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
            ],
            [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x4ffc43a60e009b551865a93d232e33fce9f01507"
            ],
        );
        await parentaFiPassiveRebalanceInstance.setStorage(parentaFiStorageInstance.address);
        await parentaFiManagerInstance.setafiOracleContract(parentaFiAFiOracleInstance.address);
        await parentaFiAFiOracleInstance.updateAFiManager(parentaFiManagerInstance.address);

        console.log("funded account balance usdttttttttt", investorusdtBalance);

    });

    context('Algo Rebalance testing', () => {

        it("Algo Rebalance 2 testing after migration", async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            let depositAmount = 0;

            var poolValue = await parentaFiStorageInstance.calculatePoolInUsd(parentaTokenConInstance.address);
            await parentaTokenConInstance.connect(investor1).updatePool(poolValue);

            console.log("Deposit call success");
            depositAmount = 1000000000;

            await parentaTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address, true
            );

            const afiTokenBal = await parentaTokenConInstance.balanceOf(investor1.address);
            console.log(`balance of afi Token after deposit, ${afiTokenBal}`);

            await parentaTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address, true
            );

            var totalsupply = await parentaTokenConInstance.totalSupply();
            console.log("totalsupply of parent vault", totalsupply);

            await parentaFiAFiOracleInstance.updateVaultControllers(parentaTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: parentaTokenConInstance.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            poolValue = await parentaFiStorageInstance.calculatePoolInUsd(parentaTokenConInstance.address);
            await parentaTokenConInstance.connect(investor1).updatePool(poolValue);
            await parentaTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await parentaFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstanceNew.address, 1980000000);
            console.log("Pause deposit and withdraw from old vault");

            await parentaTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await parentaTokenConInstance.pauseWithdraw(true);

            await aTokenConInstanceNew.migration(usdtConInstance.address);

            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply", totalsupply);

            var nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav", `${nav}`);

            var nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable before exchange cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable before exchange cs counter 1", `${nonWithdrawable}`);
            console.log("*****************************");

            expect(nonWithdrawable).to.equal(0);
            expect(nav).to.equal(0);

            await aTokenConInstanceNew.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );
            var afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and one deposit", afinewTokenBal);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after one deposit into new vault", `${nav}`);

            await parentaTokenConInstance.connect(investor1).approve(
                aTokenConInstanceNew.address,
                ethers.constants.MaxUint256
            );

            await parentaTokenConInstance.setAfiTransferability(true);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable before exchange cs counter 1", `${nonWithdrawable}`);

            console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

            await aTokenConInstanceNew.connect(investor1).exchangeToken();

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after exchange cs counter 1", `${nonWithdrawable}`);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav", `${nav}`);

            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply after exchange and one deposit", totalsupply);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange", afinewTokenBal);

            await aTokenConInstanceNew.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after one deposit cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after one deposit cs counter 1", `${nonWithdrawable}`);

            console.log("@@@@@@@@@@@@@@@@@@@@@@@@@");

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and 2 deposit", afinewTokenBal);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after 2 deposit into new vault", `${nav}`);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after second dep in new vault", `${nav}`);

            await expect(aTokenConInstanceNew.connect(investor1).exchangeToken()).to.be.reverted;

            const AfterwithusdcBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("Before withdraw user usdt balance", `${AfterwithusdcBalance}`)
            const minimumReturnAmount = [0, 0, 0, 0, 0];

            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());

            var swapParamsForNewVault = {
                afiContract: aTokenConInstanceNew.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 3, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstanceNew.address, investor1.address);


            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstanceNew.address, investor1.address, investor1.address);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParamsForNewVault, 0, oneInchParam, "0x", 0);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after cumulative swap cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 2);
            console.log("non withdrawable after cumulative swap cs counter 2", `${nonWithdrawable}`)
            expect(nonWithdrawable).to.equal(0);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and cs", afinewTokenBal);

            console.log("Rebalance testing starts----------------------------------------");

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


            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );

            var res = await aTokenConInstanceNew.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            // await aFiManagerInstance.setRebalFee(500);

            console.log("1. ..........................................");

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstanceNew.address, 1, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);

            console.log("2. ..........................................");
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            console.log("5. ..........................................");
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(false);

            await aTokenConInstanceNew.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            console.log("6. ..........................................");

            const check = await aTokenConInstanceNew.getProportions();
            console.log("check", check[0]);

            let check1 = await aTokenConInstanceNew.getUTokens();
            console.log("check", check1);
        });

        it("Algo Rebalance 2 and cs testing after migration", async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            let depositAmount = 0;


            var poolValue = await parentaFiStorageInstance.calculatePoolInUsd(parentaTokenConInstance.address);
            await parentaTokenConInstance.connect(investor1).updatePool(poolValue);

            console.log("Deposit call success");
            depositAmount = 1000000000;

            await parentaTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address, true
            );

            const afiTokenBal = await parentaTokenConInstance.balanceOf(investor1.address);
            console.log(`balance of afi Token after deposit, ${afiTokenBal}`);

            await parentaTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address, true
            );

            var totalsupply = await parentaTokenConInstance.totalSupply();
            console.log("totalsupply of parent vault", totalsupply);

            await parentaFiAFiOracleInstance.updateVaultControllers(parentaTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: parentaTokenConInstance.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            poolValue = await parentaFiStorageInstance.calculatePoolInUsd(parentaTokenConInstance.address);
            await parentaTokenConInstance.connect(investor1).updatePool(poolValue);
            await parentaTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await parentaFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstanceNew.address, 1980000000);
            console.log("Pause deposit and withdraw from old vault");

            await parentaTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await parentaTokenConInstance.pauseWithdraw(true);

            await aTokenConInstanceNew.migration(usdtConInstance.address);

            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply", totalsupply);

            var nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav", `${nav}`);

            var nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable before exchange cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable before exchange cs counter 1", `${nonWithdrawable}`);
            console.log("*****************************");

            expect(nonWithdrawable).to.equal(0);
            expect(nav).to.equal(0);

            await aTokenConInstanceNew.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );
            var afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and one deposit", afinewTokenBal);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after one deposit into new vault", `${nav}`);

            await parentaTokenConInstance.connect(investor1).approve(
                aTokenConInstanceNew.address,
                ethers.constants.MaxUint256
            );

            await parentaTokenConInstance.setAfiTransferability(true);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable before exchange cs counter 1", `${nonWithdrawable}`);

            console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

            await aTokenConInstanceNew.connect(investor1).exchangeToken();

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after exchange cs counter 1", `${nonWithdrawable}`);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav", `${nav}`);

            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply after exchange and one deposit", totalsupply);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange", afinewTokenBal);

            await aTokenConInstanceNew.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after one deposit cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after one deposit cs counter 1", `${nonWithdrawable}`);

            console.log("@@@@@@@@@@@@@@@@@@@@@@@@@");

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and 2 deposit", afinewTokenBal);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after 2 deposit into new vault", `${nav}`);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after second dep in new vault", `${nav}`);

            await expect(aTokenConInstanceNew.connect(investor1).exchangeToken()).to.be.reverted;

            const AfterwithusdcBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("Before withdraw user usdt balance", `${AfterwithusdcBalance}`)
            const minimumReturnAmount = [0, 0, 0, 0, 0];

            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());

            var swapParamsForNewVault = {
                afiContract: aTokenConInstanceNew.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 3, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstanceNew.address, investor1.address);


            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstanceNew.address, investor1.address, investor1.address);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParamsForNewVault, 0, oneInchParam, "0x", 0);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after cumulative swap cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 2);
            console.log("non withdrawable after cumulative swap cs counter 2", `${nonWithdrawable}`)
            expect(nonWithdrawable).to.equal(0);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and cs", afinewTokenBal);

            console.log("Rebalance testing starts----------------------------------------");

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


            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );

            var res = await aTokenConInstanceNew.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            // await aFiManagerInstance.setRebalFee(500);

            console.log("1. ..........................................");

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstanceNew.address, 1, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);

            console.log("2. ..........................................");
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            console.log("5. ..........................................");
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(false);

            await aTokenConInstanceNew.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            console.log("6. ..........................................");

            const check = await aTokenConInstanceNew.getProportions();
            console.log("check", check[0]);

            let check1 = await aTokenConInstanceNew.getUTokens();
            console.log("check", check1);

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstanceNew.address, aFiStorageInstance.address);
            console.log("After emeregency rebalance nav from storage value", `${NavfromStorage}`);

            var uTokenProp2 = await aTokenConInstanceNew.getProportions();
            console.log("uTokenProp", `${uTokenProp2[0]}`);

            var utokensafter = await aTokenConInstanceNew.getUTokens();
            console.log(utokensafter);

            const linkTokenInstance = await ethers.getContractAt(DAI_ABI, "0x514910771AF9Ca656af840dff83E8264EcF986CA");

            var staleBal = await linkTokenInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("removed token bal = ", `${staleBal}`);

            var staleBal = await usdtConInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("stable token bal = ", `${staleBal}`);

            console.log("cumlativeswap after emergency rebalance");

            var swapParams2 = {
                afiContract: aTokenConInstanceNew.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 1,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstanceNew.address);

            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams2, 0, oneInchParam, "0x", 0);

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstanceNew.address, aFiStorageInstance.address);
            console.log("After cs2 after emeregency rebalance nav from storage value", `${NavfromStorage}`);

            var uTokenProp2 = await aTokenConInstanceNew.getProportions();
            console.log("uTokenProp", `${uTokenProp2[0]}`);

            var utokensafter = await aTokenConInstanceNew.getUTokens();
            console.log("underlying tokens", utokensafter);

            var staleBal = await linkTokenInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("removed token bal = ", `${staleBal}`);

            var staleBal = await usdtConInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("stable token bal = ", `${staleBal}`);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it("Algo Rebalance 2 and reinitialize testing after migration", async () => {
            let depositAmount = 0;

            var poolValue = await parentaFiStorageInstance.calculatePoolInUsd(parentaTokenConInstance.address);
            await parentaTokenConInstance.connect(investor1).updatePool(poolValue);

            console.log("Deposit call success");
            depositAmount = 1000000000;

            await parentaTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address, true
            );

            const afiTokenBal = await parentaTokenConInstance.balanceOf(investor1.address);
            console.log(`balance of afi Token after deposit, ${afiTokenBal}`);

            await parentaTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address, true
            );

            var totalsupply = await parentaTokenConInstance.totalSupply();
            console.log("totalsupply of parent vault", totalsupply);

            await parentaFiAFiOracleInstance.updateVaultControllers(parentaTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: parentaTokenConInstance.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            poolValue = await parentaFiStorageInstance.calculatePoolInUsd(parentaTokenConInstance.address);
            await parentaTokenConInstance.connect(investor1).updatePool(poolValue);
            await parentaTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await parentaFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstanceNew.address, 1980000000);
            console.log("Pause deposit and withdraw from old vault");

            await parentaTokenConInstance.setAfiTransferability(true);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable before exchange cs counter 1", `${nonWithdrawable}`); 

            await aTokenConInstanceNew.migration(usdtConInstance.address);

            console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

            
            await parentaTokenConInstance.connect(investor1).approve(
                aTokenConInstanceNew.address,
                ethers.constants.MaxUint256
            );

            await aTokenConInstanceNew.connect(investor1).exchangeToken();

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after exchange cs counter 1", `${nonWithdrawable}`);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav", `${nav}`);

            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply after exchange and one deposit", totalsupply);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange", afinewTokenBal);

            await aTokenConInstanceNew.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after one deposit cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after one deposit cs counter 1", `${nonWithdrawable}`);

            console.log("@@@@@@@@@@@@@@@@@@@@@@@@@");

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and 2 deposit", afinewTokenBal);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after 2 deposit into new vault", `${nav}`);

            nav = await aTokenConInstanceNew.depositUserNav(investor1.address);
            console.log("user nav after second dep in new vault", `${nav}`);

            await expect(aTokenConInstanceNew.connect(investor1).exchangeToken()).to.be.reverted;

            const AfterwithusdcBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("Before withdraw user usdt balance", `${AfterwithusdcBalance}`)
            const minimumReturnAmount = [0, 0, 0, 0, 0];

            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());

            var swapParamsForNewVault = {
                afiContract: aTokenConInstanceNew.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 3, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstanceNew.address, investor1.address);


            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstanceNew.address, investor1.address, investor1.address);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParamsForNewVault, 0, oneInchParam, "0x", 0);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after cumulative swap cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 2);
            console.log("non withdrawable after cumulative swap cs counter 2", `${nonWithdrawable}`)
            expect(nonWithdrawable).to.equal(0);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and cs", afinewTokenBal);

            console.log("Rebalance testing starts----------------------------------------");

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


            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );

            var res = await aTokenConInstanceNew.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            // await aFiManagerInstance.setRebalFee(500);

            console.log("1. ..........................................");

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstanceNew.address, 1, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);

            console.log("2. ..........................................");
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            console.log("5. ..........................................");
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(false);

            await aTokenConInstanceNew.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            console.log("6. ..........................................");

            var check = await aTokenConInstanceNew.getProportions();
            console.log("check", check[0]);

            let check1 = await aTokenConInstanceNew.getUTokens();
            console.log("check", check1);

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstanceNew.address, aFiStorageInstance.address);
            console.log("After emeregency rebalance nav from storage value", `${NavfromStorage}`);

            var uTokenProp2 = await aTokenConInstanceNew.getProportions();
            console.log("uTokenProp", `${uTokenProp2[0]}`);

            var utokensafter = await aTokenConInstanceNew.getUTokens();
            console.log(utokensafter);

            const linkTokenInstance = await ethers.getContractAt(DAI_ABI, "0x514910771AF9Ca656af840dff83E8264EcF986CA");

            var staleBal = await linkTokenInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("removed token bal = ", `${staleBal}`);

            var staleBal = await usdtConInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("stable token bal = ", `${staleBal}`);

            console.log("cumlativeswap after emergency rebalance");

            var swapParams2 = {
                afiContract: aTokenConInstanceNew.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 1,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"
                ],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstanceNew.address);

            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams2, 0, oneInchParam, "0x", 0);

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstanceNew.address, aFiStorageInstance.address);
            console.log("After cs2 after emeregency rebalance nav from storage value", `${NavfromStorage}`);

            var uTokenProp2 = await aTokenConInstanceNew.getProportions();
            console.log("uTokenProp", `${uTokenProp2[0]}`);

            var utokensafter = await aTokenConInstanceNew.getUTokens();
            console.log("underlying tokens", utokensafter);

            var staleBal = await linkTokenInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("removed token bal = ", `${staleBal}`);

            var staleBal = await usdtConInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("stable token bal = ", `${staleBal}`);

            const rebalTokenBalance = await rebalToken.balanceOf(aTokenConInstanceNew.address);
            console.log("ballllllllllllllllllllllllllllllllllllllllll", rebalTokenBalance);

            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);

            console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");

            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",
                [2500000, 2500000, 5000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );
            check = await aTokenConInstanceNew.getProportions();
            console.log("proportion222222", check);

            check1 = await aTokenConInstanceNew.getUTokens();
            console.log("after rebal 2", check1);

            console.log("rebala2 third time");

            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                [5000000, 5000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            console.log("rebala2 forth time");
            check = await aTokenConInstanceNew.getProportions();
            console.log("proportion 3333", check);

            check1 = await aTokenConInstanceNew.getUTokens();
            console.log("after rebal 2", check1);
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);
            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                [10000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );
            check = await aTokenConInstanceNew.getProportions();
            console.log("proportion 44444", check);

            check1 = await aTokenConInstanceNew.getUTokens();
            console.log("after rebal 2", check1);
            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);

            await aFiManagerInstance.connect(rebalanceController).algoRebalance2(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                [],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            check = await aTokenConInstanceNew.getProportions();
            console.log("proportion after rebals", check);

            check1 = await aTokenConInstanceNew.getUTokens();
            console.log("after rebal 2", check1);

            let getcounter = await aTokenConInstanceNew.getcSwapCounter();

            let predepositBalance = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstanceNew.address, getcounter, usdtConInstance.address);
            console.log("check predeposit balance", predepositBalance);

            var navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstanceNew.address, aFiStorageInstance.address);
            console.log("Nav from storage after the rebalance 2", `${navfromStorage}`);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstanceNew.address);
            console.log("TVL after the algo rebalance 2", `${poolValue}`);


            const poolPayload1 = [
                [
                    "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
                    "0xaf5191b0de278c7286d6c7cc6ab6bb8a73ba2cd6",
                    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
                    "0x7420b4b9a0110cdc71fb720908340c03f9bc03ec",
                    "0x6123b0049f904d730db3c36a31167d9d4121fa6b"
                ],
                [
                    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
                ],
                [
                    "0x0e2c4be9f3408e5b1ff631576d946eb8c224b5ed",
                    "0x8592064903ef23d34e4d5aaaed40abf6d96af186",
                    "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801",
                    "0x4d1eff861316396dd1915f69b49f4c2d7b11590d",
                    "0xfe0df74636bc25c7f2400f22fe7dae32d39443d2"
                ],
                [
                    "0x0e2c4be9f3408e5b1ff631576d946eb8c224b5ed",
                    "0x6ce6d6d40a4c4088309293b0582372a2e6bb632e",
                    "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801",
                    "0x4d1eff861316396dd1915f69b49f4c2d7b11590d",
                    "0x94981f69f7483af3ae218cbfe65233cc3c60d93a"
                ],
                [
                    [
                        [
                            "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                            "0x3416cf6c708da44db2624d63ea0aaef7113527c6",
                            "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                            "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                            "0x3416cf6c708da44db2624d63ea0aaef7113527c6"
                        ]
                    ],
                    [
                        [
                            "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                            "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                            "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
                        ]
                    ],
                    [
                        [
                            "0x60594a405d53811d3bc4766596efd80fd545a270",
                            "0x5777d92f208679db4b9778590fa3cab3ac9e2168",
                            "0x60594a405d53811d3bc4766596efd80fd545a270",
                            "0x60594a405d53811d3bc4766596efd80fd545a270",
                            "0x5777d92f208679db4b9778590fa3cab3ac9e2168"
                        ]
                    ]
                ],
                [
                    "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                    "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                    "0x60594a405d53811d3bc4766596efd80fd545a270"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            const oraclePayload1 = [
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
            ];

            await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
                "0x5a98fcbea516cf06857215779fd812ca3bef1b32",
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72",
                "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2",
                "0x58b6a8a3302369daec383334672404ee733ab239"
            ], [
                84600,
                84600,
                84600,
                84600,
                84600
            ]);

            console.log("stale prices are updated");

            await aTokenConInstanceNew.connect(investor1).pauseUnpauseDeposit(true);

            console.log("@@@@@@@@@@@@@@@@@@@@@");

            swapParamsForNewVault = {
                afiContract: aTokenConInstanceNew.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
                    "0xaf5191b0de278c7286d6c7cc6ab6bb8a73ba2cd6",
                    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
                    "0x7420b4b9a0110cdc71fb720908340c03f9bc03ec",
                    "0x6123b0049f904d730db3c36a31167d9d4121fa6b"
                ],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 3, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
            await aFiManagerInstance.connect(rebalanceController).reInitializeVault(
                aTokenConInstanceNew.address,
                aFiStorageInstance.address,
                unipooldata1,
                [
                    "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
                    "0xaf5191b0de278c7286d6c7cc6ab6bb8a73ba2cd6",
                    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
                    "0x7420b4b9a0110cdc71fb720908340c03f9bc03ec",
                    "0x6123b0049f904d730db3c36a31167d9d4121fa6b"
                ],
                oraclePayload1,
                [2000000, 2000000, 2000000, 2000000, 2000000],
                [2000000, 2000000, 2000000, 2000000, 2000000],
                0,
                usdtConInstance.address,
                swapParamsForNewVault,
                oneInchParam,
                0
            );

            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

            getcounter = await aTokenConInstanceNew.getcSwapCounter();
            predepositBalance = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstanceNew.address, getcounter - 1, usdtConInstance.address);
            console.log("check predeposit balance after reInitializeVault", predepositBalance);

            let usdtBalance = await usdtConInstance.balanceOf(aTokenConInstanceNew.address);
            console.log("print usdt balance", usdtBalance);

            check = await aTokenConInstanceNew.getProportions();
            console.log("after rebal 2 -----------------------------------", check[0]);

            check1 = await aTokenConInstanceNew.getUTokens();
            console.log("after rebal 2 -----------------------------------", check1);
        });
    });
});