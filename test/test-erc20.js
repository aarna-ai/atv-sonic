const BN = require("bn.js");
var web3 = require('web3');

const { USDT, USDT_WHALE, DAI, WETH, USDC } = require("./config");


const {
    // eslint-disable-next-line max-len
    ONEINCHEXCHANGE_ABI, ONEINCHEXCHANGE_ADDRESS, DAI_ABI, DAI_ADDRESS, SAI_ABI, SAI_ADDRESS, USDT_ABI, USDT_ADDRESS, USDC_ABI, USDC_ADDRESS,
} = require('../utils/constants');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

// const IERC20 = artifacts.require("IERC20");

describe("IERC20", (accounts) => {

   
    // const TOKEN = UNI;
    // const WHALE = "0xBfEd5dB4A855C66452aFe5ec2d27949F185A22bf";
    // const WHALE = USDT_WHALE;
    const TOKEN = USDC;
    const WHALE ="0x57757E3D981446D585Af0D9Ae4d7DF6D64647806";
    let signer;
    let token;
    beforeEach(async () => {

        token = await ethers.getContractAt(USDC_ABI, TOKEN);

        
                const accountToInpersonate = "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806"
                const accountToFund = "0x7Bc58bD67b258b445E4528039BE14824f04d2422"
        
                await hre.network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [accountToInpersonate],
                });
                signer = await ethers.getSigner(accountToInpersonate);
        

        // token = await IERC20.at(TOKEN);
        //daiInstance = await IERC20.at(DAI);
    });

    it("should pass", async () => {
        const bal = await token.balanceOf(WHALE);
        // let one_eth = web3.toWei(1, "ether");
        // await web3.eth.sendTransaction({from: accounts[0], to: "0x89071Af5E9Fe930c88935963aa4aB81fB9a17cB0", value: 1000000});
        console.log(`bal: ${bal}`);
    });

    it("should transfer", async () => {
        const bal = await token.balanceOf(WHALE);
        console.log(`balance of whealthy address: ${bal}`);
        await token.connect(signer).transfer("0xf2043757377D45E7Ee85a11fF384eF58B6feF15c", bal);

        // await token.transfer("0xf2043757377D45E7Ee85a11fF384eF58B6feF15c", bal);
        //await daiInstance.transfer(accounts[0], bal, { from: WHALE });
        // // // const balLater= await token.balanceOf(DAI_WHALE);
        // const balAfter = await token.balanceOf(accounts[0]);

        const balzero = await token.balanceOf("0xf2043757377D45E7Ee85a11fF384eF58B6feF15c");
        //const balzero1 = await daiInstance.balanceOf(accounts[0]);
        // console.log(accounts[0].privateKey)



        //const balLater = await token.balanceOf("0x6B175474E89094C44Da98b954EedeAC495271d0F");
        console.log(`bal of the contract: ${balzero}`);
        //console.log(`bal: ${balzero1}`);
        //console.log(`balAfter: ${balAfter}`);

        // console.log(`bal: ${balLater}`);

        // // console.log(`balance Later: ${balLater}`);
        // const name = await token.name();
        // console.log(`name: ${name}`);


        // const tSypply = await token.totalSupply(WHALE);
        // console.log(tSupply);
    });

    // it("should approve", async () => {
    //   const bal = await token.balanceOf(accounts[0]);
    //   await token.approve("0x398eC7346DcD622eDc5ae82352F02bE94C62d119", bal, { from: accounts[0] });
    // });
});