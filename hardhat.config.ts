import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";

import {copySync} from "fs-extra"; 
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer"
import "hardhat-gas-reporter";

dotenv.config();

task("initContracts", "Initializes `contracts` folder", async () => {
  try {
    copySync("./node_modules/@zoralabs/v3/dist/contracts", "./contracts/contracts/")
  } catch (err) {
    console.error(err)
  }
})

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ]
  },
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPriceApi: "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice",
    coinmarketcap: process.env.CMC_KEY,
    token: "BNB"
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

console.log(config.gasReporter)

export default config;
