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

describe('AFiOracle main contract', (accounts) => {
    let platformWallet; let recipient; let investor1; let investor2; let investor3;
    let deadline;
    let deployedAFiBase;
    let aTokenConInstance;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    let snapshotId;
    let oneInchParam;

    beforeEach(async () => {


        oneInchParam = {
            firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
        }

        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, investor3, investor4, owner] = userAccounts;

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
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",  // Middle Token of USDT  
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

        deployedAFiBase = await aFiFactoryInstance.aFiProducts(0);

        console.log("aTokenConInstance===================", deployedAFiBase);

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
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
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",  // Middle Token of USDT  USDT - Pool 
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ]
        );
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        const poolPayload = [
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
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x3470447f3CecfFAc709D3e783A307790b0208d60",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH  special case man
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x3470447f3CecfFAc709D3e783A307790b0208d60",  // Pool USDT-WETH (Stables- I/O tokens)  change usdt-weth
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                ]],
                [[
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

        await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);
        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        await aTokenConInstance.setMinDepLimit(100);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

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
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
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


        const daiBalance = await daiConInstance.balanceOf(accountToInpersonate)
        console.log("whale dai balance", daiBalance / 1e18)
        console.log("transfering to", accountToFund)

        // const accountBalance = await daiConInstance.balanceOf(investor1.address)
        console.log("transfer complete")
        // console.log("funded account balance", accountBalance / 1e18)

        var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        usdcBalance = usdcBalance / 100;

        console.log("usdcBalance", usdcBalance);
        await usdcConInstance.connect(signer).transfer(investor1.address, "10654653354");
        await usdcConInstance.connect(signer).transfer(investor2.address, "10654653354");

        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 100;
        console.log("usdtBalance", usdtBalance)
        await usdtConInstance.connect(signer).transfer(investor1.address, "108790359575");
        await usdtConInstance.connect(signer).transfer(investor2.address, "108790359575");
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);
        // await aFiManagerInstance.setRebalanceController(rebalanceController.address);

        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
    })

    context('Basic checks for deposit and withdraw', () => {

        it('basic oracle checks', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiPassiveRebalanceInstance.updateSecAgo(300);
            const secAgo = await aFiPassiveRebalanceInstance.getSecAgo();
            expect(`${secAgo}`).to.equal('300');

            await expect(aFiPassiveRebalanceInstance.connect(investor1).updateSecAgo(300)).to.be.reverted;

            const stalepriceWindowLimit = await aFiPassiveRebalanceInstance.getstalepriceWindowLimit();
            console.log("Stale Price Window Limit => ", stalepriceWindowLimit);

            await aFiPassiveRebalanceInstance.updateGlobalFees([usdtConInstance.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", usdtConInstance.address], [usdcConInstance.address, usdtConInstance.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], [10000, 10000, 10000]);


            const fee = await aFiPassiveRebalanceInstance._fee(usdtConInstance.address, usdcConInstance.address);
            expect(`${fee}`).to.equal('10000');

            var totalProfit = await aFiAFiOracleInstance.getTotalProfit();
            expect(`${totalProfit}`).to.equal('10');

            var daoProfit = await aFiAFiOracleInstance.getDaoProfit();
            expect(`${daoProfit}`).to.equal('6');

            await expect(aFiPassiveRebalanceInstance.connect(investor1).updateGlobalFees([usdtConInstance.address], [usdcConInstance.address], [10000])).to.be.reverted;

            // await expect(aFiAFiOracleInstance.connect(investor1).setStalePriceDelay("0xdAC17F958D2ee523a2206206994597C13D831ec7", 4000)).to.be.reverted;
            await aFiPassiveRebalanceInstance.setstalepriceWindowLimit(5000);

            await expect(aFiPassiveRebalanceInstance.connect(investor1).setstalepriceWindowLimit(5000)).to.be.reverted;

            // await expect(aFiAFiOracleInstance.setStalePriceDelay("0xdAC17F958D2ee523a2206206994597C13D831ec7", 4000)).to.be.revertedWith('AFO01');

            // await aFiAFiOracleInstance.setStalePriceDelay("0xdAC17F958D2ee523a2206206994597C13D831ec7", 6000);
            await aFiPassiveRebalanceInstance.getStalePriceDelay("0xdAC17F958D2ee523a2206206994597C13D831ec7");
            // expect(`${stalePriceDelay}`).to.equal('6000');

            var amountOut = await aFiPassiveRebalanceInstance.estimateAmountOut("0xdAC17F958D2ee523a2206206994597C13D831ec7", 1000000, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
            var amountOut = await aFiPassiveRebalanceInstance.estimateAmountOutMin("0xdAC17F958D2ee523a2206206994597C13D831ec7", 1000000, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36");

            await expect(aFiPassiveRebalanceInstance.estimateAmountOut("0xdAC17F958D2ee523a2206206994597C13D831ec7", 1000000, "0xdAC17F958D2ee523a2206206994597C13D831ec7")).to.be.revertedWith("AF03");
            await expect(aFiPassiveRebalanceInstance.estimateAmountOutMin("0xdAC17F958D2ee523a2206206994597C13D831ec7", 1000000, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", constants.ZERO_ADDRESS)).to.be.revertedWith("AF03");

            const lastSwapped = await aFiAFiOracleInstance.getLastSwapTime(aTokenConInstance.address);
            expect(Number(lastSwapped)).to.equal(0);

            await aFiAFiOracleInstance.updateSwapPeriod(aTokenConInstance.address, 10000);

            await expect(aFiAFiOracleInstance.connect(investor1).updateSwapPeriod(aTokenConInstance.address, 10000)).to.be.reverted;

            const csPeriod = await aFiAFiOracleInstance.getSwapPeriod(aTokenConInstance.address);
            expect(`${csPeriod}`).to.equal('10000');

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            var qNAV = await aFiAFiOracleInstance.getUserQueuedNAV(
                investor1.address,
                aTokenConInstance.address,
                usdcConInstance.address,
                0
            );
            console.log("qNAV", qNAV);

            await aFiAFiOracleInstance.settxFee(700000000000000000000n);

            await expect(aFiAFiOracleInstance.connect(investor1).settxFee(1000)).to.be.reverted;

            await expect(aFiAFiOracleInstance.settxFee(10000000000000000000000n)).to.be.revertedWith('AO24');

            await expect(aFiAFiOracleInstance.connect(investor1).updateProfitShare(10, 3)).to.be.reverted;

            await expect(aFiAFiOracleInstance.updateProfitShare(11, 3)).to.be.revertedWith('AO24');

            await aFiAFiOracleInstance.updateProfitShare(10, 3);

            var controllers = await aFiAFiOracleInstance.getControllers(aTokenConInstance.address);
            console.log("controllers", controllers);

            const midTok = await aFiPassiveRebalanceInstance.getMidToken("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599");
            await aFiPassiveRebalanceInstance.setstalepriceWindowLimit(100);

            var val = await aFiAFiOracleInstance.getPriceInUSD("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
            var getFee = await aFiAFiOracleInstance.getFeeDetails();
            console.log("getFee", getFee);

            val = await aFiAFiOracleInstance.getPriceInUSD("0xD31a59c85aE9D8edEFeC411D448f90841571b89c");

            var getAFiContracts = await aFiAFiOracleInstance.getAFiContracts();
            console.log("AFiContracts - set in AFiOracle contract", getAFiContracts);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('unpause the contract', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            // when manager contract is not already paused
            await expect(aFiAFiOracleInstance.unPause()).to.be.reverted;

            await aFiAFiOracleInstance.pause();

            await expect(aFiAFiOracleInstance.updateProfitShare(10, 3)).to.be.reverted;

            await aFiAFiOracleInstance.connect(platformWallet).unPause();
            expect((await aFiAFiOracleInstance.paused())).to.equal(false);
            await aFiAFiOracleInstance.pause();
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('pause the contract from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            // when manager contract is not already paused
            await expect(aFiAFiOracleInstance.connect(investor1).pause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('pause and unpause the contract from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiAFiOracleInstance.pause();
            await expect(aFiAFiOracleInstance.connect(investor1).unPause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('pause the contract when it is already paused', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiAFiOracleInstance.pause();
            // when manager contract is already paused
            await expect(aFiAFiOracleInstance.connect(investor1).pause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        })

        it('pause the contract from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await expect(aFiAFiOracleInstance.connect(investor2).updateAFiManager(aFiAFiOracleInstance.address)).to.be.reverted;

            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('transfer profit share to the team after redeem', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiStorageInstance.setStakingPercentage(100);

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



            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



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
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await aTokenConInstance.balanceOf(investor1.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)




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




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
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
                cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
                cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
                rewardTokenMinReturnAmounts: [0]
            };

            var balInjection = await usdtConInstance.balanceOf(investor1.address);
            console.log("balInjection", balInjection);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, balInjection);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            await aTokenConInstance.connect(investor2).deposit(
                1000000000, usdcConInstance.address
            );

            console.log("withdraw:");

            //To check the profit distribution
            await aTokenConInstance.connect(investor1).withdraw(
                ether(2), usdtConInstance.address, deadline, returnString, 3, 0
            );
            console.log("withdraw: done");


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
                aTokenConInstance.address, ether(2), usdtConInstance.address
            );

            balInjection = await usdtConInstance.balanceOf(investor1.address);
            console.log("balInjection", balInjection);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, balInjection);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav - before unstake", `${checkNav}`);

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, true);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);

            _unstakeData = {
                iTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                oToken: usdtConInstance.address,
                deadline: deadline,
                minimumReturnAmount: [0, 0, 0, 0, 0],
                minOutForiToken: [0, 0, 0],
                unstakingFees: 0
            }

            await aFiAFiOracleInstance.connect(investor1).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData,
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ],
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ], 7381342582
            );

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);


            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav - after unstake", `${checkNav}`);

            var beforeinvestorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("before redeem funded account investor1 balance usdt", beforeinvestorusdtBalance)

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, false);


            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(2), usdtConInstance.address
            );

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, true);

            await aFiAFiOracleInstance.connect(investor1).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData,
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ],
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ], 3874498460
            );

            usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("before redeem usdtBalance", usdtBalance);

            usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("before redeem usdtBalance ----------------------1", usdtBalance);

            await aFiAFiOracleInstance.connect(investor1).redeem(aTokenConInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7"], 0);

            usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after redeem first usdtBalance ----------------------2", usdtBalance);

            await aFiAFiOracleInstance.connect(investor1).redeem(aTokenConInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7"], 1);

            usdtBalance = await usdtConInstance.balanceOf(investor1.address)

            console.log("after redeem second usdtBalance ----------------------2", usdtBalance);


            userQueuedShare = await aFiAFiOracleInstance.getUserQueuedShares(investor1.address, aTokenConInstance.address, usdtConInstance.address, 0);
            console.log("user's shares to unqueue", userQueuedShare);

            expect(Number(userQueuedShare)).to.equal(0);

            usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after redeem usdtBalance", usdtBalance);


            await aFiAFiOracleInstance.unstakingProfitDistribution(aTokenConInstance.address, aFiStorageInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"]);


            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('Withdraw in iToken when all the underlying tokens removed by AR2', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
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
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await usdtConInstance.balanceOf(aTokenConInstance.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)

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

            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(1), usdtConInstance.address
            );

            var userQueuedShare = await aFiAFiOracleInstance.getUserQueuedShares(investor1.address, aTokenConInstance.address, usdtConInstance.address, 0);
            console.log("user's shares in queue", userQueuedShare);
            expect(Number(userQueuedShare)).to.greaterThan(0);

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, true);

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",
                [2500000, 2500000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [5000000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                [5000000, 5000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                [10000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                [],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            _unstakeData = {
                iTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                oToken: usdcConInstance.address,
                deadline: deadline,
                minimumReturnAmount: [0, 0, 0, 0, 0],
                minOutForiToken: [0, 0, 0],
                unstakingFees: 0
            }
     
            await aFiAFiOracleInstance.connect(investor1).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData, [
                "0x",
                "0x",
                "0x",
                "0x",
                "0x"
            ],
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ], 0);

            const checkBalance = await usdtConInstance.balanceOf(aFiAFiOracleInstance.address);
            console.log("checkBalance", checkBalance);
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('when some underlying tokens are removed by AR2 but cs happened after the removal', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
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
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await usdtConInstance.balanceOf(aTokenConInstance.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)

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

            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(1), usdtConInstance.address
            );

            var userQueuedShare = await aFiAFiOracleInstance.getUserQueuedShares(investor1.address, aTokenConInstance.address, usdtConInstance.address, 0);
            console.log("user's shares in queue", userQueuedShare);
            expect(Number(userQueuedShare)).to.greaterThan(0);

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, true);

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",
                [2500000, 2500000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [5000000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                [5000000, 5000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            _unstakeData = {
                iTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                oToken: usdtConInstance.address,
                deadline: deadline,
                minimumReturnAmount: [0, 0, 0, 0, 0],
                minOutForiToken: [0, 0, 0],
                unstakingFees: 0
            }

            await aFiAFiOracleInstance.connect(investor1).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData, [
                "0x",
                "0x",
                "0x",
                "0x",
                "0x"
            ],
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ], 0);

            const checkBalance = await usdtConInstance.balanceOf(aFiAFiOracleInstance.address);
            console.log("checkBalance", checkBalance);
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('revert when some tokens are in iToken and underlying tokens and cs isnt happened yet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
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
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await usdtConInstance.balanceOf(aTokenConInstance.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)

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

            await aFiAFiOracleInstance.connect(investor1).queueWithdraw(
                aTokenConInstance.address, ether(1), usdtConInstance.address
            );

            var userQueuedShare = await aFiAFiOracleInstance.getUserQueuedShares(investor1.address, aTokenConInstance.address, usdtConInstance.address, 0);
            console.log("user's shares in queue", userQueuedShare);
            expect(Number(userQueuedShare)).to.greaterThan(0);

            await aFiAFiOracleInstance.connect(investor1).pauseUnpauseQueue(aTokenConInstance.address, true);

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",
                [2500000, 2500000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [5000000, 2500000, 2500000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            await aFiManagerInstance.connect(platformWallet).algoRebalance2(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                [5000000, 5000000],
                usdtConInstance.address,
                deadline,
                0,
                "0x"
            );

            _unstakeData = {
                iTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                oToken: usdtConInstance.address,
                deadline: deadline,
                minimumReturnAmount: [0, 0, 0, 0, 0],
                minOutForiToken: [0, 0, 0],
                unstakingFees: 0
            }

            await expect(aFiAFiOracleInstance.connect(investor1).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData, [
                "0x",
                "0x",
                "0x",
                "0x",
                "0x"
            ],
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ], 0)).to.be.reverted;

            const checkBalance = await usdtConInstance.balanceOf(aFiAFiOracleInstance.address);
            console.log("checkBalance", checkBalance);
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('cumulativeswap when cswap fees is > zero', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



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
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('cumulativeswap when cswap fees is > the set fee', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            // await aFiAFiOracleInstance.settxFee(10000000000000000000000n);

            console.log("transfer complete--------------------------")


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

            console.log("transfer complete------------*********--------------")

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

            console.log("transfer complete---------------))-------------------")

            const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };




            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );




            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



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
                cSwapFee: 1000000000,
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
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('cumulativeswap when cswap fees is zero', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );


            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



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
                cSwapFee: 0,
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
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('unstakingProfitDistribution from a non owner', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await expect(aFiAFiOracleInstance.connect(investor2).unstakingProfitDistribution(aTokenConInstance.address, aFiStorageInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"])).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('unstakeForQueuedWithdrawals call from a random address', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            var _unstakeData = {
                iToken: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                oToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                deadline: deadline,
                minimumReturnAmount: [0, 0, 0, 0, 0],
                minOutForiToken: [0, 0, 0],
                unstakingFees: 0
            }

            await expect(aFiAFiOracleInstance.connect(investor2).unstakeForQueuedWithdrawals(aTokenConInstance.address, _unstakeData, [
                "0x",
                "0x",
                "0x",
                "0x",
                "0x"
            ],
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ], 0)).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('update afimanager from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            // when manager contract is not already paused
            await expect(aFiAFiOracleInstance.connect(investor1).pause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('profit share', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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




            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await expect(aFiAFiOracleInstance.connect(investor1).updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address)).to.be.reverted;

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1,
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
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            await usdtConInstance.connect(investor1).transfer(aTokenConInstance.address, 100000000);
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiAFiOracleInstance.connect(investor2).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0)).to.be.reverted;

            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await aTokenConInstance.balanceOf(investor1.address);
            console.log("Afterbal++++++3", `${Afterbal1}`)




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




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );




            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );







            //To check the profit distribution
            await aTokenConInstance.connect(investor1).withdraw(
                ether(2), usdtConInstance.address, deadline, returnString, 3, 0
            );

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('profit share', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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
            console.log("funded account balance", accountBalance / 1e18)



            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            await ethers.provider.send('evm_revert', [snapshotId]);
        });
    });
});