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

describe('AFi Product 101', (accounts) => {
    let platformWallet; let recipient; let investor1; let investor2; let investor3;
    let deadline;
    let deployedAFiBase;
    let aTokenConInstance;

    // eslint-disable-next-line no-unused-vars
    let daiConInstance;
    let usdcConInstance;
    let usdtConInstance;
    let linkConInstance;
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
        aFiBaseInstace = await AFiBase.deploy("AFiBase", "AFi");
        aFiManagerInstance = await AFiManager.deploy();
        aFiPassiveRebalanceInstance = await PassiveRebalanceStrategies.deploy();
        aFiAFiOracleInstance = await AFiOracle.deploy(aFiPassiveRebalanceInstance.address);

        aFiFactoryInstance = await AFiFacotry.deploy(aFiBaseInstace.address);

        aFiStorageInstance = await AFiStorage.deploy(aFiManagerInstance.address,
            aFiAFiOracleInstance.address,
            aFiPassiveRebalanceInstance.address,
            aFiFactoryInstance.address
        );
        console.log("print the address of the aFiFactoryInstance", aFiFactoryInstance.address);

        const payload = [
            [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
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

        deployedAFiBase = await aFiFactoryInstance.aFiProducts(0)

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);

        await aFiPassiveRebalanceInstance.intializeStalePriceDelay(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // underlying - MATIC
                "0x111111111117dc0aa78b770fa6a738034120c302",  // 1INCH
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"  // ENS
            ], [
            84600,
            84600,
            84600,
            84600,
            84600,
            84600
        ]
        )

        await aFiPassiveRebalanceInstance.setPriceOracle(
            [
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            ],
            [
            ],
            [
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
            ], // USDT, USDC - chainlink oracles
            [
            ],
        );

        await aFiPassiveRebalanceInstance.setPriceOracle(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F"
            ],
            [
            ],
            [
                "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
                "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
                "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
            ], // USDT, USDC - chainlink oracles
            [
            ],
        );

        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        await aFiPassiveRebalanceInstance.updateMidToken(
            [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",  // mkr
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6b175474e89094c44da98b954eedeac495271d0f"
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT  USDT - Pool 
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ]
        );

        const poolPayload = [
            [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x2519042aa735eDb4688a8376d69D4BB69431206c",  // pool WBTC - WETH
                "0x77843EA21a4cC006766bBa8BDeFd934cBeA20f4a",  // pool WETH - WETH
                "0x6127cC12B45b7A765D6509e191D23Ca97Badd8d1",  // pool UNI - WETH
                "0x92560C178cE069CC014138eD3C2F5221Ba71f58a",
                "0xe8c6c9227491C0a8156A0106A0204d881BB7E531"

            ],
            [
                "0x2519042aa735eDb4688a8376d69D4BB69431206c",  // pool WBTC - WETH
                "0x77843EA21a4cC006766bBa8BDeFd934cBeA20f4a",  // pool WETH - WETH
                "0x6127cC12B45b7A765D6509e191D23Ca97Badd8d1",   // pool UNI - WETH  special case man
                "0x92560C178cE069CC014138eD3C2F5221Ba71f58a",
                "0xe8c6c9227491C0a8156A0106A0204d881BB7E531"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)  change usdt-weth
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
        await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);

        await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
        await aTokenConInstance.setMinDepLimit(100);
        // // Transfer all AFinance Tokens to PLATFORM_WALLET
        // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

        // MAINNET CONTRACT INSTANCES
        daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
        usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
        usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);
        linkConInstance = await ethers.getContractAt(DAI_ABI, "0x514910771AF9Ca656af840dff83E8264EcF986CA");
        rebalToken = await ethers.getContractAt(DAI_ABI, "0x58b6a8a3302369daec383334672404ee733ab239");



        const accountToInpersonate = "0x9E4E147d103deF9e98462884E7Ce06385f8aC540"
        const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [accountToInpersonate],
        });
        const signer = await ethers.getSigner(accountToInpersonate)

        const accountToInpersonate2 = "0x0757e27AC1631beEB37eeD3270cc6301dD3D57D4"

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [accountToInpersonate2],
        });
        const signer2 = await ethers.getSigner(accountToInpersonate2)


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
        await usdtConInstance.connect(signer).transfer(investor1.address, "17310149508");
        await usdtConInstance.connect(signer).transfer(investor2.address, "17310149508");


        var linkBal = await linkConInstance.balanceOf(accountToInpersonate2);
        console.log("linkBal", linkBal)

        await linkConInstance.connect(signer2).transfer(investor1.address, linkBal);


        // await aFiPassiveRebalanceInstance.setAFiOracle(aFiAFiOracleInstance.address);
        await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
        await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);
        await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
        await aFiManagerInstance.setRebalanceController(investor1.address);

        await aFiPassiveRebalanceInstance.updateGlobalFees([usdtConInstance.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", usdtConInstance.address], [usdcConInstance.address, usdtConInstance.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], [10000, 10000, 10000]);
    })

    it("rebalancing by AR1 and reinitalization of vault", async () => {
        const beforeUSDTDep = await usdtConInstance.balanceOf(investor1.address)
        console.log("before Deposit user usdt balance", `${beforeUSDTDep}`);
        console.log("check --1")

        await aTokenConInstance.connect(investor1).deposit(
            1000000000, usdcConInstance.address
        );

        let AfterusdtBalance1 = await usdtConInstance.balanceOf(investor1.address);
        console.log("After Deposit user usdt balance", `${AfterusdtBalance1}`);

        const nav1 = await aTokenConInstance.depositUserNav(investor1.address);
        console.log("user nav1", `${nav1}`);

        const NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
        console.log("Nav from storage", `${NavfromStorage}`);

        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

        let swapParams = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 0,
            depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
            minimumReturnAmount: [0, 0, 0, 0, 0],
            iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
            underlyingTokens: [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
            cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
            rewardTokenMinReturnAmounts: [0]
        };

        poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
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

        const AfterwithusdcBalance = await usdcConInstance.balanceOf(investor1.address)
        console.log("Before withdraw user usdt balance", `${AfterwithusdcBalance}`)

        const checkAmount = await aTokenConInstance.balanceOf(investor1.address);
        console.log("checkAmount user usdt balance", `${checkAmount}`)

        const poolPayload = [
            [
                "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // underlying - MATIC
                "0xd533a949740bb3306d119cc777fa900ba034cd52", // CRV
                "0x111111111117dc0aa78b770fa6a738034120c302",  // 1INCH
                "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", // SHIB
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"  // ENS
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x290A6a7460B308ee3F19023D2D00dE604bcf5B42",  // pool WBTC - WETH
                "0x919Fa96e88d67499339577Fa202345436bcDaf79",  // pool WETH - WETH
                "0xd35EFAE4097d005720608Eaf37E42a5936C94B44",  // pool UNI - WETH
                "0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec",
                "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"

            ],
            [
                "0x290A6a7460B308ee3F19023D2D00dE604bcf5B42",  // pool WBTC - WETH
                "0x919Fa96e88d67499339577Fa202345436bcDaf79",  // pool WETH - WETH
                "0xd35EFAE4097d005720608Eaf37E42a5936C94B44",   // pool UNI - WETH  special case man
                "0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec",
                "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)  change usdt-weth
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
        const oraclePayload = [
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
        ];


        swapParams = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 0,
            depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
            minimumReturnAmount: [0, 0, 0, 0, 0],
            iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
            underlyingTokens: [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
            cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
            rewardTokenMinReturnAmounts: [0]
        };

        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).rebalanceUnderlyingTokens(
            [aTokenConInstance.address,
            aFiStorageInstance.address,
                unipooldata,
                oraclePayload,
            [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            usdtConInstance.address,
                0,
                1000,
                deadline,
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0]],
            swapParams,
            oneInchParam,
            0, 0
        );

        let check = await aTokenConInstance.getProportions();
        console.log("check", check[0]);

        let check1 = await aTokenConInstance.getUTokens();
        console.log("check", check1);



        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(false);

        await aTokenConInstance.connect(investor1).deposit(
            1000000000, usdcConInstance.address
        );
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).algoRebalance2(
            aTokenConInstance.address,
            aFiStorageInstance.address,
            "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
            [2500000, 2500000, 2500000, 2500000],
            usdtConInstance.address,
            deadline,
            0,
            "0x"
        );

        console.log("rebala2 second time");

        var swapParams2 = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 0,
            depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
            minimumReturnAmount: [0, 0, 0, 0, 0],
            iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
            underlyingTokens: [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            newProviders: [0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: [],
            cometRewardTokens: [],
            rewardTokenMinReturnAmounts: []
        };

        poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams2, 0, oneInchParam, "0x", 0);

        const rebalTokenBalance = await rebalToken.balanceOf(aTokenConInstance.address);
        console.log("ballllllllllllllllllllllllllllllllllllllllll", rebalTokenBalance);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).algoRebalance2(
            aTokenConInstance.address,
            aFiStorageInstance.address,
            "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0",
            [2500000, 2500000, 5000000],
            usdtConInstance.address,
            deadline,
            0,
            "0x"
        );
        check = await aTokenConInstance.getProportions();
        console.log("proportion222222", check);

        check1 = await aTokenConInstance.getUTokens();
        console.log("after rebal 2", check1);

        console.log("rebala2 third time");
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).algoRebalance2(
            aTokenConInstance.address,
            aFiStorageInstance.address,
            "0xd533a949740bb3306d119cc777fa900ba034cd52",
            [5000000, 5000000],
            usdtConInstance.address,
            deadline,
            0,
            "0x"
        );

        console.log("rebala2 forth time");
        check = await aTokenConInstance.getProportions();
        console.log("proportion 3333", check);

        check1 = await aTokenConInstance.getUTokens();
        console.log("after rebal 2", check1);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).algoRebalance2(
            aTokenConInstance.address,
            aFiStorageInstance.address,
            "0x111111111117dc0aa78b770fa6a738034120c302",
            [10000000],
            usdtConInstance.address,
            deadline,
            0,
            "0x"
        );
        check = await aTokenConInstance.getProportions();
        console.log("proportion 44444", check);

        check1 = await aTokenConInstance.getUTokens();
        console.log("after rebal 2", check1);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).algoRebalance2(
            aTokenConInstance.address,
            aFiStorageInstance.address,
            "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
            [],
            usdtConInstance.address,
            deadline,
            0,
            "0x"
        );

        check = await aTokenConInstance.getProportions();
        console.log("proportion after rebals", check);

        check1 = await aTokenConInstance.getUTokens();
        console.log("after rebal 2", check1);

        let getcounter = await aTokenConInstance.getcSwapCounter();

        let predepositBalance = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, getcounter, usdtConInstance.address);
        console.log("check predeposit balance", predepositBalance);

        var navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
        console.log("Nav from storage after the rebalance 2", `${navfromStorage}`);

        poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
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

        // await aFiAFiOracleInstance.updateSecAgo(0);

        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

        await aFiManagerInstance.connect(investor1).reInitializeVault(
            aTokenConInstance.address,
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
            swapParams,
            oneInchParam
        );

        getcounter = await aTokenConInstance.getcSwapCounter();
        predepositBalance = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, getcounter - 1, usdtConInstance.address);
        console.log("check predeposit balance after reInitializeVault", predepositBalance);

        let usdtBalance = await usdtConInstance.balanceOf(aTokenConInstance.address);
        console.log("print usdt balance", usdtBalance);

        check = await aTokenConInstance.getProportions();
        console.log("after rebal 2 -----------------------------------", check[0]);

        check1 = await aTokenConInstance.getUTokens();
        console.log("after rebal 2 -----------------------------------", check1);

        // navfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
        // console.log("Nav from storage after the rebalance 1", `${navfromStorage}`);

        // swapParams = {
        //     afiContract: aTokenConInstance.address,
        //     oToken: usdtConInstance.address,
        //     cSwapFee: 1000000,
        //     cSwapCounter: 0,
        //     depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
        //     minimumReturnAmount: [0, 0, 0, 0, 0],
        //     iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
        //     underlyingTokens: [
        //         "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
        //         "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
        //         "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
        //         "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
        //         "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
        //     ], 
        //     newProviders: [0,0,0,0,0], // Fill this with the new providers' information
        //     _deadline: deadline,
        //     cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
        //     cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
        //     rewardTokenMinReturnAmounts: [0]
        // };

        // console.log("check --1")

        // await aTokenConInstance.connect(investor1).deposit(
        //     1000000000, usdtConInstance.address
        // );

        // console.log("check --2")

        // await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

        // console.log("check --3")

        // await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0);
    });

    it("rebalancing by AR1 and reinitalization of vault=========>", async () => {
        const beforeUSDTDep = await usdtConInstance.balanceOf(investor1.address)
        console.log("before Deposit user usdt balance", `${beforeUSDTDep}`);

        console.log("check --0")
        await aTokenConInstance.connect(investor1).deposit(
            1000000000, usdcConInstance.address
        );

        let AfterusdtBalance1 = await usdtConInstance.balanceOf(investor1.address);
        console.log("After Deposit user usdt balance", `${AfterusdtBalance1}`);

        const nav1 = await aTokenConInstance.depositUserNav(investor1.address);
        console.log("user nav1", `${nav1}`);

        const NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
        console.log("Nav from storage", `${NavfromStorage}`);

        await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

        let swapParams = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 0,
            depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
            minimumReturnAmount: [0, 0, 0, 0, 0],
            iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
            underlyingTokens: [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
            cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
            rewardTokenMinReturnAmounts: [0]
        };

        poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance.address);
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x", 0);

        const poolPayload = [
            [
                "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // underlying - MATIC
                "0xd533a949740bb3306d119cc777fa900ba034cd52", // CRV
                "0x111111111117dc0aa78b770fa6a738034120c302",  // 1INCH
                "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", // SHIB
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"  // ENS
            ],
            [
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ],
            [
                "0x290A6a7460B308ee3F19023D2D00dE604bcf5B42",  // pool WBTC - WETH
                "0x919Fa96e88d67499339577Fa202345436bcDaf79",  // pool WETH - WETH
                "0xd35EFAE4097d005720608Eaf37E42a5936C94B44",  // pool UNI - WETH
                "0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec",
                "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"

            ],
            [
                "0x290A6a7460B308ee3F19023D2D00dE604bcf5B42",  // pool WBTC - WETH
                "0x919Fa96e88d67499339577Fa202345436bcDaf79",  // pool WETH - WETH
                "0xd35EFAE4097d005720608Eaf37E42a5936C94B44",   // pool UNI - WETH  special case man
                "0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec",
                "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"

            ],
            [
                [[
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
                    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)  change usdt-weth
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
        const oraclePayload = [
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
        ];
        await aFiManagerInstance.setRebalanceController(investor1.address);

        swapParams = {
            afiContract: aTokenConInstance.address,
            oToken: usdtConInstance.address,
            cSwapFee: 1000000,
            cSwapCounter: 0,
            depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
            minimumReturnAmount: [0, 0, 0, 0, 0],
            iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
            underlyingTokens: [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: ["0xA17581A9E3356d9A858b789D68B4d866e593aE94"],
            cometRewardTokens: ["0xc00e94Cb662C3520282E6f5717214004A7f26888"],
            rewardTokenMinReturnAmounts: [0]
        };
        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).algoRebalance2(
            aTokenConInstance.address,
            aFiStorageInstance.address,
            "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
            [2500000, 2500000, 2500000, 2500000],
            usdtConInstance.address,
            deadline,
            0,
            "0x"
        );

        let getcounter = await aTokenConInstance.getcSwapCounter();
        let predepositBalance = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, getcounter, usdtConInstance.address);
        console.log("check predeposit before AR1======== balance", predepositBalance);

        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
        await aFiManagerInstance.connect(investor1).rebalanceUnderlyingTokens(
            [aTokenConInstance.address,
            aFiStorageInstance.address,
                unipooldata,
                oraclePayload,
            [
                "0x58b6a8a3302369daec383334672404ee733ab239", // underlying - LPT
                "0x0954906da0bf32d5479e25f46056d22f08464cab", // index
                "0xc221b7e65ffc80de234bbb6667abdd46593d34f0",  // wcfg
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", // ens
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"  // mkr
            ],
            usdtConInstance.address,
                0,
                1000,
                deadline,
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0]],
            swapParams,
            oneInchParam,
            0, 0
        );
        getcounter = await aTokenConInstance.getcSwapCounter();
        predepositBalance = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, getcounter, usdtConInstance.address);
        console.log("check predeposit after AR1======== balance", predepositBalance);
        let usdtBalance = await usdtConInstance.balanceOf(aTokenConInstance.address);
        console.log("print usdt balance", usdtBalance);

    });
})  