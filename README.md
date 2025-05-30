AFi Testcases execution on mainnet fork:

# to run the mainnet fork with new infura link (Same can be modified for solidity )

npx hardhat node --fork "https://mainnet.infura.io/v3/ad9a322ec8a34980b9f0c73a707aacf6"

npx hardhat node --fork "https://mainnet.infura.io/v3/7c3ddccaeb5c4c94affc5eb23f2fe65c"

npx hardhat node --fork "https://site1.moralis-nodes.com/eth/7ea2027cf2ce47d8901d860d2abd7dfb"

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
