/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable import/no-extraneous-dependencies */
require('@nomiclabs/hardhat-waffle');
// require('hardhat-tracer');
require("hardhat-gas-reporter");
require('solidity-coverage');
require('hardhat-contract-sizer');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  gasReporter: {
    currency: 'USD',
    gasPrice: 20,
    coinmarketcap : '52f659c4-7975-49dc-8dbd-9970c34036fc'
  },
  solidity: {
    version: '0.8.16',
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {

      forking: {
        url: 'https://rpc.soniclabs.com',
      },
      accounts: {
        mnemonic: 'message echo globe flower across fantasy wet husband muffin basket used gaze',
      },
      chainId: 146,
      // hardfork: 'LONDON',
      //blockNumber: 17445598
 
    },
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
  mocha: {
    useColors: true,
    timeout: 1000000,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
};