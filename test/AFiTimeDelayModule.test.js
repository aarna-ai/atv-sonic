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

describe('AFiTimeDelayModule', () => {
    let platformWallet; let recipient; let investor1; let investor2;
    let deadline;
    let aTokenConInstance;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;

    beforeEach(async () => {
        const userAccounts = await ethers.getSigners();
        [platformWallet, recipient, investor1, investor2, other] = userAccounts;

        const feeData = await hre.ethers.provider.getFeeData();

        const currentTime = await time.latest();
        deadline = currentTime + (60 * 60);

        const AFiTimeDelayContract = await ethers.getContractFactory('TimeDelayModule');
        const AFiBase = await ethers.getContractFactory('AtvBase');
        const AFiManager = await ethers.getContractFactory('AtvManager');
        const PassiveRebalanceStrategies = await ethers.getContractFactory('AtvPassiveRebalanceStrategies');
        // const DataConsumerWithSequencerCheck = await ethers.getContractFactory('DataConsumerWithSequencerCheck');
        const AFiStorage = await ethers.getContractFactory('AtvStorage');
        const AFiFacotry = await ethers.getContractFactory('AtvFactory');
        const AFiOracle = await ethers.getContractFactory('AtvOracle');


        // LOCAL CONTRACTS
        aFiBaseInstace = await AFiBase.deploy("AFi802", "AFi");
        aFiManagerInstance = await AFiManager.deploy({
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            maxFeePerGas: feeData.maxFeePerGas,
            type: 2
        });
        aFiPassiveRebalanceInstance = await PassiveRebalanceStrategies.deploy({
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            maxFeePerGas: feeData.maxFeePerGas,
            type: 2
        });
        aFiAFiOracleInstance = await AFiOracle.deploy(aFiPassiveRebalanceInstance.address, {
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            maxFeePerGas: feeData.maxFeePerGas,
            type: 2
        });
        // dataConsumerWithSequencerCheckInstance = await DataConsumerWithSequencerCheck.deploy({
        //     maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        //     maxFeePerGas: feeData.maxFeePerGas,
        //     type: 2
        // });

        aFiFactoryInstance = await AFiFacotry.deploy(aFiBaseInstace.address, {
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            maxFeePerGas: feeData.maxFeePerGas,
            type: 2
        });

        aFiStorageInstance = await AFiStorage.deploy(aFiManagerInstance.address, aFiAFiOracleInstance.address, aFiPassiveRebalanceInstance.address, aFiFactoryInstance.address);

        await expect(AFiTimeDelayContract.deploy(0, 172800)).to.be.reverted;

        aFiTimeLockInstance = await AFiTimeDelayContract.deploy(investor1.address, 100, 172800);

        console.log("print the address of the aFiFactoryInstance", aFiFactoryInstance.address);

        // await aFiAFiOracleInstance.setOracleSequencer(dataConsumerWithSequencerCheckInstance.address);

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
            ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
            ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
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
            aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

        aTokenConInstance = await aFiFactoryInstance.aFiProducts(0);

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, aTokenConInstance);

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

        await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
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
        ])

        await aTokenConInstance.setplatformWallet(platformWallet.address);
        await aFiManagerInstance.setRebalanceController(platformWallet.address);
        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);
        await aTokenConInstance.setMinDepLimit(100);
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

        var usdtBalance = await usdtConInstance.balanceOf(accountToInpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToInpersonate);
        usdcBalance = usdcBalance / 100;

        console.log("usdcBalance", usdcBalance);

        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 100;
        console.log("usdtBalance", usdtBalance)

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
        await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata);

        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        console.log("transfer complete")
        console.log("funded account balance usdttttttttt", investorusdtBalance)
    });

    context('Basic checks for deposit and withdraw', () => {


        it('pause withdraw', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            var pausePayload = await aFiTimeLockInstance.pauseWithdraw(false);

            const currentTime = await time.latest();

            await aFiTimeLockInstance.connect(investor1).updateRescindController(other.address);
            console.log("Rescind controller set")

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            const delayModuleaddress = await aTokenConInstance.getDelayModule();
            console.log("delay module address", `${delayModuleaddress}`);

            const ownerOfBase = await aTokenConInstance.owner();
            console.log("owner of the vault", `${ownerOfBase}`);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction hasn't surpassed time lock");

            await expect(aFiTimeLockInstance.connect(platformWallet).cancelTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Caller is not the rescind controller");

            await aFiTimeLockInstance.connect(other).cancelTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            );

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction not found");

            await aTokenConInstance.setDelayModule(aFiTimeLockInstance.address);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 0
            )

            // await time.increaseTo(currentTime + 1);
            // comment out the following line in TimeDelayModule.sol before running executeTransaction()
            // require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
            // if not commented, find a way to increase time in hardhat(forked mainnet) before executing

            await aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 0
            )

            console.log("staleTokenBalOfAfiBase wallet's balance", `${staleTokenBalOfAfiBase}`);
        });

        it('unpause withdraw', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            var pausePayload = await aFiTimeLockInstance.unpauseWithdraw(false);

            const currentTime = await time.latest();

            await aFiTimeLockInstance.connect(investor1).updateRescindController(other.address);
            console.log("Rescind controller set")

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            const delayModuleaddress = await aTokenConInstance.getDelayModule();
            console.log("delay module address", `${delayModuleaddress}`);

            const ownerOfBase = await aTokenConInstance.owner();
            console.log("owner of the vault", `${ownerOfBase}`);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction hasn't surpassed time lock");

            await expect(aFiTimeLockInstance.connect(platformWallet).cancelTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Caller is not the rescind controller");

            await aFiTimeLockInstance.connect(other).cancelTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            );

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction not found");

            await aTokenConInstance.setDelayModule(aFiTimeLockInstance.address);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 0
            )

            // await time.increaseTo(currentTime + 1);
            // comment out the following line in TimeDelayModule.sol before running executeTransaction()
            // require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
            // if not commented, find a way to increase time in hardhat(forked mainnet) before executing

            await aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                pausePayload,
                `${currentTime}` + 0
            )

            console.log("staleTokenBalOfAfiBase wallet's balance", `${staleTokenBalOfAfiBase}`);
        });

        it('update admin', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            var padminPayload = await aFiTimeLockInstance.encodeUpdateAdmin(investor1.address);

            const currentTime = await time.latest();

            await aFiTimeLockInstance.connect(investor1).updateRescindController(other.address);
            console.log("Rescind controller set")

            await aFiTimeLockInstance.connect(other).updateExpirationPeriod(2000000);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            const delayModuleaddress = await aTokenConInstance.getDelayModule();
            console.log("delay module address", `${delayModuleaddress}`);

            const ownerOfBase = await aTokenConInstance.owner();
            console.log("owner of the vault", `${ownerOfBase}`);

            await aFiTimeLockInstance.queueTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 1
            )

            await expect(aFiTimeLockInstance.executeTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction hasn't surpassed time lock");

            await expect(aFiTimeLockInstance.connect(platformWallet).cancelTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Caller is not the rescind controller");

            await aFiTimeLockInstance.connect(other).cancelTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 1
            );

            await expect(aFiTimeLockInstance.executeTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction not found");

            await aTokenConInstance.setDelayModule(aFiTimeLockInstance.address);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            await aFiTimeLockInstance.queueTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 0
            )

            // await time.increaseTo(currentTime + 1);
            // comment out the following line in TimeDelayModule.sol before running executeTransaction()
            // require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
            // if not commented, find a way to increase time in hardhat(forked mainnet) before executing

            await aFiTimeLockInstance.executeTransaction(
                aFiTimeLockInstance.address,
                0,
                padminPayload,
                `${currentTime}` + 0
            )

            console.log("staleTokenBalOfAfiBase wallet's balance", `${staleTokenBalOfAfiBase}`);
        });

        it('emergency withdraw', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("After emergency rebalance nav from storage value", `${NavfromStorage}`);

            var uTokenProp2 = await aTokenConInstance.getProportions();
            console.log("uTokenProp", `${uTokenProp2[0]}`);

            var utokensafter = await aTokenConInstance.getUTokens();
            console.log(utokensafter);

            const linkTokenInstance = await ethers.getContractAt(DAI_ABI, usdcConInstance.address);

            var staleBal = await linkTokenInstance.balanceOf(aTokenConInstance.address);
            console.log("staleBal = ", `${staleBal}`);

            var timelockPaylod = await aFiTimeLockInstance.encodeEmergencyWithdraw(usdcConInstance.address, platformWallet.address);

            const currentTime = await time.latest();

            await aFiTimeLockInstance.connect(investor1).updateRescindController(other.address);
            console.log("Rescind controller set")

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            const delayModuleaddress = await aTokenConInstance.getDelayModule();
            console.log("delay module address", `${delayModuleaddress}`);

            const ownerOfBase = await aTokenConInstance.owner();
            console.log("owner of the vault", `${ownerOfBase}`);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 1
            )

            // await expect(aFiTimeLockInstance.executeTransaction(
            //     aTokenConInstance.address,
            //     0,
            //     timelockPaylod,
            //     `${currentTime}`+1
            // )).to.be.revertedWith("Timelock: Transaction hasn't surpassed time lock");

            await expect(aFiTimeLockInstance.connect(platformWallet).cancelTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 1
            )).to.be.revertedWith("Caller is not the rescind controller");

            await aFiTimeLockInstance.connect(other).cancelTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 1
            );

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 1
            )).to.be.revertedWith("Timelock: Transaction not found");

            await aTokenConInstance.setDelayModule(aFiTimeLockInstance.address);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            // await time.increaseTo(currentTime + 1);
            // comment out the following line in TimeDelayModule.sol before running executeTransaction()
            // require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
            // if not commented, find a way to increase time in hardhat(forked mainnet) before executing

            await aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            staleBal = await daiConInstance.balanceOf(platformWallet.address);
            staleTokenBalOfAfiBase = await daiConInstance.balanceOf(aTokenConInstance.address);

            console.log("platform wallet's balance", `${staleBal}`);
            console.log("staleTokenBalOfAfiBase wallet's balance", `${staleTokenBalOfAfiBase}`);
        });

        it('transfer Ownership', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            var timelockPaylod = await aFiTimeLockInstance.encodeTransferOwnership(other.address);

            const currentTime = await time.latest();

            const delayModuleaddress = await aTokenConInstance.getDelayModule();
            console.log("delay module address", `${delayModuleaddress}`);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            )

            // await expect(aFiTimeLockInstance.executeTransaction(
            //     aTokenConInstance.address,
            //     0,
            //     timelockPaylod,
            //     `${currentTime}`+2
            // )).to.be.revertedWith("Timelock: Transaction hasn't surpassed time lock");

            await expect(aFiTimeLockInstance.connect(investor1).cancelTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            )).to.be.revertedWith("Caller is not the rescind controller");

            await aFiTimeLockInstance.connect(investor1).updateRescindController(other.address);
            console.log("Rescind controller set")

            await aFiTimeLockInstance.connect(other).cancelTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            );

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            )).to.be.revertedWith("Timelock: Transaction not found");

            await aTokenConInstance.setDelayModule(aFiTimeLockInstance.address);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            // comment out the following line in TimeDelayModule.sol before running executeTransaction()
            // require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
            // if not commented, find a way to increase time in hardhat(forked mainnet) before executing

            await aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            );

            await aTokenConInstance.connect(other).acceptOwnership();
            expect(await aTokenConInstance.owner()).to.equal(other.address);
        });

        it('update tvl update period', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            var timelockPaylod = await aFiTimeLockInstance.encodeUpdateTVLUpdatePeriod(15);

            const currentTime = await time.latest();

            const delayModuleaddress = await aTokenConInstance.getDelayModule();
            console.log("delay module address", `${delayModuleaddress}`);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            )

            // await expect(aFiTimeLockInstance.executeTransaction(
            //     aTokenConInstance.address,
            //     0,
            //     timelockPaylod,
            //     `${currentTime}`+2
            // )).to.be.revertedWith("Timelock: Transaction hasn't surpassed time lock");

            await expect(aFiTimeLockInstance.connect(investor1).cancelTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            )).to.be.revertedWith("Caller is not the rescind controller");

            await aFiTimeLockInstance.connect(investor1).updateRescindController(other.address);
            console.log("Rescind controller set")

            await aFiTimeLockInstance.connect(other).cancelTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            );

            await expect(aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 2
            )).to.be.revertedWith("Timelock: Transaction not found");

            await aTokenConInstance.setDelayModule(aFiTimeLockInstance.address);

            await aFiTimeLockInstance.connect(other).updateDelay(1);

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            await aFiTimeLockInstance.queueTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            // comment out the following line in TimeDelayModule.sol before running executeTransaction()
            // require(block.timestamp >= eta, "Timelock: Transaction hasn't surpassed time lock");
            // if not commented, find a way to increase time in hardhat(forked mainnet) before executing

            await aFiTimeLockInstance.executeTransaction(
                aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}` + 0
            )

            expect(await aTokenConInstance.tvlUpdatePeriod()).to.equal(15);

            await aFiTimeLockInstance.connect(other).updateExpirationPeriod(100);
            expect(await aFiTimeLockInstance.expirationPeriod()).to.equal(100);
        });

        it("should revert if called by non-admin", async function () {

            const currentTime = await time.latest();
            var timelockPaylod = await aFiTimeLockInstance.encodeUpdateTVLUpdatePeriod(15);
            await expect(aFiTimeLockInstance.connect(investor2).queueTransaction(aTokenConInstance.address,
                0,
                timelockPaylod,
                `${currentTime}`)).to.be.reverted;
        });

        // Test case for Erequire statement
        //   it("should revert if eta is less than block.timestamp + delay", async function () {

        //     const currentTime = await time.latest();
        //     var timelockPaylod = await aFiTimeLockInstance.encodeUpdateTVLUpdatePeriod(15);
        //       await aFiTimeLockInstance.queueTransaction(aTokenConInstance.address,
        //         0,
        //         timelockPaylod,
        //         `${currentTime}`- `${1}`).to.be.reverted;

        //   });

        it("should revert if transaction does not exist", async function () {
            // Prepare parameters for the transaction
            const target = investor1.address; // Example address
            const value = 0; // Example value
            const data = "0x"; // Example data
            const eta = 1000; // Example eta

            // Ensure the transaction does not exist in queuedTransactions mapping
            await expect(
                aFiTimeLockInstance.cancelTransaction(target, value, data, eta)
            ).to.be.revertedWith("Timelock: Transaction not found");
        });

        // Test case for updateDelay: Revert if new delay is not greater than zero
        it("should revert if new delay is not greater than zero", async function () {
            const newDelay = 0; // Setting delay to zero, which is not allowed
            await expect(
                aFiTimeLockInstance.updateDelay(newDelay)
            ).to.be.revertedWith("Timelock: Delay must be greater than zero");
        });

        // Test case for updateExpirationPeriod: Revert if new expiration period is not greater than zero
        it("should revert if new expiration period is not greater than zero", async function () {
            const newExpirationPeriod = 0; // Setting expiration period to zero, which is not allowed
            await expect(
                aFiTimeLockInstance.updateExpirationPeriod(newExpirationPeriod)
            ).to.be.revertedWith("Timelock: Expiration Period must be greater than zero");
        });

        // Test case for updateRescindController: Revert if not called by the rescind controller
        it("should revert if not called by the rescind controller", async function () {
            const newController = investor1.address; // Assuming accounts[3] is not the rescind controller
            await expect(
                aFiTimeLockInstance.connect(investor2).updateRescindController(newController)
            ).to.be.revertedWith("Timelock: Caller is not the rescindChangeController");
        });


        // Test case for updateAdmin: Revert if not called by the admin
        it("should revert if not called by the admin", async function () {
            aFiTimeLockInstance.updateAdmin(investor1.address);
            const newAdmin = investor1.address; // Assuming accounts[3] is not the admin
            await expect(
                aFiTimeLockInstance.connect(investor2).updateAdmin(newAdmin)
            ).to.be.revertedWith("Timelock: must be called by this contract only");
        });

        // Test case for updateDelay: Revert if new delay is not greater than zero
        it("should revert if new delay is not greater than zero", async function () {
            await aFiTimeLockInstance.updateDelay(1);

            const newDelay = 0; // Setting delay to zero, which is not allowed
            await expect(
                aFiTimeLockInstance.updateDelay(newDelay)
            ).to.be.revertedWith("Timelock: Delay must be greater than zero");
        });

        // Test case for updateExpirationPeriod: Revert if new expiration period is not greater than zero
        it("should revert if new expiration period is not greater than zero", async function () {
            await aFiTimeLockInstance.updateExpirationPeriod(1);
            const newExpirationPeriod = 0; // Setting expiration period to zero, which is not allowed
            await expect(
                aFiTimeLockInstance.updateExpirationPeriod(newExpirationPeriod)
            ).to.be.revertedWith("Timelock: Expiration Period must be greater than zero");
        });
    });
});