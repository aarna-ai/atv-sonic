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

describe('PassiveRebal', (accounts) => {
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
        await aFiAFiOracleInstance.updateRebalContract(aFiPassiveRebalanceInstance.address);

        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

        // MAINNET CONTRACT INSTANCES
        daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdtConInstance.address, 500000000000000000000n);
        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, daiConInstance.address, 50000000000000000000000n);
        await aFiStorageInstance.setStablesWithdrawalLimit(aTokenConInstance.address, usdcConInstance.address, 50000000000000000000000n);

        const accountToInpersonate = "0x9E4E147d103deF9e98462884E7Ce06385f8aC540"
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

        it('should pause the contract', async function () {
            // Call the pause function
            await aFiPassiveRebalanceInstance.pause();

            // Check if the contract is paused
            const isPaused = await aFiPassiveRebalanceInstance.getPauseStatus();
            expect(isPaused).to.be.true;
        });

        it('should unpause the contract', async function () {
            // // First, pause the contract (assuming it is not already paused)
            await aFiPassiveRebalanceInstance.pause();

            // Call the unPause function
            await aFiPassiveRebalanceInstance.unPause();

            // Check if the contract is not paused
            const isPaused = await aFiPassiveRebalanceInstance.getPauseStatus();
            expect(isPaused).to.be.false;
        });

        it('should revert pause the contract', async function () {
            await aFiPassiveRebalanceInstance.pause();
            // Attempt to pause the contract with a non-owner address
            await expect(aFiPassiveRebalanceInstance.connect(investor1).pause()).to.be.reverted;
        });

        it('should revert unpause the contract', async function () {
            await aFiPassiveRebalanceInstance.pause();
            await aFiPassiveRebalanceInstance.unPause();
            // Attempt to unpause the contract with a non-owner address
            await expect(aFiPassiveRebalanceInstance.connect(investor2).unPause()).to.be.reverted;
        });

        it('should revert when non-owner tries to pause the contract', async function () {
            await aFiPassiveRebalanceInstance.pause();
            await aFiPassiveRebalanceInstance.unPause();
            // Attempt to pause the contract with a non-owner address
            await expect(aFiPassiveRebalanceInstance.connect(investor1).pause()).to.be.reverted;
        });

        it('should revert when non-owner tries to unpause the contract', async function () {
            await aFiPassiveRebalanceInstance.pause();
            // Attempt to unpause the contract with a non-owner address
            await expect(aFiPassiveRebalanceInstance.connect(investor1).unPause()).to.be.reverted;
            await aFiPassiveRebalanceInstance.unPause();
        });

        it('should set the storage address by owner', async function () {
            const newAfiStorage = investor1.address; // Assuming accounts is an array of addresses
            // Call the setStorage function by the owner
            await aFiPassiveRebalanceInstance.setStorage(newAfiStorage);

            // Check if the storage address has been updated
            const updatedStorage = await aFiPassiveRebalanceInstance.afiStorage();
            //await aFiPassiveRebalanceInstance.connect(investor1).updateuniPool("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
            expect(updatedStorage).to.equal(newAfiStorage);
        });


        it('should fail require when trying to set storage with zero address', async function () {
            const zeroAddress = '0x0000000000000000000000000000000000000000'; // Zero address

            // Attempt to set storage with zero address
            await expect(aFiPassiveRebalanceInstance.setStorage(zeroAddress)).to.be.reverted;

            await expect(aFiPassiveRebalanceInstance.setStorage(investor1.address), "Given address is not correct");
        });

        it('should set the manager address by owner', async function () {
            const newAfiManager = investor2.address; // Assuming accounts is an array of addresses
            // Call the setManager function by the owner
            await aFiPassiveRebalanceInstance.setManager(newAfiManager);
            // Check if the manager address has been updated
            const updatedManager = await aFiPassiveRebalanceInstance.afiManager();
            expect(updatedManager).to.equal(newAfiManager);
        });


        it('revert when set the manager  and setPassiveRebalancedStatus address by non - owner', async function () {

            await expect(aFiPassiveRebalanceInstance.connect(investor2).setManager(aTokenConInstance.address)).to.be.revertedWith('Ownable: caller is not the owner');

        })

        it('should revert when trying to unpause a contract that is not paused', async function () {

            // Attempt to unpause the contract, which should revert
            await expect(aFiPassiveRebalanceInstance.unPause()).to.be.reverted;
        });

        it('revert when set the manager  and setPassiveRebalancedStatus address by non - owner', async function () {

            await expect(aFiPassiveRebalanceInstance.connect(investor2).setManager(aTokenConInstance.address)).to.be.revertedWith('Ownable: caller is not the owner');

        })


        it('should fail require when trying to set manager with zero address', async function () {
            const zeroAddress = '0x0000000000000000000000000000000000000000'; // Zero address

            // Attempt to set manager with zero address
            await expect(aFiPassiveRebalanceInstance.setManager(zeroAddress)).to.be.reverted;

            await expect(aFiPassiveRebalanceInstance.setManager(investor1.address), "Given address is not correct");
        });


        it("Renounce Ownership", async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiPassiveRebalanceInstance.connect(platformWallet).renounceOwnership();
            const owner = await aFiPassiveRebalanceInstance.owner();
            expect(`${owner}`).to.equal(constants.ZERO_ADDRESS);
            if (`${owner}` == constants.ZERO_ADDRESS) {
                console.log("Owner : ", `${owner}`);
                await expect(
                    aFiPassiveRebalanceInstance.connect(investor1).transferOwnership(investor2.address)
                ).to.be.reverted;
            } else {
                console.log("Failed to renounce the ownership ");
            }

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

    
        it('set Rebalanced status to false and check deposit', async () => {

            snapshotId = await ethers.provider.send('evm_snapshot');
            const data = await aTokenConInstance.getProportions();

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
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            const swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
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
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const data1 = await aTokenConInstance.getProportions();
            expect(`${data1[2]}`).to.equal(`${data[2]}`);
            console.log(`${data[0]}`);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('set Rebalanced status to true again but rebal period not reached', async () => {

            snapshotId = await ethers.provider.send('evm_snapshot');

            // set rebal strattegy to 1
            await aFiPassiveRebalanceInstance.pause();
            await expect(aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1)).to.be.reverted;
            await aFiPassiveRebalanceInstance.unPause();

            await expect(aFiPassiveRebalanceInstance.connect(investor2).updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1)).to.be.revertedWith('Ownable: caller is not the owner');

            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1)

            const data = await aTokenConInstance.getProportions();
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
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);


            const swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
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
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const data1 = await aTokenConInstance.getProportions();
            expect(`${data1[2]}`).to.equal(`${data[2]}`);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('deposits when rebalPeriod reached, it should rebalance to zero strategy as default', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const currentTime = await time.latest();
            console.log(`${currentTime}`)

            const two_Week = 14 * 24 * 60 * 60;

            await time.increase(two_Week);

            const depositAmount = 100000000;

            const currentTimeLater = await time.latest();
            console.log(`${currentTimeLater}`)

            const strat = await aFiPassiveRebalanceInstance.getRebalStrategyNumber(aTokenConInstance.address);
            console.log("current strategy:", `${strat}`);

            const data = await aTokenConInstance.getProportions();

            if (`${currentTimeLater}` > `${currentTime}`) {
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
                await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);


                const swapParams = {
                    afiContract: aTokenConInstance.address,
                    oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    cSwapFee: 1000000,
                    cSwapCounter: 2,
                    depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                    minimumReturnAmount: [0, 0, 0, 0, 0],
                    iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                    underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                        "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                        "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                    newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                    _deadline: deadline,
                    cometToClaim: [],
                    cometRewardTokens: [],
                    rewardTokenMinReturnAmounts: []
                };
                await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

                await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);




                await aTokenConInstance.connect(investor1).deposit(
                    3000000000, usdtConInstance.address
                );

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





                //To check the profit distribution
                await aTokenConInstance.connect(investor1).withdraw(
                    ether(2), usdtConInstance.address, deadline, returnString, 3, 0
                );

                const data1 = await aTokenConInstance.getProportions();

                console.log(`${data[2]}`, `${data1[2]}`)

                expect(`${data1[2]}`).to.equal(
                    `${data[2]}`,
                    'rebalTime not changed',
                );
            } else {
                console.log("Time has increased");
            }
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('set Rebalanced strategy to 0 and it should rebal to zero strategy', async () => {

            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 0);
            const two_Week = 14 * 24 * 60 * 60;

            await time.increase(two_Week);

            const data = await aTokenConInstance.getProportions();
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
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);


            const swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 3,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const data3 = await aTokenConInstance.getProportions();
            expect(`${data3[2]}`).to.equal(
                `${data[2]}`,
                'rebalTime changed',
            );

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('set Rebalanced strategy to 1 and it should rebal to 1 strategy', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);
            const two_Week = 14 * 24 * 60 * 60;


            await time.increase(two_Week);
            const data = await aTokenConInstance.getProportions();

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
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);


            const swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 4,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const data1 = await aTokenConInstance.getProportions();

            expect(`${data1[2]}`).to.equal(
                `${data[2]}`,
                'rebalTime not changed',
            );

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('should apply rebal for proportions - 1', async () => {

            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
            await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
            await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
            await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            let swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 6,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            const Afterbal1 = await aTokenConInstance.balanceOf(
                investor1.address
            );
            const minimumReturnAmount = [0, 0, 0, 0, 0];
            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);


            await aTokenConInstance.connect(investor1).withdraw(
                Afterbal1, usdtConInstance.address, deadline, returnString, 3, 0
            );

        })

        it('should apply rebal for proportions - 2', async () => {

            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
            await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
            await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
            await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)
            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

            let getProportions = await aTokenConInstance.getProportions();
            console.log("getProportions", getProportions[0]);

            var swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
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
                newProviders: [2, 0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            await aTokenConInstance.connect(investor1).deposit(
                1000000000, usdtConInstance.address
            );

            swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
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
                newProviders: [2, 0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);
            const Afterbal1 = await aTokenConInstance.balanceOf(
                investor1.address
            );

            getProportions = await aTokenConInstance.getProportions();
            console.log("getProportions--------", getProportions[0]);

            const minimumReturnAmount = [0, 0, 0, 0, 0];
            const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
            const returnString = Amount.map(bn => bn.toString());

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);


            await aTokenConInstance.connect(investor1).withdraw(
                Afterbal1, usdtConInstance.address, deadline, returnString, 3, 0
            );

            aFiPassiveRebalanceInstance.connect(investor1).updateOracleData("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", "0xf4030086522a5beea4988f8ca5b36dbc97bee88c");
        })

        it('should return the correct pool address', async function () {
            // Call the getPool function
            const returnedPool = await aFiPassiveRebalanceInstance.getPool("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

            // Check if the returned pool address matches the created pool
            expect(returnedPool).to.equal("0xCBCdF9626bC03E24f779434178A73a0B4bad62eD");
        });
    });
});