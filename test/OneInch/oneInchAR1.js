/* eslint-disable no-underscore-dangle */
const { assert, expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { time, constants } = require("@openzeppelin/test-helpers");
const { provider } = waffle;
const swapTokens = require('./getOneInchData.js');
const swapTokens2 = require('./getOneInchData2.js');

const { abi: AFIBASE_ABI } = require('../../artifacts/contracts/AtvBase.sol/AtvBase.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../../utils/constants');
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

    beforeEach(async () => {
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
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72",
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
                "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"
            ],
            [
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
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
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
            ],
            [
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
            ],
            [
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
            ],
            ["2000000", "2000000", "2000000", "2000000", "2000000"],
            [
                "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
                "0x0000000000000000000000000000000000000000"
            ],
            3
        ]

        const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

        result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address, aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

        deployedAFiBase = await aFiFactoryInstance.aFiProducts(0)

        aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);

        await aFiPassiveRebalanceInstance.intializeStalePriceDelay(
            [
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72",
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
                "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"
            ], [
            84600,
            84600,
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
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72",
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
                "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "0x6b175474e89094c44da98b954eedeac495271d0f"
            ],
            [
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            ]
        );

        const poolPayload = [
            [
              "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
              "0xd533a949740bb3306d119cc777fa900ba034cd52",
              "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
            ],
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
            ],
            [
              "0x5ab53ee1d50eef2c1dd3d5402789cd27bb52c1bb",
              "0x919fa96e88d67499339577fa202345436bcdaf79",
              "0x7b1e5d984a43ee732de195628d20d05cfabc3cc7",
              "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
              "0x92560c178ce069cc014138ed3c2f5221ba71f58a"
            ],
            [
              "0x5ab53ee1d50eef2c1dd3d5402789cd27bb52c1bb",
              "0x919fa96e88d67499339577fa202345436bcdaf79",
              "0x7b1e5d984a43ee732de195628d20d05cfabc3cc7",
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x92560c178ce069cc014138ed3c2f5221ba71f58a"
            ],
            [
              [
                [
                  "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                  "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                  "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
                  "0x3416cf6c708da44db2624d63ea0aaef7113527c6",
                  "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36"
                ]
              ],
              [
                [
                  "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                  "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                  "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
                  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                  "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"
                ]
              ],
              [
                [
                  "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8",
                  "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8",
                  "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8",
                  "0x5777d92f208679db4b9778590fa3cab3ac9e2168",
                  "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8"
                ]
              ]
            ],
            [
              "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
              "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
              "0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8"
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



        const accountToInpersonate = "0x54edC2D90BBfE50526E333c7FfEaD3B0F22D39F0"
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
        await aFiPassiveRebalanceInstance.updatePreSwapDepositLimit(100000000000000000000n);

        await aFiPassiveRebalanceInstance.updateGlobalFees([usdtConInstance.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", usdtConInstance.address], [usdcConInstance.address, usdtConInstance.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], [10000, 10000, 10000]);
    })

    it("rebalancing by AR1 and reinitalization of vault", async () => {
        const beforeUSDTDep = await usdtConInstance.balanceOf(investor1.address)
        console.log("before Deposit user usdt balance", `${beforeUSDTDep}`);

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
            underlyingTokens:  [
                "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
                "0xd533a949740bb3306d119cc777fa900ba034cd52",
                "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
            ],
            newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: [],
            cometRewardTokens: [],
            rewardTokenMinReturnAmounts: []
        };

        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0x58b6a8a3302369daec383334672404ee733ab239", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0x0954906da0bf32d5479e25f46056d22f08464cab", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0xc221b7e65ffc80de234bbb6667abdd46593d34f0", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", 1);

        let swap1;
        let swap;
        let swap2;
        let swap3;
        let swap8;
        let swap9;
        try {
            let tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';  // Provide your tokenIn address
            let tokenOut = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Provide your tokenOut address
            let amountIn = '990000000';  // Amount to swap
            let from = aTokenConInstance.address;     // Provide the from address
            let origin = aTokenConInstance.address;

            swap1 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0x58b6a8a3302369daec383334672404ee733ab239'; // Provide your tokenOut address
            amountIn = '187624737';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0x0954906da0bf32d5479e25f46056d22f08464cab'; // Provide your tokenOut address
            amountIn = '187624737';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap2 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72'; // Provide your tokenOut address
            amountIn = '187624737';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap3 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0xc221b7e65ffc80de234bbb6667abdd46593d34f0'; // Provide your tokenOut address
            amountIn = '187624737';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap8 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // Provide your tokenOut address
            amountIn = '187624737';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap9 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );
        } catch (error) {
            console.error("Error during swaps:", error);
        }

        // var oneInchParam = {
        //     firstIterationUnderlyingSwap: [],
        //     secondIterationUnderlyingSwap: [],
        //     firstIterationCumulativeSwap: ["0x", swap1, "0x"],
        //     secondIterationCumulativeSwap: [swap, swap2, swap8, swap3, "0x"]
        // }

        var oneInchParam = {
            firstIterationUnderlyingSwap: [],
            secondIterationUnderlyingSwap: [],
            firstIterationCumulativeSwap: ["0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x"]
        }

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
                "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
                "0xd533a949740bb3306d119cc777fa900ba034cd52",
                "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
            ],
            newProviders: [0, 0, 0, 0, 0], // Fill this with the new providers' information
            _deadline: deadline,
            cometToClaim: [],
            cometRewardTokens: [],
            rewardTokenMinReturnAmounts: []
        };

        await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);

        let swap4;
        let swap5;
        let swap6;
        let swap7;
        let oneInchdata6;
        let oneInchdata8;
        let oneInchdata9;
        let oneInchdata10;

        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0x58b6a8a3302369daec383334672404ee733ab239", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0x0954906da0bf32d5479e25f46056d22f08464cab", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xc221b7e65ffc80de234bbb6667abdd46593d34f0", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0xdac17f958d2ee523a2206206994597c13d831ec7", 1);

        await sleep(1000);

        try {
            let tokenIn = '0x58b6a8a3302369daec383334672404ee733ab239';  // Provide your tokenIn address
            let tokenOut = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Provide your tokenOut address
            let amountIn = '11162808283791004854';  // Amount to swap
            let from = aTokenConInstance.address;     // Provide the from address
            let origin = aTokenConInstance.address;

            swap4 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0x0954906da0bf32d5479e25f46056d22f08464cab';  // Provide your tokenIn address
            tokenOut = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Provide your tokenOut address
            amountIn = '52171451048590474455';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            oneInchdata6 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0'; // Provide your tokenOut address
            amountIn = '103952838';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap5 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0xc221b7e65ffc80de234bbb6667abdd46593d34f0';  // Provide your tokenIn address
            tokenOut = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Provide your tokenOut address
            amountIn = '503645319859143263421';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap6 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            await sleep(1000);

            tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2';  // Provide your tokenIn address
            tokenOut = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Provide your tokenOut address
            amountIn = '115106633904905982';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            swap7 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0xd533a949740bb3306d119cc777fa900ba034cd52'; // Provide your tokenOut address
            amountIn = '156133785';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            await sleep(1000);

            oneInchdata8 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0x111111111117dc0aa78b770fa6a738034120c302'; // Provide your tokenOut address
            amountIn = '156133785';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            await sleep(1000);

            oneInchdata9 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

            tokenIn = '0xdac17f958d2ee523a2206206994597c13d831ec7';  // Provide your tokenIn address
            tokenOut = '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce'; // Provide your tokenOut address
            amountIn = '156133785';  // Amount to swap
            from = aTokenConInstance.address;     // Provide the from address
            origin = aTokenConInstance.address;

            await sleep(1000);

            oneInchdata10 = await swapTokens2(
                tokenIn,
                tokenOut,
                amountIn,
                from,
                origin
            );

        } catch (error) {
            console.error("Error during swaps:", error);
        }

        // oneInchParam = {
        //     firstIterationUnderlyingSwap: [
        //         swap4,
        //         oneInchdata6,
        //         swap6,
        //         "0x",
        //         swap7
        //     ],
        //     secondIterationUnderlyingSwap: [
        //         swap5,
        //         oneInchdata8,
        //         oneInchdata9,
        //         oneInchdata10,
        //         "0x"
        //     ],
        //     firstIterationCumulativeSwap: ["0x", "0x", "0x"],
        //     secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x"]
        // }

        
        oneInchParam = {
            firstIterationUnderlyingSwap: [
                "0x",
                "0x",
                "0x",
                "0x",
                "0x"
            ],
            secondIterationUnderlyingSwap: [
                "0x",
                "0x",
                "0x",
                "0x",
                "0x"
            ],
            firstIterationCumulativeSwap: ["0x", "0x", "0x"],
            secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x"]
        }

        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0x58b6a8a3302369daec383334672404ee733ab239", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0x0954906da0bf32d5479e25f46056d22f08464cab", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xc221b7e65ffc80de234bbb6667abdd46593d34f0", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 1);

        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0xd533a949740bb3306d119cc777fa900ba034cd52", 1);
        await aFiPassiveRebalanceInstance.connect(investor1).setDexForTokenPair("0xdac17f958d2ee523a2206206994597c13d831ec7", "0x111111111117dc0aa78b770fa6a738034120c302", 1);

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
            [0, 0, 0, 0, 0, 0]
            ],
            swapParams,
            oneInchParam,
            0,
            0
        );
    });

})  