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
const axios = require("axios");
const getBigNumber = (number) => ethers.BigNumber.from(number);

describe('AFiBase', () => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let aTokenConInstance;
    let aTokenConInstance1;
    let oneInchParam;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    let pendleReward;
    // let aFiDelayModule;

    beforeEach(async () => {

        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, other, gnosisWallet] = userAccounts;

        const currentTime = await time.latest();
        deadline = currentTime + (60 * 60);

        oneInchParam = {
            firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
        }

        const AFiBase = await ethers.getContractFactory('AtvBase');
        // const delayModule = await ethers.getContractFactory('TimeDelayModule');
        const AFiManager = await ethers.getContractFactory('AtvManager');
        const PassiveRebalanceStrategies = await ethers.getContractFactory('AtvPassiveRebalanceStrategies');

        const AFiStorage = await ethers.getContractFactory('AtvStorage');
        const AFiFacotry = await ethers.getContractFactory('AtvFactory');
        const AFiOracle = await ethers.getContractFactory('AtvOracle');
        const AFiDexAdapterV2 = await ethers.getContractFactory('AtvDexAdapter');
        const AFiMorphoVaultInteraction = await ethers.getContractFactory('AtvMorphoVaultInteraction');
        // LOCAL CONTRACTS
        aFiBaseInstace = await AFiBase.deploy("AFi802", "AFi");
        aFiManagerInstance = await AFiManager.deploy();
        aFiPassiveRebalanceInstance = await PassiveRebalanceStrategies.deploy();
        aFiAFiOracleInstance = await AFiOracle.deploy(aFiPassiveRebalanceInstance.address);
        // aFiDelayModule = await delayModule.deploy(86400, 172800);

        aFiFactoryInstance = await AFiFacotry.deploy(aFiBaseInstace.address);
        aFiStorageInstance = await AFiStorage.deploy(aFiManagerInstance.address, aFiAFiOracleInstance.address, aFiPassiveRebalanceInstance.address, aFiFactoryInstance.address);
        aFiDexAdapterV2Instance = await AFiDexAdapterV2.deploy("0xaa52bB8110fE38D0d2d2AF0B85C3A3eE622CA455", "0xaC041Df48dF9791B0654f1Dbbf2CC8450C5f2e9D", aFiPassiveRebalanceInstance.address);

        aFiMorphoInstance = await AFiMorphoVaultInteraction.deploy();
       
        // const payload = [
        //     [
        //         "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //         "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //         "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //         "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
        //     ],
        //     [
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //     ]
        // ]

        // const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)

        // const payloadnew = [
        //     ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
        //     ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
        //     uDataPayload,
        //     [
        //         "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4",
        //         "0x0000000000000000000000000000000000000000",
        //         "0x0000000000000000000000000000000000000000",
        //         "0xFAce851a4921ce59e912d19329929CE6da6EB0c7",
        //         "0x0000000000000000000000000000000000000000"
        //     ],
        //     [
        //         "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8",
        //         "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
        //         "0xF6D2224916DDFbbab6e6bd0D1B7034f4Ae0CaB18",
        //         "0x5E8C8A7243651DB1384C0dDfDbE39761E8e7E51a",
        //         "0x0000000000000000000000000000000000000000"
        //     ],
        //     [
        //         "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
        //         "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
        //         "0x553303d460ee0afb37edff9be42922d8ff63220e",
        //         "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
        //         "0x4ffc43a60e009b551865a93d232e33fce9f01507"
        //     ],
        //     ["2000000", "2000000", "2000000", "2000000", "2000000"],
        //     [
        //         "0x0000000000000000000000000000000000000000",
        //         "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
        //         "0x0000000000000000000000000000000000000000",
        //         "0x0000000000000000000000000000000000000000",
        //         "0x0000000000000000000000000000000000000000"
        //     ],
        //     2
        // ]

        // const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

        // result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
        //     aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

        // aTokenConInstance = await aFiFactoryInstance.aFiProducts(0);

        //let txObject = await result.wait()

        //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);

        // aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance);
        // //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));

        // await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
        //     "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        //     // "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
        //     "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
        //     "0xD533a949740bb3306d119CC777fa900bA034cd52"

        // ], [
        //     86500,
        //     86500,
        //     86500,
        //     //86500,
        //     86500,
        //     86500,
        //     86500,
        //     86500,
        //     86500,
        //     86500
        // ]);


        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);

        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

        // MAINNET CONTRACT INSTANCES
        //daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        //usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

        // await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdtConInstance.address, 500000000000000000000n);
        // await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, daiConInstance.address, 50000000000000000000000n);
        // await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdcConInstance.address, 50000000000000000000000n);

        const accountToInpersonate = "0x51ba05662A3b00731d451014540049B08a4e9ea5"
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

        // console.log("print the productttttttttttt", usdtConInstance.address);

        // console.log("print the productttttttttttt", aTokenConInstance.address);

        // await usdtConInstance.connect(investor1).approve(
        //     aTokenConInstance.address,
        //     ethers.constants.MaxUint256
        // );

        // await usdtConInstance.connect(investor2).approve(
        //     aTokenConInstance.address,
        //     ethers.constants.MaxUint256
        // );

        // await usdcConInstance.connect(investor1).approve(
        //     aTokenConInstance.address,
        //     ethers.constants.MaxUint256
        // );

        // await usdcConInstance.connect(investor2).approve(
        //     aTokenConInstance.address,
        //     ethers.constants.MaxUint256
        // );

        // await daiConInstance.connect(investor1).approve(
        //     aTokenConInstance.address,
        //     ethers.constants.MaxUint256
        // );

        // await daiConInstance.connect(investor2).approve(
        //     aTokenConInstance.address,
        //     ethers.constants.MaxUint256
        // );

        // const daiBalance = await daiConInstance.balanceOf(accountToInpersonate)
        // console.log("whale dai balance", daiBalance / 1e18)
        // console.log("transfering to", accountToFund)

        // var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        // // usdcBalance = usdcBalance / 2;

        // console.log("usdcBalance", usdcBalance);
        await usdcConInstance.connect(signer).transfer(investor1.address, usdcBalance);
        // await usdcConInstance.connect(signer).transfer(investor2.address, usdcBalance);

        // console.log("usdtBalance", usdtBalance)
        // usdtBalance = usdtBalance / 100;
        // console.log("usdtBalance", usdtBalance)
        // await usdtConInstance.connect(signer).transfer(investor1.address, "1783822029");
        // await usdtConInstance.connect(signer).transfer(investor2.address, "1783822029");

        // await aFiPassiveRebalanceInstance.updateMidToken(
        //     [
        //         "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //         "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //         "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //         "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
        //     ],
        //     [
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //     ]
        // );

        // await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        // await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        // const poolPayload = [
        //     [
        //         "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //         "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //         "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //         "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
        //         "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
        //     ],
        //     [
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        //     ],
        //     [
        //         "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
        //         "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
        //         "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
        //         "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
        //         "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

        //     ],
        //     [
        //         "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
        //         "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
        //         "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
        //         "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
        //         "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

        //     ],
        //     [
        //         [[
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //             "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
        //         ]], [[
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //             "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
        //         ]],
        //         [[
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
        //             "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //         ]]
        //     ],
        //     [
        //         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
        //         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        //         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
        //     ]
        // ]
        // const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
        // await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata);

        //const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
  
        // await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);
        // await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);
        //wait aTokenConInstance.setMinDepLimit(100);

        // const pwallet = await aTokenConInstance.getplatformWallet();
        // console.log("Platform wallet => ", pwallet);

        // // const data = await aFiDelayModule.encodeupdateTVLTransaction(3000);
        // // console.log("data generated", `${data}`);

        // const delayModuleaddress = await aTokenConInstance.getDelayModule();
        // console.log("delay module address", `${delayModuleaddress}`);

        // const ownerOfBase = await aTokenConInstance.owner();
        // console.log("owner of the vault", `${ownerOfBase}`);

        // await aTokenConInstance.setDelayModule(aFiDelayModule.address);

        // await aFiDelayModule.queueTransaction(
        //     aTokenConInstance.address,
        //     0,
        //     "0x",
        //     data,
        //     1718254858
        // )
        // await aFiPassiveRebalanceInstance.setPriceOracle(
        //     [
        //         "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        //         "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        //         "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        //     ],
        //     [
        //         //"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
        //         "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        //         "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
        //         "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
        //         "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
        //     ],
        //     [
        //         "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
        //         "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
        //         "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
        //     ], // USDT, USDC - chainlink oracles
        //     [
        //         //"0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
        //         "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
        //         "0x553303d460ee0afb37edff9be42922d8ff63220e",
        //         "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
        //         "0x4ffc43a60e009b551865a93d232e33fce9f01507"
        //     ],
        // );

        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        console.log("transfer complete")
        //console.log("funded account balance usdttttttttt", investorusdtBalance);
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
      
        // await aFiMorphoInstance.registerVault(aTokenConInstance.address, usdcConInstance.address, "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458");
    });

    context('Basic checks for deposit and withdraw', () => {
        describe('Product 401 - stables', async () => {
            beforeEach(async () => {
                const payload = [
                    [
                        //"0x6B175474E89094C44Da98b954EedeAC495271d0F", // underlying - DAI
                        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC
                        //"0xdAC17F958D2ee523a2206206994597C13D831ec7"  // USDT
                    ],
                    [
                        //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                        "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b",  // Middle Token of USDC
                        //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of USDT
                    ]
                ]

                const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);

                const payloadnew = [
                    [ "0x29219dd400f2Bf60E5a23d13Be72B486D4038894"], //USDT, USDC - payment tokens
                    [ "0x55bCa887199d5520B3Ce285D41e6dC10C08716C9"], // USDT, USDC - chainlink oracles
                    uDataPayload,
                    [
                        //"0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
                        "0x3F5EA53d1160177445B1898afbB16da111182418",
                        //"0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9"
                    ],
                    [
                        //"0x018008bfb33d285247A21d44E50697654f754e63",
                        "0x578Ee1ca3a8E1b54554Da1Bf7C583506C4CD11c6",
                        //"0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a"
                    ],
                    [
                        //"0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
                        "0x55bCa887199d5520B3Ce285D41e6dC10C08716C9",
                        //"0x3E7d1eAB13ad0104d2750B8863b489D65364e32D"
                    ],
                    ["10000000"],
                    [
                    //"0x0000000000000000000000000000000000000000", 
                    "0x0000000000000000000000000000000000000000", 
                    //"0x3Afdc9BCA9213A35503b077a6072F3D0d5AB0840"
                    ],
                    2
                ]

                const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);
                console.log("usdc payload", bytesPayload2);
                result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
                    aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, [], "0x0000000000000000000000000000000000000000");
                
                aTokenConInstance1 = await aFiFactoryInstance.aFiProducts(0);
    
                //let txObject = await result.wait()

                //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);
                console.log(">>..", aTokenConInstance1);
                aTokenConInstance1 = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance1);
                //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));

                await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
                  "0x29219dd400f2Bf60E5a23d13Be72B486D4038894"
                ], [
                    86500,
                ])

                await aTokenConInstance1.setplatformWallet(platformWallet.address);
                await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
                await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance1.address, investor1.address);

                // // Transfer all AFinance Tokens to PLATFORM_WALLET
                // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

                // MAINNET CONTRACT INSTANCES
                //daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
                usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
                //usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

                await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
                await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
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

                // console.log("print the productttttttttttt", usdtConInstance.address);

                // console.log("print the productttttttttttt", aTokenConInstance1.address);

                // await usdtConInstance.connect(investor1).approve(
                //     aTokenConInstance1.address,
                //     ethers.constants.MaxUint256
                // );

                // await usdtConInstance.connect(investor2).approve(
                //     aTokenConInstance1.address,
                //     ethers.constants.MaxUint256
                // );

                await usdcConInstance.connect(investor1).approve(
                    aTokenConInstance1.address,
                    ethers.constants.MaxUint256
                );

                await usdcConInstance.connect(investor2).approve(
                    aTokenConInstance1.address,
                    ethers.constants.MaxUint256
                );

                // await daiConInstance.connect(investor1).approve(
                //     aTokenConInstance1.address,
                //     ethers.constants.MaxUint256
                // );

                // await daiConInstance.connect(investor2).approve(
                //     aTokenConInstance1.address,
                //     ethers.constants.MaxUint256
                // );

                // const daiBalance = await daiConInstance.balanceOf(accountToInpersonate)
                // console.log("whale dai balance", daiBalance / 1e18)
                // console.log("transfering to", accountToFund)


                // await daiConInstance.connect(signer).transfer(investor1.address, daiBalance);

                // const accountBalance = await daiConInstance.balanceOf(investor1.address)
                // console.log("transfer complete")
                // // console.log("funded account balance", accountBalance / 1e18)

                // var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
                // let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
                // usdcBalance = usdcBalance / 100;

                // console.log("usdcBalance",usdcBalance);
                // await usdcConInstance.connect(signer).transfer(investor1.address, "10654653354");
                // await usdcConInstance.connect(signer).transfer(investor2.address, "10654653354");

                // console.log("usdtBalance", usdtBalance)
                // usdtBalance = usdtBalance / 100;
                // console.log("usdtBalance", usdtBalance)
                // await usdtConInstance.connect(signer).transfer(investor1.address, "208790359575");
                // await usdtConInstance.connect(signer).transfer(investor2.address, "208790359575");

                await aFiPassiveRebalanceInstance.updateMidToken(
                    [
                        
                        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", 
                        
                    ],
                    [
                        
                        "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b",  
                       
                    ]
                );

                await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
                await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
                await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

                await aFiPassiveRebalanceInstance.setPriceOracle(
                    [
                       
                        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
                       
                    ],
                    [
                       
                        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
                       
                    ],
                    [
                        
                        "0x55bCa887199d5520B3Ce285D41e6dC10C08716C9",
                        
                    ], 
                    [
                        
                        "0x55bCa887199d5520B3Ce285D41e6dC10C08716C9",
                        
                    ], 
                );
                const poolPayload = [
                    [
                        
                        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC
                       
                    ],
                    [
                        "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b",  // Middle Token of DAI
                       
                    ],
                    [
                       
                        "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b",  // pool USDC - WETH
                       
                    ],
                    [
                       
                        "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b",  // pool USDC - WETH
                       
                    ],
                    [
                        // [[
                        //     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                          
                        // ]],
                         [[
                            "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b", // pool USDC-WETH (Stables- I/O tokens)
                          
                        ]]
                    ],
                    [   
                       
                        "0x50c42dEAcD8Fc9773493ED674b675bE577f2634b"
                    ]
                ]

                const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
                console.log("unipooldata", unipooldata);
                await aFiPassiveRebalanceInstance.initUniStructure(["0x29219dd400f2Bf60E5a23d13Be72B486D4038894"], unipooldata);

                //const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
                await aTokenConInstance1.setMinDepLimit(100);
                await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);
                console.log("check111111111");
                await aFiMorphoInstance.setAtvContractController(aTokenConInstance1.address, investor1.address);
                
                await aFiMorphoInstance.connect(investor1).setAtvContractAllowed(aTokenConInstance1.address, true);
                console.log("check2222222222");

                await aFiMorphoInstance.connect(investor1).registerVault(aTokenConInstance1.address, usdcConInstance.address, "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458");
                console.log("transfer completey")
                await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);
                await aFiManagerInstance.setRebalanceController(investor1.address);
                await aFiAFiOracleInstance.connect(investor1).setMarketForToken(aTokenConInstance1.address, usdcConInstance.address, "0x3F5EA53d1160177445B1898afbB16da111182418")
                await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);
                await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xf1eF7d2D4C0c881cd634481e0586ed5d2871A74B", "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", 1);
                await aTokenConInstance1.setDexAdapter(aFiDexAdapterV2Instance.address);
                await aFiDexAdapterV2Instance.setAtvContractController(aTokenConInstance1.address, investor1.address);
                await aFiDexAdapterV2Instance.connect(investor1).setAtvContractAllowed(aTokenConInstance1.address, true);

                const API_URL = "https://api.odos.xyz";

  
                //console.log("funded account balance usdttttttttt", investorusdtBalance)

                async function fetchMorphoRewards(userAddress) {
                    try {
                      // Validate the address format (basic check)
                      if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                        throw new Error('Invalid Ethereum address format');
                      }
                      
                      console.log("Fetching data for address:", userAddress);
                      
                      // Construct the API URL with the user's address
                    //   const apiUrl = `https://api.merkl.xyz/v3/userRewards?user=0x42908773603BB69Db2020E5C0d105BE9c773AE4D&chainId=146`;
                    const apiUrl = 'https://api.merkl.xyz/v3/userRewards?chainId=146&user=0x42908773603BB69Db2020E5C0d105BE9c773AE4D&proof=true'
                      
                      console.log("API URL:", apiUrl);
                      
                      // Make the API request with axios
                      const response = await axios.get(apiUrl);
                      
                      console.log("Response status:", response.status);
                      
                      // The data is already parsed with axios
                      const data = response.data;
                      
                      console.log("Received data:", JSON.stringify(data, null, 2));
                      
                      // Process and display the important information
                      console.log('Morpho Rewards Information:');
                      console.log('--------------------------');
                      
                      if (data.data && data.data.length > 0) {
                        // Loop through all available distributions
                        data.data.forEach((distribution, index) => {
                          console.log(`Distribution #${index + 1}:`);
                          console.log(`User: ${distribution.user}`);
                          console.log(`Asset Address: ${distribution.asset.address}`);
                          console.log(`Chain ID: ${distribution.asset.chain_id}`);
                          console.log(`Distributor Address: ${distribution.distributor.address}`);
                          console.log(`Claimable Amount: ${distribution.claimable}`);
                          
                          // Display transaction data if available
                          if (distribution.tx_data) {
                            console.log(`Transaction Data Available: Yes`);
                          } else {
                            console.log(`Transaction Data Available: No`);
                          }
                          
                          // Display proof information
                          if (distribution.proof && distribution.proof.length > 0) {
                            console.log(`Merkle Proof: Available (${distribution.proof.length} elements)`);
                          } else {
                            console.log(`Merkle Proof: Not available`);
                          }
                          
                          console.log('--------------------------');
                        });
                      } else {
                        console.log('No reward distributions found for this address');
                      }
                      
                      // Return the full data for further processing if needed
                      return data;
                    } catch (error) {
                      console.error('Error fetching Morpho rewards:', error.message);
                      // Log more detailed error information
                      if (error.response) {
                        // The request was made and the server responded with a status code
                        // that falls out of the range of 2xx
                        console.error('Error details:', {
                          status: error.response.status,
                          data: error.response.data
                        });
                      } else if (error.request) {
                        // The request was made but no response was received
                        console.error('No response received:', error.request);
                      }
                      throw error;
                    }
                  }

                // Replace with the address you want to check
                const userAddress = "0x96Fe1F4e49b0C803F5633d3Dd6cDbA62C3e9c280"; 

                // Call the function
                const data =  await fetchMorphoRewards(userAddress)
                    
                console.log("data", data);
            });

            it('401', async () => {

                await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

                await aTokenConInstance1.connect(investor1).deposit(
                    100000000, usdcConInstance.address
                );

                var navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
                console.log("Nav after deposit", `${navfromStorage}`);
                
                oneInchParam = {
                    firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                    secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                    firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                    secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
                }

                const swapParams = {
                    afiContract: aTokenConInstance1.address,
                    oToken: usdcConInstance.address,
                    cSwapFee: 0,
                    cSwapCounter: 0,
                    depositTokens: ["0x29219dd400f2Bf60E5a23d13Be72B486D4038894"],
                    minimumReturnAmount: [0],
                    iMinimumReturnAmount: [0], // Adjust according to your contract's expectations
                    underlyingTokens: ["0x29219dd400f2Bf60E5a23d13Be72B486D4038894"],
                    newProviders: [2], // Fill this with the new providers' information
                    _deadline: deadline,
                    lpOut:0
                };

                poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);
                
                await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
                const morphoRewardData = {
                    rewardTokens: [],
                    underlyingTokens : [],
                    proofs: [],
                    rewardTokenAmount:[],
                    minReturnAmounts: [],
                    swapData: []
                  };
                  
                let pendleStakeData ="0x12599ac6000000000000000000000000732d2a5ae6576775c9edf9877bd03b5567e750940000000000000000000000003f5ea53d1160177445b1898afbb16da11118241800000000000000000000000000000000000000000000000000000000004963d0000000000000000000000000000000000000000000000000000000000009189c0000000000000000000000000000000000000000000000000000000000131a150000000000000000000000000000000000000000000000000000000000123139000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000093127920bee00000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000280000000000000000000000000578ee1ca3a8e1b54554da1bf7c583506c4cd11c60000000000000000000000000000000000000000000000000000000000970fe0000000000000000000000000578ee1ca3a8e1b54554da1bf7c583506c4cd11c6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
                await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, morphoRewardData, pendleStakeData, 0);

                let usdcBalance = await usdcConInstance.balanceOf(aTokenConInstance1.address);
                console.log("usdcBalance", usdcBalance);

                let usdcaaveBalance = await aFiStorageInstance.balanceAave(usdcConInstance.address, aTokenConInstance1.address);
                console.log("usdcaaveBalance----------", usdcaaveBalance);

                // usdcaaveBalance = await aFiStorageInstance.balanceCompoundInToken(usdcConInstance.address, aTokenConInstance1.address);
                // console.log("usdcbalanceCompoundBalance----------", usdcaaveBalance);

                // usdcaaveBalance = await aFiStorageInstance.balanceCompV3(usdcConInstance.address, aTokenConInstance1.address);
                // console.log("usdcbalanceCompV3Balance----------", usdcaaveBalance);

                navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
                console.log("Nav after cswap", `${navfromStorage}`);

                poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

                // await aTokenConInstance1.connect(investor1).deposit(
                //     100000000, usdcConInstance.address
                // );

                navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
                console.log("Nav after deposit2", `${navfromStorage}`);

                const minimumReturnAmount = [0, 0, 0, 0, 0];

                const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
                const returnString = Amount.map(bn => bn.toString());

                poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

                var bal = await usdcConInstance.balanceOf(investor1.address);
                console.log("balance usdt before withdraw", `${bal}`);

                bal = await aTokenConInstance1.balanceOf(investor1.address);
                console.log("balance usdt before withdraw", `${bal}`);

                // //Advance time by 2 weeks (14 days) to accrue rewards
                // await network.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 14 days in seconds
                // await network.provider.send("evm_mine"); // Mine a new block with the new timestamp

                await aFiAFiOracleInstance.connect(investor1).accrueRewards(aTokenConInstance1.address, usdcConInstance.address);

                pendleReward = await ethers.getContractAt(USDC_ABI, "0xf1eF7d2D4C0c881cd634481e0586ed5d2871A74B");
                const lpBalance = await pendleReward.balanceOf(aTokenConInstance1.address);
                console.log(`pendle token balance : ${ethers.utils.formatUnits(lpBalance, 0)}`);
                
                const API_URL = "https://api.odos.xyz";

                // Function to get the pathDefinition
                async function getPathDefinition(inputToken, inputAmount, outputToken, userAddress, chainId = 146) {
                try {
                    // Step 1: Ask Odos for a swap quote
                    const quoteResponse = await axios.post(`${API_URL}/sor/quote/v2`, {
                        chainId: chainId, // Sonic network
                        inputTokens: [{ tokenAddress: inputToken, amount: inputAmount.toString() }],
                        outputTokens: [{ tokenAddress: outputToken, proportion: 1 }],
                        userAddr: userAddress,
                        slippageLimitPercent: 0.3 // Allow 0.3% price change
                    });

                    if (!quoteResponse.data || !quoteResponse.data.pathId) {
                        throw new Error('Failed to receive valid quote data');
                    }

                    const pathId = quoteResponse.data.pathId;
                    console.log(`Quote received with pathId: ${pathId}`);

                    // Step 2: Get the transaction details using the pathId
                    const assembleResponse = await axios.post(`${API_URL}/sor/assemble`, {
                        userAddr: userAddress,
                        pathId: pathId
                    });

                    if (!assembleResponse.data || !assembleResponse.data.transaction || !assembleResponse.data.transaction.data) {
                        throw new Error('Failed to receive valid transaction data');
                    }

                    // Step 3: Return the full transaction data
                    // Note: Instead of trying to extract the pathDefinition with a fixed slice,
                    // we'll return the complete transaction data which includes the encoded path
                    return {
                        transactionData: assembleResponse.data.transaction.data,
                        pathId: pathId,
                        // Return other useful information from the response
                        gasEstimate: assembleResponse.data.transaction.gasEstimate || null,
                        outputAmount: quoteResponse.data.outputTokens?.[0]?.amount || null,
                        // Include the raw response for debugging or additional processing
                        rawAssembleResponse: assembleResponse.data
                    };
                } catch (error) {
                    // More detailed error handling
                    if (error.response) {
                        console.error('API Error:', error.response.status, error.response.data);
                        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
                    } else if (error.request) {
                        console.error('No response received:', error.request);
                        throw new Error('No response received from API');
                    } else {
                        console.error('Error:', error.message);
                        throw error;
                    }
                }
            }
            
                // Get path definition from Odos API
                const pendleSwapData = await getPathDefinition(
                    "0xf1eF7d2D4C0c881cd634481e0586ed5d2871A74B",
                    lpBalance,
                    "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
                    aTokenConInstance1.address
                );

                console.log("pendleSwapData.transactionData", pendleSwapData.transactionData);
                
                const getDex = await aFiDexAdapterV2Instance.getDexChoice("0xf1ef7d2d4c0c881cd634481e0586ed5d2871a74b", "0x29219dd400f2bf60e5a23d13be72b486d4038894", pendleSwapData.transactionData);
                console.log("getdex choice", getDex);
                
                await aFiAFiOracleInstance.connect(investor1).swapRewardsToStable(aTokenConInstance1.address, USDC_ADDRESS, USDC_ADDRESS, ["0x", pendleSwapData.transactionData], [0,0]);

                const usdcBalanceafterswap = await usdcConInstance.balanceOf(aTokenConInstance1.address);
                console.log("usdcBalanceafterswap", usdcBalanceafterswap);

                // // let sonicRewards = await ethers.getContractAt(USDC_ABI, "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38");
                // // const sonic = await sonicRewards.balanceOf(aTokenConInstance1.address);
                // // console.log(`sonicRewards token balance before removal: ${ethers.utils.formatUnits(sonic, 0)}`);


                // const removeCalldata = "0x60da0860000000000000000000000000732d2a5ae6576775c9edf9877bd03b5567e750940000000000000000000000003f5ea53d1160177445b1898afbb16da1111824180000000000000000000000000000000000000000000000000000000000935ef400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000578ee1ca3a8e1b54554da1bf7c583506c4cd11c600000000000000000000000000000000000000000000000000000000012ac561000000000000000000000000578ee1ca3a8e1b54554da1bf7c583506c4cd11c6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"; // Replace with SDK-generated calldata
                // await aTokenConInstance1.connect(investor1).withdraw(
                //     197801111576383300n, usdcConInstance.address, deadline, returnString, 3, 10000000, removeCalldata
                // );

                // // bal = await usdcConInstance.balanceOf(investor1.address);
                // // console.log("balance usdt after withdraw", `${bal}`);

                // // navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
                // // console.log("Nav after deposit2", `${navfromStorage}`);

                // //poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);
            });

        });
    });
});
 