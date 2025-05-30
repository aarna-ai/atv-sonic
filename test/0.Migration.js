/* eslint-disable no-underscore-dangle */
const { assert, expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { time, constants } = require("@openzeppelin/test-helpers");
const { provider } = waffle;


const { abi: AFIBASE_ABI } = require('../artifacts/contracts/AtvBase.sol/AtvBase.json');
const { abi: PARENT_AFIBASE_ABI } = require('../artifacts/contracts/mockcontracts/contracts/ParentAFiBase.sol/ParentAFiBase.json');


const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../utils/constants');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const exp = require('constants');
const { zeroAddress } = require('ethereumjs-util');

const getBigNumber = (number) => ethers.BigNumber.from(number);

describe('AFiBase - migration testing', () => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let aTokenConInstance;
    let aTokenConInstance1;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    // let aFiDelayModule;

    let oneInchParam;

    beforeEach(async () => {

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
        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance);

        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdtConInstance.address, 500000000000000000000n);
    


        await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], aTokenConInstance.address);


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

        await usdtConInstance.connect(investor1).approve(
            aTokenConInstanceNew.address,
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
        console.log("funded account balance usdttttttttt", investorusdtBalance);
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
    });

    context('Basic checks for deposit and withdraw', () => {

        it("deposit check", async () => {
            let depositAmount = 0;


            await expect(aTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            )).to.be.reverted;

            //when payment token is not the whitelisted one
            await expect(aTokenConInstance.connect(investor1).deposit(
                1000000000, "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"
            )).to.be.reverted;

            console.log("Deposit call success");
            depositAmount = 1000000000;

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);

            await aTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );

            const totalSupply = await aTokenConInstance.totalSupply();
            const afiTokenBal = await aTokenConInstance.balanceOf(investor1.address);
            console.log(`balance of afi Token after deposit, ${afiTokenBal}`);
            console.log(`totalSupply Value, ${totalSupply}`);
            expect(`${totalSupply}`).to.not.equal(0);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);

            await aTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            );

            var totalsupply = await aTokenConInstance.totalSupply();
            console.log("totalsupply of parent vault", totalsupply);

            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply of child vault", totalsupply);

            expect(totalsupply).to.equal(0);

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: aTokenConInstance.address,
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

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);

            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x");

            await expect(aTokenConInstanceNew.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            )).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstanceNew.address, 1980000000);
            console.log("Pause deposit and withdraw from old vault");
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aTokenConInstance.pauseWithdraw(true);


            await aTokenConInstanceNew.migration(usdtConInstance.address);
            totalsupply = await aTokenConInstanceNew.totalSupply();
            console.log("totalsupply", totalsupply);

            await expect(aTokenConInstance.connect(investor1).deposit(
                depositAmount, usdtConInstance.address
            )).to.be.reverted;

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

            await aTokenConInstance.connect(investor1).approve(
                aTokenConInstanceNew.address,
                ethers.constants.MaxUint256
            );

            await aTokenConInstance.setAfiTransferability(true);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable before exchange cs counter 0", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable before exchange cs counter 1", `${nonWithdrawable}`);

            expect(nonWithdrawable).to.be.gt(0);

            console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

            await aTokenConInstanceNew.connect(investor1).exchangeToken();

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after exchange cs counter 0", `${nonWithdrawable}`);

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

            await expect(aTokenConInstance.connect(investor1).withdraw(
                afinewTokenBal, usdtConInstance.address, deadline, returnString, 3, 0
            )).to.be.reverted;

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

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParamsForNewVault, 0, oneInchParam, "0x");

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 0);
            console.log("non withdrawable after cumulative swap cs counter 0", `${nonWithdrawable}`);

            console.log("###############");

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 1);
            console.log("non withdrawable after cumulative swap cs counter 1", `${nonWithdrawable}`);

            nonWithdrawable = await aTokenConInstanceNew.getNonWithdrawableShares(investor1.address, 2);
            console.log("non withdrawable after cumulative swap cs counter 2", `${nonWithdrawable}`)
            expect(nonWithdrawable).to.equal(0);

            afinewTokenBal = await aTokenConInstanceNew.balanceOf(investor1.address);
            console.log("bal of new afi after exchange and cs", afinewTokenBal);

            await aTokenConInstanceNew.connect(investor1).withdraw(
                afinewTokenBal, usdtConInstance.address, deadline, returnString, 3, 0
            );
        });
    });
});