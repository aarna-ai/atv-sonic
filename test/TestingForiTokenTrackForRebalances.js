// /* eslint-disable no-underscore-dangle */
// const { assert, expect } = require('chai');
// const { ethers, waffle } = require('hardhat');
// const { BigNumber } = require('ethers');
// const { time, constants } = require("@openzeppelin/test-helpers");
// const { provider } = waffle;


// const { abi: AFIBASE_ABI } = require('../artifacts/contracts/AtvBase.sol/AtvBase.json');

// const {
//     // eslint-disable-next-line max-len
//     ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
// } = require('../utils/constants');
// const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

// const getBigNumber = (number) => ethers.BigNumber.from(number);

// describe('AFiManager', (accounts) => {
//     let platformWallet; let recipient; let investor1; let investor2; let investor3;
//     let rebalanceController;
//     let deadline;
//     let deployedAFiBase;
//     let aTokenConInstance;

//     // eslint-disable-next-line no-unused-vars
//     let daiConInstance;
//     let usdcConInstance;
//     let usdtConInstance;
//     let snapshotId;
//     let oneInchParam;

//     before(async () => {


//         oneInchParam = {
//             firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
//             secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
//             firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
//             secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
//         }

//         // Take EVM snapshot
//         // snapshotId = await ethers.provider.send('evm_snapshot');

//         const userAccounts = await ethers.getSigners();
//         [platformWallet, recipient, investor1, investor2, investor3, rebalanceController] = userAccounts;

//         const currentTime = await time.latest();
//         deadline = currentTime + (60 * 60);

//         const AFiBase = await ethers.getContractFactory('AtvBase');
//         const AFiManager = await ethers.getContractFactory('AtvManager');
//         const PassiveRebalanceStrategies = await ethers.getContractFactory('AtvPassiveRebalanceStrategies');

//         const AFiStorage = await ethers.getContractFactory('AtvStorage');
//         const AFiFacotry = await ethers.getContractFactory('AtvFactory');
//         const AFiOracle = await ethers.getContractFactory('AtvOracle');

//         // LOCAL CONTRACTS
//         aFiBaseInstace = await AFiBase.deploy("AFi802", "AFi");
//         aFiManagerInstance = await AFiManager.deploy();
//         aFiPassiveRebalanceInstance = await PassiveRebalanceStrategies.deploy();
//         aFiAFiOracleInstance = await AFiOracle.deploy(aFiPassiveRebalanceInstance.address);

//         aFiFactoryInstance = await AFiFacotry.deploy(aFiBaseInstace.address);
//         aFiStorageInstance = await AFiStorage.deploy(aFiManagerInstance.address, aFiAFiOracleInstance.address, aFiPassiveRebalanceInstance.address, aFiFactoryInstance.address);
//         console.log("print the address of the aFiFactoryInstance", aFiFactoryInstance.address);

//         const payload = [
//             [
//                 "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                 "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                 "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                 "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//             ],
//             [
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//             ]
//         ]
//         const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)

//         const payloadnew = [
//             ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
//             ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
//             uDataPayload,
//             [
//                 "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4",
//                 "0x0000000000000000000000000000000000000000",
//                 "0x0000000000000000000000000000000000000000",
//                 "0xFAce851a4921ce59e912d19329929CE6da6EB0c7",
//                 "0x0000000000000000000000000000000000000000"
//             ],
//             [
//                 "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8",
//                 "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
//                 "0xF6D2224916DDFbbab6e6bd0D1B7034f4Ae0CaB18",
//                 "0x5E8C8A7243651DB1384C0dDfDbE39761E8e7E51a",
//                 "0x0000000000000000000000000000000000000000"
//             ],
//             [
//                 "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
//                 "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
//                 "0x553303d460ee0afb37edff9be42922d8ff63220e",
//                 "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
//                 "0x4ffc43a60e009b551865a93d232e33fce9f01507"
//             ],
//             ["2000000", "2000000", "2000000", "2000000", "2000000"],
//             [
//                 "0x0000000000000000000000000000000000000000",
//                 "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
//                 "0x0000000000000000000000000000000000000000",
//                 "0x0000000000000000000000000000000000000000",
//                 "0x0000000000000000000000000000000000000000"
//             ],
//             2
//         ]

//         const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

//         result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
//             aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

//         deployedAFiBase = await aFiFactoryInstance.aFiProducts(0)


//         //let txObject = await result.wait()

//         //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);

//         aTokenConInstance = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);
//         //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));

//         aFiPassiveRebalanceInstance.intializeStalePriceDelay([
//             "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
//             "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//             "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//             "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//             "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//             "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // Aave
//             "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL

//         ], [
//             86500,
//             86500,
//             86500,
//             86500,
//             86500,
//             86500,
//             86500,
//             86500,
//             86500
//         ])

//         await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);
//         await aFiManagerInstance.setRebalanceController(rebalanceController.address);
//         await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance.address, investor1.address);

//         // // Transfer all AFinance Tokens to PLATFORM_WALLET
//         // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

//         // MAINNET CONTRACT INSTANCES
//         daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
//         usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
//         usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

//         const accountToImpersonate = "0x54edC2D90BBfE50526E333c7FfEaD3B0F22D39F0"
//         const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

//         await hre.network.provider.request({
//             method: "hardhat_impersonateAccount",
//             params: [accountToImpersonate],
//         });
//         const signer = await ethers.getSigner(accountToImpersonate)

//         const ether = (amount) => {
//             const weiString = ethers.utils.parseEther(amount.toString());
//             return BigNumber.from(weiString);
//         };

//         /**
//         * GIVE APPROVAL TO AFi of DEPOSIT TOKEN
//         * THIS IS REQUIRED WHEN 1% fee IS TRANSFEREED FROM INVESTOR TO PLATFORM WALLET
//         */

//         console.log("print the productttttttttttt", usdtConInstance.address);

//         console.log("print the productttttttttttt", aTokenConInstance.address);

//         await usdtConInstance.connect(investor1).approve(
//             aTokenConInstance.address,
//             ethers.constants.MaxUint256
//         );

//         await usdtConInstance.connect(investor2).approve(
//             aTokenConInstance.address,
//             ethers.constants.MaxUint256
//         );

//         await usdcConInstance.connect(investor1).approve(
//             aTokenConInstance.address,
//             ethers.constants.MaxUint256
//         );

//         await usdcConInstance.connect(investor2).approve(
//             aTokenConInstance.address,
//             ethers.constants.MaxUint256
//         );

//         await daiConInstance.connect(investor1).approve(
//             aTokenConInstance.address,
//             ethers.constants.MaxUint256
//         );

//         await daiConInstance.connect(investor2).approve(
//             aTokenConInstance.address,
//             ethers.constants.MaxUint256
//         );

//         const daiBalance = await daiConInstance.balanceOf(accountToImpersonate)
//         console.log("whale dai balance", daiBalance / 1e18)
//         console.log("transfering to", accountToFund)

//         await aFiPassiveRebalanceInstance.setManager(aFiManagerInstance.address);

//         await aFiPassiveRebalanceInstance.setPriceOracle(
//             [
//                 "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                 "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
//                 "0x6B175474E89094C44Da98b954EedeAC495271d0F"
//             ],
//             [
//                 "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                 "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                 "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                 "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
//                 "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
//             ],
//             [
//                 "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
//                 "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
//                 "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"
//             ], // USDT, USDC - chainlink oracles
//             [
//                 "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
//                 "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
//                 "0x553303d460ee0afb37edff9be42922d8ff63220e",
//                 "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
//                 "0x4ffc43a60e009b551865a93d232e33fce9f01507",
//                 "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
//             ],
//         );

//         await aTokenConInstance.setplatformWallet(platformWallet.address);

//         // await daiConInstance.connect(signer).transfer(investor1.address, daiBalance);

//         // const accountBalance = await daiConInstance.balanceOf(investor1.address)
//         // console.log("transfer complete")
//         // console.log("funded account balance", accountBalance / 1e18)

//         var usdtBalance = await usdtConInstance.balanceOf(accountToImpersonate);
//         let usdcBalance = await usdcConInstance.balanceOf(accountToImpersonate);

//         await usdcConInstance.connect(signer).transfer(investor1.address, usdcBalance);
//         console.log("usdcBalance", usdcBalance);

//         console.log("usdtBalance", usdtBalance)
//         usdtBalance = usdtBalance / 3;
//         console.log("usdtBalance", usdtBalance)
//         await usdtConInstance.connect(signer).transfer(investor1.address, "50000957569");
//         await usdtConInstance.connect(signer).transfer(investor2.address, "50000957569");

//         const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
//         await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);
//         await aTokenConInstance.setMinDepLimit(100);
//         console.log("transfer complete")
//         console.log("funded account balance usdttttttttt", investorusdtBalance)
//         await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
//         await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
//     });

//     describe('Basic checks for deposit and withdraw', () => {

//         it('scenario 1 testing inmanager when stable token is usdt', async () => {
//             snapshotId = await ethers.provider.send('evm_snapshot');
//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             );

//             const poolPayload = [
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
//                     "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
//                     "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
//                     "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
//                 ],
//                 [
//                     [[
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                     ]]
//                 ],
//                 [
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]
//             ]
//             const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)

//             const accountBalance = await daiConInstance.balanceOf(investor1.address)
//             console.log("transfer complete")
//             console.log("funded account balance", accountBalance / 1e18)

//             const ether = (amount) => {
//                 const weiString = ethers.utils.parseEther(amount.toString());
//                 return BigNumber.from(weiString);
//             };




//             await aTokenConInstance.connect(investor1).deposit(
//                 3000000000, usdtConInstance.address
//             );




//             await aTokenConInstance.connect(investor1).deposit(
//                 1000000000, usdcConInstance.address
//             );

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
//             console.log("User NAVVVVV", `${nav2}`)
//             let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
//             console.log("after deposit usdtBalance", usdtBalance)
//             await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);



//             const numbers = [
//                 "1250230",
//                 "211379301119179471",
//                 "80080613841879501949",
//                 "34816381824594232923",
//                 "5355788253"
//             ];

//             const bigNumbers = numbers.map(num => BigNumber.from(num));

//             const stringRepresentations = bigNumbers.map(bn => bn.toString());

//             const swapParams = {
//                 afiContract: aTokenConInstance.address,
//                 oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                 cSwapFee: 1000000,
//                 cSwapCounter: 0,
//                 depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
//                 minimumReturnAmount: [0, 0, 0, 0, 0],
//                 iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
//                 underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
//                 newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
//                 _deadline: deadline,
//                 cometToClaim: [],
//                 cometRewardTokens: [],
//                 rewardTokenMinReturnAmounts: []
//             };
//             await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
//             await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x");

//             const Afterbal1 = await aTokenConInstance.balanceOf(investor1.address);
//             console.log("Afterbal++++++3", `${Afterbal1}`)



//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             const minimumReturnAmount =
//                 [
//                     0,
//                     0,
//                     0,
//                     0,
//                     0
//                 ]

//             const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
//             const returnString = Amount.map(bn => bn.toString());

//             console.log("check", Amount);

//             usdtBalance = await usdtConInstance.balanceOf(investor1.address)
//             console.log("before withdraw usdtBalance", usdtBalance);

//             const uniPayload = [[
//                 "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
//             ],
//             [
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//             ],
//             [
//                 "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
//             ],
//             [
//                 "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
//             ],
//             [
//                 [[
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
//                 ]], [[
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
//                 ]], [[
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]]

//             ],
//             [
//                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//             ]
//             ]
//             const encodedUniPayload = await aFiPassiveRebalanceInstance.encodePoolData(uniPayload);
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], encodedUniPayload)

//             const newUToken = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
//             const payload = [
//                 [
//                     "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             ]
//             const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)

//             const bytesPayload = [
//                 ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], //USDT, USDC - payment tokens
//                 ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"], // USDT, USDC - chainlink oracles
//                 uDataPayload,

//                 [
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 [
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 [
//                     "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
//                 ],
//                 ["0"],
//                 [
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 2,
//             ]

//             const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);

//             var res = await aTokenConInstance.getProportions();
//             console.log("uTokProp", res);

//             await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

//             var balOfTheContract = await usdcConInstance.balanceOf(aTokenConInstance.address)
//             console.log("bal after transfer", `${balOfTheContract}`)

//             await usdcConInstance.connect(investor1).transfer(aTokenConInstance.address, "10000000");

//             balOfTheContract = await usdcConInstance.balanceOf(aTokenConInstance.address)
//             console.log("bal after transfer", `${balOfTheContract}`)

//             var preDepBefore = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, 1, usdcConInstance.address);
//             console.log("PreswapDep before rebalance scenario 1 ====== ", preDepBefore);

//             await aFiManagerInstance.connect(rebalanceController).rebalance(
//                 bytesData,
//                 [
//                     aTokenConInstance.address,
//                     aFiStorageInstance.address,
//                     "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                     newUToken,
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
//                     1,
//                     [],
//                     res[0],
//                     res[1],
//                     2,
//                     0
//                 ],
//                 deadline,
//                 [0, 0, 0, 0, 0],
//                 0,
//                 10,
//                 "0x",
//                 [
//                     "0x",
//                     "0x",
//                     "0x",
//                     "0x",
//                     "0x"
//                 ]
//             );

//             preDepBefore = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, 1, usdcConInstance.address);
//             console.log("PreswapDep after rebalance scenario 1 ====== ", preDepBefore);
//             await ethers.provider.send('evm_revert', [snapshotId]);
//         });

//         it('scenario 2 testing inmanager when stable token is USDT', async () => {

//             snapshotId = await ethers.provider.send('evm_snapshot');
//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             );

//             const poolPayload = [
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
//                     "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
//                     "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
//                     "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
//                 ],
//                 [
//                     [[
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                     ]]
//                 ],
//                 [
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]
//             ]
//             const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)

//             const accountBalance = await daiConInstance.balanceOf(investor1.address)
//             console.log("transfer complete")
//             console.log("funded account balance", accountBalance / 1e18)

//             const ether = (amount) => {
//                 const weiString = ethers.utils.parseEther(amount.toString());
//                 return BigNumber.from(weiString);
//             };

//             await aTokenConInstance.connect(investor1).deposit(
//                 3000000000, usdtConInstance.address
//             );

//             await aTokenConInstance.connect(investor1).deposit(
//                 1000000000, usdcConInstance.address
//             );


//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             let nav2 = await aTokenConInstance.depositUserNav(investor1.address);
//             console.log("User NAVVVVV", `${nav2}`)
//             let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
//             console.log("after deposit usdtBalance", usdtBalance)
//             await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance.address, investor1.address, investor1.address);

//             const numbers = [
//                 "1250230",
//                 "211379301119179471",
//                 "80080613841879501949",
//                 "34816381824594232923",
//                 "5355788253"
//             ];

//             const bigNumbers = numbers.map(num => BigNumber.from(num));

//             const stringRepresentations = bigNumbers.map(bn => bn.toString());

//             const swapParams = {
//                 afiContract: aTokenConInstance.address,
//                 oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                 cSwapFee: 1000000,
//                 cSwapCounter: 0,
//                 depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
//                 minimumReturnAmount: [0, 0, 0, 0, 0],
//                 iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
//                 underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
//                 newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
//                 _deadline: deadline,
//                 cometToClaim: [],
//                 cometRewardTokens: [],
//                 rewardTokenMinReturnAmounts: []
//             };
//             await aTokenConInstance.connect(investor1).pauseUnpauseDeposit(true);
//             await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x");

//             const Afterbal1 = await aTokenConInstance.balanceOf(investor1.address);
//             console.log("Afterbal++++++3", `${Afterbal1}`)

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             const minimumReturnAmount =
//                 [
//                     0,
//                     0,
//                     0,
//                     0,
//                     0
//                 ]

//             const Amount = minimumReturnAmount.map(num => BigNumber.from(num));
//             const returnString = Amount.map(bn => bn.toString());

//             console.log("check", Amount);

//             usdtBalance = await usdtConInstance.balanceOf(investor1.address)
//             console.log("before withdraw usdtBalance", usdtBalance);

//             const uniPayload = [[
//                 "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
//             ],
//             [
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//             ],
//             [
//                 "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
//             ],
//             [
//                 "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
//             ],
//             [
//                 [[
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
//                 ]], [[
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
//                 ]], [[
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]]

//             ],
//             [
//                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                 "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//             ]
//             ]
//             const encodedUniPayload = await aFiPassiveRebalanceInstance.encodePoolData(uniPayload);
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], encodedUniPayload)

//             const newUToken = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
//             const payload = [
//                 [
//                     "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             ]
//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             );
//             const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)

//             const bytesPayload = [
//                 ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], //USDT, USDC - payment tokens
//                 ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"], // USDT, USDC - chainlink oracles
//                 uDataPayload,

//                 [
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 [
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 [
//                     "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
//                 ],
//                 ["0"],
//                 [
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 2,
//             ]

//             const bytesData = await aFiFactoryInstance.encodePoolData(bytesPayload);

//             var res = await aTokenConInstance.getProportions();
//             console.log("uTokProp", res);

//             await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);

//             var balOfTheContract = await usdcConInstance.balanceOf(aTokenConInstance.address)
//             console.log("bal after transfer", `${balOfTheContract}`)

//             await usdcConInstance.connect(investor1).transfer(aTokenConInstance.address, "10000000");

//             balOfTheContract = await usdcConInstance.balanceOf(aTokenConInstance.address)
//             console.log("bal after transfer", `${balOfTheContract}`)

//             var preDepBefore = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, 1, usdcConInstance.address);
//             console.log("PreswapDep before rebalance scenario 1 ====== ", preDepBefore);

//             await aFiManagerInstance.connect(rebalanceController).rebalance(
//                 bytesData,
//                 [
//                     aTokenConInstance.address,
//                     aFiStorageInstance.address,
//                     "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                     newUToken,
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
//                     2,
//                     [],
//                     res[0],
//                     res[1],
//                     2,
//                     0
//                 ],
//                 deadline,
//                 [0],
//                 0,
//                 0,
//                 "0x",
//                 [
//                     "0x",
//                     "0x",
//                     "0x",
//                     "0x",
//                     "0x"
//                 ]
//             );

//             preDepBefore = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance.address, 1, usdcConInstance.address);
//             console.log("PreswapDep after rebalance scenario 1 ====== ", preDepBefore);

//             res = await aTokenConInstance.getUTokens();
//             console.log("uTokProp", res);
//             res = await aTokenConInstance.getProportions();
//             console.log("after rebalance theproprtion", res);

//             var NavfromStorage = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance.address, aFiStorageInstance.address);
//             console.log("Nav from storage after rebalance", `${NavfromStorage}`);

//             await ethers.provider.send('evm_revert', [snapshotId]);
//         });
//     });

//     describe('ALGO', async () => {
//         let snapshotId;
//         let aTokenConInstance1;
//         let oneInchParam;

//         before(async () => {

//             oneInchParam = {
//                 firstIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
//                 secondIterationUnderlyingSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
//                 firstIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"],
//                 secondIterationCumulativeSwap: ["0x", "0x", "0x", "0x", "0x", "0x"]
//             }
//             await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
//             const payload = [
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             ]
//             const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload)

//             const payloadnew = [
//                 ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], //USDT, USDC - payment tokens
//                 ["0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9"], // USDT, USDC - chainlink oracles
//                 uDataPayload,
//                 [
//                     "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4",
//                     "0x0000000000000000000000000000000000000000",
//                     "0x0000000000000000000000000000000000000000",
//                     "0xFAce851a4921ce59e912d19329929CE6da6EB0c7",
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 [
//                     "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8",
//                     "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
//                     "0xF6D2224916DDFbbab6e6bd0D1B7034f4Ae0CaB18",
//                     "0x5E8C8A7243651DB1384C0dDfDbE39761E8e7E51a",
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 [
//                     "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
//                     "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
//                     "0x553303d460ee0afb37edff9be42922d8ff63220e",
//                     "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
//                     "0x4ffc43a60e009b551865a93d232e33fce9f01507"
//                 ],
//                 ["2000000", "2000000", "2000000", "2000000", "2000000"],
//                 [
//                     "0x0000000000000000000000000000000000000000",
//                     "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
//                     "0x0000000000000000000000000000000000000000",
//                     "0x0000000000000000000000000000000000000000",
//                     "0x0000000000000000000000000000000000000000"
//                 ],
//                 3
//             ]

//             const bytesPayload2 = await aFiFactoryInstance.encodePoolData(payloadnew);

//             result = await aFiFactoryInstance.createAToken("AFiBase", "ATOK", bytesPayload2, [investor1.address, investor2.address], true, aFiStorageInstance.address,
//                 aFiPassiveRebalanceInstance.address, aFiManagerInstance.address, ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], "0x0000000000000000000000000000000000000000");

//             deployedAFiBase = await aFiFactoryInstance.aFiProducts(1)

//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             );



//             const poolPayload = [
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",  // SOL
//                     "0xc00e94Cb662C3520282E6f5717214004A7f26888"   // COMP
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
//                     "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"

//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598",
//                     "0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6"
//                 ],
//                 [
//                     [[
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                     ]]
//                 ],
//                 [
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]
//             ]
//             const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)


//             //let txObject = await result.wait()

//             //console.log("result++++++++++++++++++++++++", txObject.events[11].args[0]);

//             aTokenConInstance1 = await ethers.getContractAt(AFIBASE_ABI, deployedAFiBase);
//             //console.log("result++++++++++++++++++++++++", await aTokenConInstance.getPriceOracle("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"));
//             await aTokenConInstance1.setplatformWallet(platformWallet.address);
//             await aFiPassiveRebalanceInstance.intializeStalePriceDelay([
//                 "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F",
//                 "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                 "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                 "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                 "0xc00e94Cb662C3520282E6f5717214004A7f26888", // Comp
//                 "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // Aave
//                 "0xD533a949740bb3306d119CC777fa900bA034cd52", // CRV
//                 "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL

//             ], [
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500,
//                 86500
//             ])
//             await aFiAFiOracleInstance.setAFiStorage(aFiStorageInstance.address);

//             // // Transfer all AFinance Tokens to PLATFORM_WALLET
//             // await aFinanceConInstance.transfer(platformWallet.address, AFINANCE_SUPPLY);

//             // MAINNET CONTRACT INSTANCES
//             daiConInstance = await ethers.getContractAt(DAI_ABI, DAI_ADDRESS);
//             usdcConInstance = await ethers.getContractAt(USDC_ABI, USDC_ADDRESS);
//             usdtConInstance = await ethers.getContractAt(USDT_ABI, USDT_ADDRESS);

//             const accountToImpersonate = "0x9E4E147d103deF9e98462884E7Ce06385f8aC540"
//             const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"

//             await hre.network.provider.request({
//                 method: "hardhat_impersonateAccount",
//                 params: [accountToImpersonate],
//             });
//             const signer = await ethers.getSigner(accountToImpersonate);

//             console.log("print the productttttttttttt", usdtConInstance.address);

//             console.log("print the productttttttttttt", aTokenConInstance1.address);

//             await usdtConInstance.connect(investor1).approve(
//                 aTokenConInstance1.address,
//                 ethers.constants.MaxUint256
//             );

//             await usdtConInstance.connect(investor2).approve(
//                 aTokenConInstance1.address,
//                 ethers.constants.MaxUint256
//             );

//             await usdcConInstance.connect(investor1).approve(
//                 aTokenConInstance1.address,
//                 ethers.constants.MaxUint256
//             );

//             await usdcConInstance.connect(investor2).approve(
//                 aTokenConInstance1.address,
//                 ethers.constants.MaxUint256
//             );

//             await daiConInstance.connect(investor1).approve(
//                 aTokenConInstance1.address,
//                 ethers.constants.MaxUint256
//             );

//             await daiConInstance.connect(investor2).approve(
//                 aTokenConInstance1.address,
//                 ethers.constants.MaxUint256
//             );

//             const daiBalance = await daiConInstance.balanceOf(accountToImpersonate)
//             console.log("whale dai balance", daiBalance / 1e18)
//             console.log("transfering to", accountToFund)

//             console.log("transfer complete")
//             await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
//             await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x6B175474E89094C44Da98b954EedeAC495271d0F", // underlying - DAI
//                     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
//                     "0xdAC17F958D2ee523a2206206994597C13D831ec7"
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of USDT
//                 ]
//             );

//             await aFiPassiveRebalanceInstance.setStorage(aFiStorageInstance.address);
 await aFiPassiveRebalanceInstance.setOracle(aFiAFiOracleInstance.address);

//             const investorusdtBalance = await usdtConInstance.balanceOf(investor1.address)
//             await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

//             console.log("transfer completey")
//             console.log("funded account balance usdttttttttt", investorusdtBalance)
//             await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);
//             await aFiPassiveRebalanceInstance.setPauseDepositController(aTokenConInstance1.address, investor1.address);
//             await aFiManagerInstance.setRebalanceController(rebalanceController.address);

//             await aTokenConInstance1.setMinDepLimit(100);
//             await aFiAFiOracleInstance.updateAFiManager(aFiManagerInstance.address);
//         });

//         it('Algo product testing', async () => {
//             snapshotId = await ethers.provider.send('evm_snapshot');
//             await aFiManagerInstance.setafiOracleContract(aFiAFiOracleInstance.address);


//             console.log("checkkkkkkkk");

//             await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(false);


//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ]
//             );

//             const poolPayload = [
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"  // SOL
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     "0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598"

//                 ],
//                 [
//                     [[
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                     ]], [[
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                     ]]
//                 ],
//                 [
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]
//             ]
//             const unipooldata = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload)
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata)

//             const accountBalance = await daiConInstance.balanceOf(investor1.address)
//             console.log("transfer complete")
//             console.log("funded account balance", accountBalance / 1e18)

//             console.log("Heyy checkout ")

//             const ether = (amount) => {
//                 const weiString = ethers.utils.parseEther(amount.toString());
//                 return BigNumber.from(weiString);
//             };

//             var poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

//             await aTokenConInstance1.connect(investor1).deposit(
//                 3000000000, usdtConInstance.address
//             );

//             poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             await aTokenConInstance1.connect(investor1).deposit(
//                 1000000000, usdcConInstance.address
//             );

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             let nav2 = await aTokenConInstance1.depositUserNav(investor1.address);
//             console.log("User NAVVVVV", `${nav2}`)

//             let usdtBalance = await usdtConInstance.balanceOf(investor1.address)
//             console.log("after deposit usdtBalance", usdtBalance)

//             await aFiAFiOracleInstance.updateVaultControllers(aTokenConInstance1.address, investor1.address, investor1.address);

//             checkNav = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address);
//             console.log("check nav ", `${checkNav}`);

//             const numbers = [
//                 "1250230",
//                 "211379301119179471",
//                 "80080613841879501949",
//                 "34816381824594232923",
//                 "5355788253"
//             ];

//             const bigNumbers = numbers.map(num => BigNumber.from(num));

//             const stringRepresentations = bigNumbers.map(bn => bn.toString());

//             const swapParams = {
//                 afiContract: aTokenConInstance1.address,
//                 oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                 cSwapFee: 1000000,
//                 cSwapCounter: 0,
//                 depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
//                 minimumReturnAmount: [0, 0, 0, 0, 0],
//                 iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
//                 underlyingTokens: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     "0xD31a59c85aE9D8edEFeC411D448f90841571b89c"],  // SOL], // Fill this array if your function expects specific tokens
//                 newProviders: [2, 2, 2, 0, 0], // Fill this with the new providers' information
//                 _deadline: deadline,
//                 cometToClaim: [],
//                 cometRewardTokens: [],
//                 rewardTokenMinReturnAmounts: []
//             };

//             await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

//             await aFiAFiOracleInstance.connect(investor1).cumulativeSwap(swapParams, 0, oneInchParam, "0x");

//             poolValue = await aFiStorageInstance.calculatePoolInUsd(aTokenConInstance1.address);


//             const oraclePayload = [
//                 "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
//                 "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
//                 "0x553303d460ee0afb37edff9be42922d8ff63220e",
//                 "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
//                 //"0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
//                 //"0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
//             ];

//             const payload = [[
//                 "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                 "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                 "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                 "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" //Aave
//             ],
//             [
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//             ],
//             [
//                 "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                 "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                 "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                 "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
//             ],
//             [
//                 "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                 "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                 "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                 "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                 "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"

//             ],
//             [
//                 [[
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
//                 ]], [[
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
//                 ]]
//             ],
//             [
//                 "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                 "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
//             ]
//             ]
//             const uDataPayload = await aFiFactoryInstance.encodeUnderlyingData(payload);

//             let managerF = await usdtConInstance.balanceOf(investor1.address);
//             console.log("before first rebal", `${managerF}`);

//             let pool = await aFiFactoryInstance.getPricePerFullShare(aTokenConInstance1.address, aFiStorageInstance.address
//             );
//             console.log("Nav before rebal", `${pool}`);

//             await aFiPassiveRebalanceInstance.updateMidToken(
//                 [
//                     "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
//                     // "0xD533a949740bb3306d119CC777fa900bA034cd52"

//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // Middle Token of DAI
//                 ]
//             );

//             const poolPayload1 = [
//                 [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
//                     //"0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", //Aave
//                     // "0xD533a949740bb3306d119CC777fa900bA034cd52"
//                 ],
//                 [
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of DAI
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Middle Token of USDT
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     //"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//                     // "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
//                     // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

//                 ],
//                 [
//                     "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",  // pool WBTC - WETH
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // pool WETH - WETH
//                     "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801",   // pool UNI - WETH
//                     "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8",
//                     //"0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB",
//                     // "0x919Fa96e88d67499339577Fa202345436bcDaf79",

//                 ],
//                 [
//                     [[
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         //"0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                         // "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",  // Pool USDT-WETH (Stables- I/O tokens)
//                     ]], [[
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         //"0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                         // "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",  // pool USDC-WETH (Stables- I/O tokens)
//                     ]],
//                     [[
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         //"0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
//                         // "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",

//                     ]]
//                 ],
//                 [
//                     "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
//                     "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
//                     "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8"
//                 ]
//             ]
//             const unipooldata1 = await aFiPassiveRebalanceInstance.encodePoolData(poolPayload1)
//             await aFiPassiveRebalanceInstance.initUniStructure(["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], unipooldata1)

//             console.log("1. ..........................................");

//             const getStables = await aFiManagerInstance.inputTokenUSD(aTokenConInstance1.address, 1, aFiStorageInstance.address);
//             await aFiManagerInstance.connect(rebalanceController).updateStableUnitsInUSD(getStables);

//             var swapParams2 = {
//                 afiContract: aTokenConInstance1.address,
//                 oToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//                 cSwapFee: 1000000,
//                 cSwapCounter: 0,
//                 depositTokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
//                 minimumReturnAmount: [0, 0, 0, 0],
//                 iMinimumReturnAmount: [0, 0, 0], // Adjust according to your contract's expectations
//                 underlyingTokens: [
//                     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // underlying - WBTC
//                     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
//                     "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  // UNI
//                     "0x514910771AF9Ca656af840dff83E8264EcF986CA",
//                 ],
//                 newProviders: [0, 0, 0, 0], // Fill this with the new providers' information
//                 _deadline: deadline,
//                 cometToClaim: [],
//                 cometRewardTokens: [],
//                 rewardTokenMinReturnAmounts: []
//             };


//             console.log("2. ..........................................");
//             await aTokenConInstance1.connect(investor1).pauseUnpauseDeposit(true);

               
//             var balOfTheContract = await usdcConInstance.balanceOf(aTokenConInstance1.address)
//             console.log("bal after transfer", `${balOfTheContract}`)

//             await usdcConInstance.connect(investor1).transfer(aTokenConInstance1.address, "10000000");

//             balOfTheContract = await usdcConInstance.balanceOf(aTokenConInstance1.address)
//             console.log("bal after transfer", `${balOfTheContract}`)

//             var preDepBefore = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance1.address, 1, usdcConInstance.address);
//             console.log("PreswapDep before batchWithdraw ====== ", preDepBefore);

//             await aFiManagerInstance.connect(rebalanceController).rebalanceUnderlyingTokens(
//                 [
//                     aTokenConInstance1.address,
//                     aFiStorageInstance.address,
//                     unipooldata1,
//                     oraclePayload,
//                     [],
//                     usdtConInstance.address,
//                     0,
//                     1000,
//                     deadline,
//                     [0, 0, 0, 0, 0, 0],
//                     [0, 0, 0, 0, 0, 0]
//                 ],
//                 swapParams2,
//                 oneInchParam,0, 0
//             );
            
//             preDepBefore = await aFiStorageInstance.getPreSwapDepositsTokens(aTokenConInstance1.address, 1, usdcConInstance.address);
//             console.log("PreswapDep after batchWithdraw ====== ", preDepBefore);

//             await ethers.provider.send('evm_revert', [snapshotId]);
//         });
//     });
// });