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
const exp = require('constants');
const { zeroAddress } = require('ethereumjs-util');

const getBigNumber = (number) => ethers.BigNumber.from(number);

describe('AFiBase - exchange test', () => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let aTokenConInstance;
    let aTokenConInstance1;
    let oneInchParam;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    // let aFiDelayModule;

    before(async () => {

        oneInchParam = {
            firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
        }
        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, other, gnosisWallet] = userAccounts;

        const currentTime = await time.latest();
        deadline = currentTime + (60 * 60);

        const AFiBase = await ethers.getContractFactory('AtvBase');
        // const delayModule = await ethers.getContractFactory('TimeDelayModule');
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
        // aFiDelayModule = await delayModule.deploy(86400, 172800);

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
            2
        ]

        const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

        result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

        aTokenConInstance = await aFiFactoryInstance.aFiProducts(0);

        const AFiTestToken = await ethers.getContractFactory('TestToken');
        aFiTestTokenInstace = await AFiTestToken.deploy();
        const AFiExchange = await ethers.getContractFactory('contracts/mockcontracts/AFiExchangeMock.sol:AFiExchangeMock');
        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance);

        aFiExchangeInstace = await AFiExchange.deploy(aTokenConInstance.address, aFiTestTokenInstace.address);

        //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));

        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdtConInstance.address, 500000000000000000000n);


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


        // await daiConInstance.connect(signer).transfer(investor1.address, daiBalance);

        // const accountBalance = await daiConInstance.balanceOf(investor1.address)
        // console.log("transfer complete")
        // console.log("funded account balance", accountBalance / 1e18)

        var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        usdcBalance = usdcBalance / 100;

        // console.log("usdcBalance",usdcBalance);
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

        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);

        const pwallet = await aTokenConInstance.getplatformWallet();
        console.log("Platform wallet => ", pwallet);

        const delayModuleaddress = await aTokenConInstance.getDelayModule();
        console.log("delay module address", `${delayModuleaddress}`);

        const ownerOfBase = await aTokenConInstance.owner();
        console.log("owner of the vault", `${ownerOfBase}`);

        // await aTokenConInstance.setDelayModule(aFiDelayModule.address);

        // await aFiDelayModule.queueTransaction(
        //     aTokenConInstance.address,
        //     0,
        //     "0x",
        //     data,
        //     1718254858
        // )
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

        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        console.log("transfer complete")
        console.log("funded account balance usdttttttttt", investorusdtBalance)
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
    });


    it('should transfer AFi when transferability is true', async () => {


        await aTokenConInstance.connect(investor1).deposit(
            1000000000, usdtConInstance.address
        );

        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

        const swapParams = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 1,
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
            cometToClaim: [],
            cometRewardTokens: [],
            rewardTokenMinReturnAmounts: []
        };

        poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

        await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

        await aTokenConInstance.setAfiTransferability(true);

        const Afterbal = await aTokenConInstance.balanceOf(
            investor1.address
        );
        console.log("Afterbal", `${Afterbal}`)
        //expect(await aTokenConInstance.isAfiTransferrable()).to.equal(true);

        let investorDepositNav = await aTokenConInstance.depositUserNav(investor1.address);
        console.log("investor1 DepositNav", investorDepositNav);
        await aTokenConInstance.connect(investor1).transfer(aFiExchangeInstace.address, Afterbal);

        expect(await aTokenConInstance.balanceOf(aFiExchangeInstace.address)).to.equal(Afterbal);
    });

    it('should mint usdt to investor2 addresses and swap with afi', async () => {
        await aFiTestTokenInstace.mint(investor2.address, 1000000000000000000000n);
        await aFiTestTokenInstace.connect(investor2).approve(aFiExchangeInstace.address, 1000000000000000000000n);
        await aFiExchangeInstace.connect(investor2).swapUSDTForAFi(100000000000000000000n);
        let investorDepositNav = await aTokenConInstance.depositUserNav(investor2.address);
        console.log("investor2 DepositNav", investorDepositNav);
    })



    it('should trasnfer AFi when transferability is true to AFiExhange contract address', async () => {


        await aTokenConInstance.connect(investor1).deposit(
            1000000000, usdtConInstance.address
        );

        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

        const swapParams = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 1,
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
            cometToClaim: [],
            cometRewardTokens: [],
            rewardTokenMinReturnAmounts: []
        };

        poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

        await aTokenConInstance.setAfiTransferability(true);

        const Afterbal = await aTokenConInstance.balanceOf(
            investor1.address
        );
        console.log("Afterbal", `${Afterbal}`)


        let exchangeContractDepositNav = await aTokenConInstance.depositUserNav(aFiExchangeInstace.address);
        console.log("afiexchange nav before deposit ", exchangeContractDepositNav);

        let investorDepositNav = await aTokenConInstance.depositUserNav(investor1.address);
        console.log("investor1 DepositNav", investorDepositNav);

        await aTokenConInstance.connect(investor1).approve(aFiExchangeInstace.address, Afterbal);
        await aFiExchangeInstace.connect(investor1).depositAFiToken(Afterbal);


        exchangeContractDepositNav = await aTokenConInstance.depositUserNav(aFiExchangeInstace.address);
        console.log("afiexchange nav after deposit", exchangeContractDepositNav);

    });


})