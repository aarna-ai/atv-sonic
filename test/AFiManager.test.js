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

describe('AFiManager', (accounts) => {
    let platformWallet; let recipient; let investor1; let investor2; let investor3;
    let rebalanceController;
    let deadline;
    let deployedAFiBase;
    let aTokenConInstance;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    let snapshotId;
    let oneInchParam;

    before(async () => {


        oneInchParam = {
            firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
        }

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

        deployedAFiBase = await aFiFactoryInstance.aFiProducts(0)


        //let txObject = await result.wait()

        //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);
        //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));

        aFiPassiveRebalanceInstance.intializeStalePriceDelay([
            "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
            "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
            "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
            "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // Aave
            "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL

        ], [
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500,
            86500
        ])

        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
        await aFiManagerInstance.setRebalanceController(rebalanceController.address);
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

        // MAINNET CONTRACT INSTANCES
        daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

        const accountToImpersonate = "0x54edC2D90BBfE50526E333c7FfEaD3B0F22D39F0"
        const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [accountToImpersonate],
        });
        const signer = await ethers.getSigner(accountToImpersonate)

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

        const daiBalance = await daiConInstance.balanceOf(accountToImpersonate)
        console.log("whale dai balance", daiBalance / 1e18)
        console.log("transfering to", accountToFund)

        await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

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
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
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
                "0x4ffc43a60e009b551865a93d232e33fce9f01507",
                "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
            ],
        );

        await aTokenConInstance.setplatformWallet(platformWallet.address);

        // await daiConInstance.connect(signer).transfer(investor1.address, daiBalance);

        // const accountBalance = await daiConInstance.balanceOf(investor1.address)
        // console.log("transfer complete")
        // console.log("funded account balance", accountBalance / 1e18)

        var usdtBalance = await usdtConInstance.balanceOf(accountToImpersonate);
        let usdcBalance = await usdcConInstance.balanceOf(accountToImpersonate);

        await usdcConInstance.connect(signer).transfer(investor1.address, usdcBalance);
        console.log("usdcBalance", usdcBalance);

        console.log("usdtBalance", usdtBalance)
        usdtBalance = usdtBalance / 3;
        console.log("usdtBalance", usdtBalance)
        await usdtConInstance.connect(signer).transfer(investor1.address, "50000957569");
        await usdtConInstance.connect(signer).transfer(investor2.address, "50000957569");

        const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
        await aTokenConInstance.setMinDepLimit(100);
        console.log("transfer complete")
        console.log("funded account balance usdttttttttt", investorusdtBalance)
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        await aFiPassiveRebalanceInstance.updatePreSwapDepositLimit(100000000000000000000n);

    });

    describe('Basic checks for deposit and withdraw', () => {

        it('reverts when invoked by non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const newTeamWallet = investor2.address;

            await expect(aFiManagerInstance.connect(newTeamWallet).addTeamWalletInAFi(
                aFiStorageInstance.address,
                aTokenConInstance.address,
                newTeamWallet
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('unpause the contract', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            // when manager contract is not already paused
            await expect(aFiManagerInstance.unPause()).to.be.reverted;

            await aFiManagerInstance.pause();
            await aFiManagerInstance.connect(platformWallet).unPause();
            expect((await aFiManagerInstance.getPauseStatus())).to.equal(false);
            await aFiManagerInstance.pause();
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('pause the contract from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            // when manager contract is not already paused
            await expect(aFiManagerInstance.connect(investor1).pause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('pause and unpause the contract from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.pause();
            console.log("pause done");
            await expect(aFiManagerInstance.connect(investor1).unPause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('pause the contract when it is already paused', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.pause();
            // when manager contract is already paused
            await expect(aFiManagerInstance.connect(investor1).pause()).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('withdraw from pools', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');





            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );
            await aFiManagerInstance.withdrawFromPool(aFiStorageInstance.address, aTokenConInstance.address, "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599");
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('withdraw from pools revert when called from non owner', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await expect(aFiManagerInstance.connect(investor1).withdrawFromPool(aFiStorageInstance.address, aTokenConInstance.address, "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599")).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('withdraw from pools revert when vault is paused', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.pause();
            await expect(aFiManagerInstance.withdrawFromPool(aFiStorageInstance.address, aTokenConInstance.address, "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599")).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('reverts when newTeamWallet address is zero address', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await expect(
                aFiManagerInstance.addTeamWalletInAFi(
                    aFiStorageInstance.address,
                    aTokenConInstance.address,
                    constants.ZERO_ADDRESS
                )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('reverts when trying to add a wallet in paused vault', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.pause();
            await expect(
                aFiManagerInstance.addTeamWalletInAFi(
                    aFiStorageInstance.address,
                    aTokenConInstance.address,
                    constants.ZERO_ADDRESS
                )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('reverts when trying to add a wallet from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await expect(
                aFiManagerInstance.connect(investor1).addTeamWalletInAFi(
                    aFiStorageInstance.address,
                    aTokenConInstance.address,
                    constants.ZERO_ADDRESS
                )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('reverts when trying to add an existing team wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const firstTeamWallet = investor2.address;
            await expect(
                aFiManagerInstance.addTeamWalletInAFi(
                    aFiStorageInstance.address,
                    aTokenConInstance.address,
                    firstTeamWallet
                )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('adds newTeamWallet successfully', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const newTeamWallet = investor3.address;
            const teamWalletBefore = await aFiStorageInstance.getTeamWalletsOfAFi(aTokenConInstance.address);
            await aFiManagerInstance.addTeamWalletInAFi(
                aFiStorageInstance.address,
                aTokenConInstance.address,
                newTeamWallet
            );

            const teamWalletAfter = await aFiStorageInstance.getTeamWalletsOfAFi(aTokenConInstance.address);
            console.log(`${teamWalletBefore}`);
            console.log(`${teamWalletAfter}`);
            expect(teamWalletAfter.length).to.greaterThan(teamWalletBefore.length);
            expect(teamWalletAfter[teamWalletAfter.length - 1]).to.equal(newTeamWallet);
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('after adding a new team wallet teamWallets length is 2', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            expect(
                (await aFiStorageInstance.getTeamWalletsOfAFi(aTokenConInstance.address)).length,
                2,
                'Team wallets length do not match',
            );
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('check the active status of team wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiStorageInstance.deactivateTeamWallet(
                aTokenConInstance.address, investor1.address
            );

            const deactivated = false;
            const { isPresent, isActive } = await aFiStorageInstance.getTeamWalletDetails(
                aTokenConInstance.address, investor1.address);
            console.log(" isPresent isActive ", `${isPresent}`, `${isActive}`);
            expect(isActive).to.equal(deactivated);
            await ethers.provider.send('evm_revert', [snapshotId]);

        })

        it('check the active status of team wallet after reactivate', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiStorageInstance.deactivateTeamWallet(
                aTokenConInstance.address, investor1.address
            );
            await aFiStorageInstance.reActivateTeamWallet(
                aTokenConInstance.address, investor1.address
            );

            const reactivated = true;
            const { isPresent, isActive } = await aFiStorageInstance.getTeamWalletDetails(
                aTokenConInstance.address, investor1.address);
            console.log(" isPresent isActive ", `${isPresent}`, `${isActive}`);
            expect(isActive).to.equal(reactivated);
            await ethers.provider.send('evm_revert', [snapshotId]);

        })

        it('reverts when previous and new active status are the same ', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await expect(
                aFiStorageInstance.reActivateTeamWallet(
                    aTokenConInstance.address, investor2.address
                )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('afi active status are the same', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.setActiveRebalStatus(
                aFiStorageInstance.address, aTokenConInstance.address, false
            )
            const status = await aFiStorageInstance.isAFiActiveRebalanced(aTokenConInstance.address);
            expect(status).to.equal(false);
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('afi active status when contract is paused', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.pause();
            await expect(aFiManagerInstance.setActiveRebalStatus(
                aFiStorageInstance.address, aTokenConInstance.address, false
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('afi active status from a non owner wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await expect(aFiManagerInstance.connect(investor1).setActiveRebalStatus(
                aFiStorageInstance.address, aTokenConInstance.address, false
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('reverts when scenario is greater than 3', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const uniPayload = [[
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
                "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
                ]], [[
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp **", res);


            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            console.log("uTokProp------------------------");

            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    4,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
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
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        })

        it('reverts when calling rebalance from a non rebalanceController wallet', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await expect(aFiManagerInstance.connect(investor1).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
                0,
                "0x",
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ]
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('reverts when calling rebalance on paused vault', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);
            await aFiManagerInstance.pause();
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
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
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('reverts when calling rebalance when vault is not to active rebalance', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.setActiveRebalStatus(
                aFiStorageInstance.address, aTokenConInstance.address, false
            )

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

            var res = await aTokenConInstance.getProportions();


            const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);



            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
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
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        })

        it('reverts when array length mismatched', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    3,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
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
            )).to.be.reverted;

            await ethers.provider.send('evm_revert', [snapshotId]);

        })

        it('reverts when proportion is not equal to zero', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

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
                ["100"],
                [
                    "0x0000000000000000000000000000000000000000"
                ],
                2,
            ]

            const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    4,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
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
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        })

        it('scenario 1 testing inmanager when stable token is usdt', async () => {
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            // await aFiManagerInstance.setRebalFee(500);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
                0,
                10,
                "0x",
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ]
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav after rebalance", `${checkNav}`);

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);

            // getCPafterRebalance = await aFiManagerInstance.getUTokenProportion(aTokenConInstance.address, aFiStorageInstance.address);
            // console.log("after rebalance the current proprtion", getCPafterRebalance);


            res = await aTokenConInstance.getProportions();
            console.log("after rebalance the default proprtion", res[1]);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('scenario 1 testing inmanager when stable token is usdc', async () => {
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    usdcConInstance.address,
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    1
                ],
                deadline,
                [0, 0, 0, 0, 0],
                0,
                100,
                "0x",
                [
                    "0x",
                    "0x",
                    "0x",
                    "0x",
                    "0x"
                ]
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav after rebalance", `${checkNav}`);

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('scenario 1 testing inmanager when stable token is DAI', async () => {
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    daiConInstance.address,
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    2
                ],
                deadline,
                [0, 0, 0, 0, 0],
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


            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("check nav after rebalance", `${checkNav}`);

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('scenario 2 testing inmanager when stable token is USDT', async () => {

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
            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0],
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after rebalance", `${NavfromStorage}`);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('scenario 2 testing inmanager when stable token is USDC', async () => {

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
            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    usdcConInstance.address,
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    1
                ],
                deadline,
                [0],
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('scenario 2 testing inmanager when stable token is DAI', async () => {

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
            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    daiConInstance.address,
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    2
                ],
                deadline,
                [0],
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after rebalance", `${NavfromStorage}`);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('scenario 1 testing inmanager with rebal strategy 1 when stable token is USDT', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp **", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0],
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after rebalance", `${NavfromStorage}`);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('scenario 1 testing inmanager with rebal strategy 1 when the stable token is USDC', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    usdcConInstance.address,
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    1
                ],
                deadline,
                [0, 0, 0, 0, 0],
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after rebalance", `${NavfromStorage}`);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('scenario 1 testing inmanager with rebal strategy 1 when stable token is DAI', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    daiConInstance.address,
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    1,
                    [],
                    res[0],
                    res[1],
                    2,
                    2
                ],
                deadline,
                [0, 0, 0, 0, 0],
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

            res = await aTokenConInstance.getUTokens();
            console.log("uTokProp", res);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after rebalance", `${NavfromStorage}`);

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('deposit and withdraw after rebalance scenarios', async () => {
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

            let swapParams = {
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
            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ]
            );
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0],
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

            let underlyingTok = await aTokenConInstance.getUTokens();
            console.log("uTokProp", underlyingTok);
            res = await aTokenConInstance.getProportions();
            console.log("after rebalance theproprtion", res);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after rebalance", `${NavfromStorage}`);

            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after deposit", `${NavfromStorage}`);

            swapParams = {
                afiContract: aTokenConInstance.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 1,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: underlyingTok,  // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };
            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after cswap", `${NavfromStorage}`);




            await aTokenConInstance.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );




            await aTokenConInstance.connect(investor1).withdraw(
                ether(2), usdtConInstance.address, deadline, returnString, 4, 0
            );

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("Nav from storage after withdraw", `${NavfromStorage}`);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('rebalance revert when there is zero token balance that needs to be removed', async () => {
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0, 0],
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
            )).to.be.revertedWith('AM20');
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('rebalance validations revert when length mismatch', async () => {
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
                ["0", "0"],
                [
                    "0x0000000000000000000000000000000000000000"
                ],
                2,
            ]

            const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0, 0],
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
            )).to.be.revertedWith('AFM05');
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('rebalance validations revert when new underlying proportion is not zero', async () => {
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
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
                "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
                ]], [[
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
                ["10"],
                [
                    "0x0000000000000000000000000000000000000000"
                ],
                2,
            ]

            const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0, 0],
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
            )).to.be.revertedWith('AM11');
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('rebalance validations revert newUtoken is not same as encoded 0 index underlying token', async () => {
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
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
                "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
            ],
            [
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
                ]], [[
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
            const encodedUniPayload = await aFiPassiveRebalanceInstance.encodePoolData(uniPayload);
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], encodedUniPayload)

            const newUToken = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
            const payload = [
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
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



            var res = await aTokenConInstance.getProportions();
            console.log("uTokProp", res);

            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await expect(aFiManagerInstance.connect(rebalanceController).rebalance(
                bytesData,
                [
                    aTokenConInstance.address,
                    aFiStorageInstance.address,
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    newUToken,
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
                    2,
                    [],
                    res[0],
                    res[1],
                    2,
                    0
                ],
                deadline,
                [0, 0, 0, 0, 0, 0],
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
            )).to.be.revertedWith('AM002');
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it("should set the rebal fee within the limits by the owner", async function () {
            await aFiManagerInstance.setRebalFee(5000000000000000);
            const rebalFee = await aFiManagerInstance.rebalfee();
            expect(rebalFee).to.equal(5000000000000000);
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it("should fail to set the rebal fee if above the upper limit", async function () {
            await expect(
                aFiManagerInstance.setRebalFee(60000000000000000000000000n)
            ).to.be.revertedWith("AFM19");
        });

        it("should fail to set the rebal fee if not the owner", async function () {
            await expect(
                aFiManagerInstance.connect(investor2).setRebalFee(60000000000000000000000n)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        // it("should revert with 'NA' if caller is not the rebalancing address", async function () {
        //     await aFiManagerInstance.connect(investor2).getUTokenProportion(aTokenConInstance.address, aTokenConInstance.address);
        // });

        it("should revert with the correct error message if not called by rebalance controller", async function () {
            // Assume rebalFeeContract is already deployed and initialized

            const newStableUnitsInUSD = 1000;

            // Trying to call updateStableUnitsInUSD from an address that is not the rebalance controller
            await expect(
                aFiManagerInstance.connect(investor2).updateStableUnitsInUSD(newStableUnitsInUSD)
            ).to.be.revertedWith("AM002");
        });

        it('emergency rebalance revert when called from non owner wallet', async () => {

            snapshotId = await ethers.provider.send('evm_snapshot');

            await expect(aFiManagerInstance.connect(investor2).emergencyRebalance(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000]
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('emergency rebalance revert when contract is paused', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await aFiManagerInstance.pause();
            await expect(aFiManagerInstance.emergencyRebalance(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000]
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('emergency rebalance revert when length of uTokens and proportion mismatches', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await expect(aFiManagerInstance.emergencyRebalance(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000]
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('passiveRebal application', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            await expect(aFiManagerInstance.connect(investor1).setafiOracleContract(aFiAFiOracleInstance.address)).to.be.reverted;

            await aFiPassiveRebalanceInstance.updateRebalStrategyNumberByOwner(aTokenConInstance.address, 1);

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

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('setRebalanceController only by owner and should not be 0 address', async () => {

            await expect(aFiManagerInstance.connect(recipient).setRebalanceController(investor1.address)).to.be.revertedWith('Ownable: caller is not the owner');

            await expect(aFiManagerInstance.setRebalanceController(ZERO_ADDRESS)).to.be.revertedWith('AM04');
        });

        it('emergency withdraw', async () => {

            var staleBal = await usdtConInstance.balanceOf(investor1.address);
            console.log("usdt balance of user before deposit ", `${staleBal}`);




            await aTokenConInstance.connect(investor2).deposit(
                1000000000, usdtConInstance.address
            );

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);


            await aTokenConInstance.connect(investor2).deposit(
                1000000000, usdtConInstance.address
            );

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

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
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);


            await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("After 2nd deposit nav from storage value", `${NavfromStorage}`);

            await aFiManagerInstance.pause();

            await expect(aFiManagerInstance.emergencyRebalance(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000]
            )).to.be.revertedWith("AFM03");

            await aFiManagerInstance.unPause();

            await expect(aFiManagerInstance.connect(investor1).emergencyRebalance(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000]
            )).to.be.reverted;

            await aFiManagerInstance.emergencyRebalance(
                aTokenConInstance.address,
                aFiStorageInstance.address,
                "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                [2500000, 2500000, 2500000, 2500000]
            );

            NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
            console.log("After emeregency rebalance nav from storage value", `${NavfromStorage}`);

            var uTokenProp2 = await aTokenConInstance.getProportions();
            console.log("uTokenProp", `${uTokenProp2[0]}`);

            var utokensafter = await aTokenConInstance.getUTokens();
            console.log(utokensafter);

            const linkTokenInstance = await ethers.getContractAt(DAI_ABI, "0x514910771AF9Ca656af840dff83E8264EcF986CA");

            var staleBal = await linkTokenInstance.balanceOf(aTokenConInstance.address);
            console.log("staleBal = ", `${staleBal}`);

            await aTokenConInstance.emergencyWithdraw(linkTokenInstance.address, platformWallet.address);

            staleBal = await daiConInstance.balanceOf(platformWallet.address);
            console.log("staleBal after emergency withdraw = ", `${staleBal}`);
        });

    });

    describe('ALGO', async () => {
        let snapshotId;
        let aTokenConInstance1;
        let oneInchParam;

        before(async () => {

            oneInchParam = {
                firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
                secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
            }
            await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
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
                3
            ]

            const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

            result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
                aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

            deployedAFiBase = await aFiFactoryInstance.aFiProducts(1)

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


            //let txObject = await result.wait()

            //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);

            aTokenConInstance1 = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);
            //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));
            await aTokenConInstance1.setplatformWallet(platformWallet.address);
            await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
                "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0xc00e94Cb662C3520282E6f5717214004A7f26888", // Comp
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // Aave
                "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV
                "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL

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
                86500,
                86500
            ])
            await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);

            // // Transfer all AFinance Tokens to PLATFORM_WALLET
            // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

            // MAINNET CONTRACT INSTANCES
            daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
            usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
            usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

            const accountToImpersonate = "0x9E4E147d103deF9e98462884E7Ce06385f8aC540"
            const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [accountToImpersonate],
            });
            const signer = await ethers.getSigner(accountToImpersonate);

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

            const daiBalance = await daiConInstance.balanceOf(accountToImpersonate)
            console.log("whale dai balance", daiBalance / 1e18)
            console.log("transfering to", accountToFund)

            console.log("transfer complete")
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
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

            const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

            console.log("transfer completey")
            console.log("funded account balance usdttttttttt", investorusdtBalance)
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
            await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance1.address, investor1.address);
            await aFiManagerInstance.setRebalanceController(rebalanceController.address);
            await aFiPassiveRebalanceInstance.updatePreSwapDepositLimit(100000000000000000000n);
            await aTokenConInstance1.setMinDepLimit(100);
            await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        });

        it('revert algo rebalance when called from non rebalanceController', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                //"0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                //"0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
            ];

            const payload = [[
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
            ]
            const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);

            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"

                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
                ]
            );

            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    //"0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        //"0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]], [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        //"0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        //"0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 0, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
            await expect(aFiManagerInstance.connect(investor1).rebalanceUnderlyingTokens(
                [aTokenConInstance1.address,
                aFiStorageInstance.address,
                    unipooldata1,
                    oraclePayload,
                [],
                usdtConInstance.address,
                    0,
                    1000,
                    deadline,
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0]],
                // swapParams,
                // oneInchParam,
                // 0, 0
            )).to.be.reverted;
            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('revert algo rebalance when paused', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                //"0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                //"0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
            ];

            const payload = [[
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
            ]
            const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);

            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"

                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
                ]
            );

            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    //"0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        //"0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]], [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        //"0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        //"0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 1, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);
            await aFiManagerInstance.pause();
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

            console.log("pause done")

            var swapParams = {
                afiContract: aTokenConInstance1.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA"
                ],
                newProviders: [0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            await expect(aFiManagerInstance.connect(rebalanceController).rebalanceUnderlyingTokens(
                [aTokenConInstance.address,
                aFiStorageInstance.address,
                    unipooldata1,
                    oraclePayload,
                [],
                usdtConInstance.address,
                    0,
                    1000,
                    deadline,
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0]],
                swapParams,
                oneInchParam,
                0, 0
            )).to.be.revertedWith('AFM03');

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('revert algo rebalance when more than 10 new underlying tokens', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');

            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
            ];
            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        //"0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]], [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        //"0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        //"0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

            var swapParams = {
                afiContract: aTokenConInstance1.address,
                oToken: usdtConInstance.address,
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA"
                ],
                newProviders: [0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            await expect(aFiManagerInstance.connect(rebalanceController).rebalanceUnderlyingTokens(
                [aTokenConInstance1.address,
                aFiStorageInstance.address,
                    unipooldata1,
                    oraclePayload,
                [],
                usdtConInstance.address,
                    0,
                    1000,
                    deadline,
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0]],
                swapParams,
                oneInchParam,
                0, 0
            )).to.be.revertedWith('AFM19');

            await ethers.provider.send('evm_revert', [snapshotId]);

        });

        it('Algo product testing after cumulative swap testing', async () => {
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
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            console.log("Heyy checkout ")

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(false);


            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            console.log("00000000000000000000000000000000000000");

            await aTokenConInstance1.setMinDepLimit(100);

            await aTokenConInstance1.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            console.log("00000000000000000007y77770000000000000000000");


            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            await aTokenConInstance1.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)

            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

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

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            await aTokenConInstance1.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );


            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                //"0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                //"0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
            ];

            const payload = [[
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
            ]
            const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);

            let managerF = await usdtConInstance.balanceOf(investor1.address);
            console.log("before first rebal", `${managerF}`);

            let pool = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address
            );
            console.log("Nav before rebal", `${pool}`);

            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"

                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
                ]
            );

            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    //"0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        //"0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]], [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        //"0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        //"0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 0, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('Algo product testing', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            console.log("checkkkkkkkk");

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(false);


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
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            console.log("Heyy checkout ")

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            await aTokenConInstance1.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            await aTokenConInstance1.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)

            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

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

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);


            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                //"0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                //"0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
            ];

            const payload = [[
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
            ],
            [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]], [[
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
            ]
            const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);

            let managerF = await usdtConInstance.balanceOf(investor1.address);
            console.log("before first rebal", `${managerF}`);

            let pool = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address
            );
            console.log("Nav before rebal", `${pool}`);

            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"

                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
                ]
            );

            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    //"0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        //"0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]], [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        //"0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        //"0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            console.log("1. ..........................................");

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 1, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);

            var swapParams2 = {
                afiContract: aTokenConInstance1.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA",
                ],
                newProviders: [0, 0, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };


            console.log("2. ..........................................");
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
            await aFiManagerInstance.connect(rebalanceController).rebalanceUnderlyingTokens(
                [
                    aTokenConInstance1.address,
                    aFiStorageInstance.address,
                    unipooldata1,
                    oraclePayload,
                    [],
                    usdtConInstance.address,
                    0,
                    0,
                    deadline,
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0]
                ],
                swapParams2,
                oneInchParam,
                0, 0
            );

            console.log("3. ..........................................");

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            console.log("4. ..........................................");


            console.log("5. ..........................................");
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(false);

            await aTokenConInstance1.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            console.log("6. ..........................................");


            const check = await aTokenConInstance1.getProportions();
            console.log("check", check[0]);

            let check1 = await aTokenConInstance1.getUTokens();
            console.log("check", check1);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('Algo product testing for same old underlying length', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(false);

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
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            console.log("Heyy checkout ")

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            await aTokenConInstance1.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            await aTokenConInstance1.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);




            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)

            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            const swapParams = {
                afiContract: aTokenConInstance1.address,
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

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                //"0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
            ];

            const payload = [[
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
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
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
            ]
            const uDataPayload = await aFiPassiveRebalanceInstance.encodePoolData(payload);
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], uDataPayload)

            let managerF = await usdtConInstance.balanceOf(investor1.address);
            console.log("before first rebal", `${managerF}`);

            let pool = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address
            );
            console.log("Nav before rebal", `${pool}`);

            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"

                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
                ]
            );

            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    // "0xD533a949740bb3306d119CC777fa900bA034cd52"
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                        // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
                    ]], [[
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                        // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
                    ]],
                    [[
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
                        // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 2, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

            var swapParams2 = {
                afiContract: aTokenConInstance1.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
                ],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            await aFiManagerInstance.connect(rebalanceController).rebalanceUnderlyingTokens(
                [
                    aTokenConInstance1.address,
                    aFiStorageInstance.address,
                    unipooldata1,
                    oraclePayload,
                    [],
                    usdtConInstance.address,
                    0,
                    1000,
                    deadline,
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0]
                ],
                swapParams2,
                oneInchParam,
                0, 0
            );

            const check = await aTokenConInstance1.getProportions();
            console.log("check", check[0]);

            let check1 = await aTokenConInstance1.getUTokens();
            console.log("check", check1);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('Algo product testing for more than old underlying length', async () => {
            snapshotId = await ethers.provider.send('evm_snapshot');
            await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(false);


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
                    "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

                ],
                [
                    [[
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                        "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
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

            const accountBalance = await daiConInstance.balanceOf(investor1.address)
            console.log("transfer complete")
            console.log("funded account balance", accountBalance / 1e18)

            console.log("Heyy checkout ")

            const ether = (amount) => {
                const weiString = ethers.utils.parseEther(amount.toString());
                return BigNumber.from(weiString);
            };

            var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            await aTokenConInstance1.connect(investor1).deposit(
                3000000000, usdtConInstance.address
            );

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            await aTokenConInstance1.connect(investor1).deposit(
                1000000000, usdcConInstance.address
            );

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);




            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
            console.log("User NAVVVVV", `${nav2}`)

            let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
            console.log("after deposit usdtBalance", usdtBalance)

            await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

            checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
            console.log("check nav ", `${checkNav}`);

            const swapParams = {
                afiContract: aTokenConInstance1.address,
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

            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);
            await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

            poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

            const oraclePayload = [
                "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
                "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "0x553303d460ee0afb37edff9be42922d8ff63220e",
                "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
                "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
            ];

            const payload = [[
                "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
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
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                ]]
            ],
            [
                "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
            ]
            ]
            const uDataPayload = await aFiPassiveRebalanceInstance.encodePoolData(payload);
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], uDataPayload)

            let managerF = await usdtConInstance.balanceOf(investor1.address);
            console.log("before first rebal", `${managerF}`);

            let pool = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address
            );
            console.log("Nav before rebal", `${pool}`);

            await aFiPassiveRebalanceInstance.updateMidToken(
                [
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    "0xD533a949740bb3306d119CC777fa900bA034cd52"

                ],
                [
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
                ]
            );

            const poolPayload1 = [
                [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    "0xD533a949740bb3306d119CC777fa900bA034cd52"
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
                    "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    "0x919Fa96e88d67499339577Fa202345436bcDaf79",

                ],
                [
                    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
                    "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
                    "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
                    "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
                    "0x919Fa96e88d67499339577Fa202345436bcDaf79",

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
                        "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

                    ]]
                ],
                [
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
                    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
                    "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
                ]
            ]
            const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
            await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

            const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 3, aFiStorageInstance.address);
            await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);
            await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

            var swapParams2 = {
                afiContract: aTokenConInstance1.address,
                oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                cSwapFee: 1000000,
                cSwapCounter: 0,
                depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
                minimumReturnAmount: [0, 0, 0, 0, 0],
                iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
                underlyingTokens: [
                    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
                    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
                    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
                    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
                    "0xD533a949740bb3306d119CC777fa900bA034cd52"
                ],  // SOL], // Fill this array if your function expects specific tokens
                newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
                _deadline: deadline,
                cometToClaim: [],
                cometRewardTokens: [],
                rewardTokenMinReturnAmounts: []
            };

            await aFiManagerInstance.connect(rebalanceController).rebalanceUnderlyingTokens(
                [aTokenConInstance1.address,
                aFiStorageInstance.address,
                    unipooldata1,
                    oraclePayload,
                [],
                usdtConInstance.address,
                    0,
                    1000,
                    deadline,
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0]],
                swapParams2,
                oneInchParam,
                0, 0
            );

            const check = await aTokenConInstance1.getProportions();
            console.log("check", check[0]);

            let check1 = await aTokenConInstance1.getUTokens();
            console.log("check", check1);

            await ethers.provider.send('evm_revert', [snapshotId]);
        });
    });
});