import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
dotenv.config();



const config: HardhatUserConfig = {

  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  networks: { 
    hardhat: {
      chainId: 31337,
    },
    
    // base_sepolia: {
    //   url: process.env.ALCHEMY_API_KEY || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    // },

    arbitrum_sepolia: {
      url: process.env.ARB_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421614, 
    }

    // sepolia:{
    //   url: process.env.SEPOLIA_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    // }

  },
  
  etherscan: {
    apiKey: {
    //   base_sepolia: process.env.BASE_SEPOLIA_RPC_URL || "",
      // sepolia: process.env.ETHERSCAN_API_KEY || "",
      arbitrum_sepolia: process.env.ARBITRUM_SEPOLIA_API_KEY || "",
    },
    customChains: [
      // {
      //   network: "base_sepolia",
      //   chainId: 84532,
      //   urls: {
      //     apiURL: "https://api-sepolia.basescan.org/v2/api?chainid=84532&apikey=",
      //     browserURL: "https://sepolia.basescan.org",
      //   },
      // },
      {
        network: "arbitrum_sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=421614",
          browserURL: "https://sepolia.arbiscan.io",
        },
      }
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;