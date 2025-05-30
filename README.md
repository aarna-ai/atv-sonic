AFi Testcases execution on mainnet fork:

# to run the mainnet fork with new infura link (Same can be modified for solidity )

npx hardhat node --fork "https://rpc.soniclabs.com"

# run test
npx hardhat test ./test/AFiBase.test.js

# solidity- coverage
npx truffle run coverage

# soldiity coverage command
$ npx hardhat coverage --solcoverjs ./.solcover.js 
keep the node running on other terminal


**Missing or unexpected coverage?** Make sure you're using the latest plugin version and run:
```sh
$ npx hardhat clean
$ npx hardhat compile
$ npx hardhat coverage
```
npx hardhat test ./test/Exchanges/AtvUSDC.js
npx ts-node src/add-liquidity.ts

$ npx hardhat clean & npx hardhat compile & npx hardhat coverage
test
