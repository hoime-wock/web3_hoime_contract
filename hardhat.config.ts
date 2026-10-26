import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
      },
      production: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    shibarium: {
      type: "http",
      chainType: "l1",
      chainId: 109,
      url: configVariable("SHIBARIUM_RPC_URL", {
        default: "https://rpc.shibarium.shib.io",
      }),
      accounts: [configVariable("SHIBARIUM_PRIVATE_KEY")],
    },
    puppynet: {
      type: "http",
      chainType: "l1",
      chainId: 157,
      url: configVariable("PUPPYNET_RPC_URL", {
        default: "https://rpc.puppynet.shib.io",
      }),
      accounts: [configVariable("PUPPYNET_PRIVATE_KEY")],
    },
  },
  // Shibariumscan / Puppyscan 都是 Blockscout，
  // 在 chainDescriptors 里登记后，`hardhat verify blockscout` 才能找到对应 API。
  chainDescriptors: {
    109: {
      name: "shibarium",
      chainType: "l1",
      blockExplorers: {
        blockscout: {
          name: "Shibariumscan",
          url: "https://shibariumscan.io",
          apiUrl: "https://shibariumscan.io/api",
        },
      },
    },
    157: {
      name: "puppynet",
      chainType: "l1",
      blockExplorers: {
        blockscout: {
          name: "Puppyscan",
          url: "https://puppyscan.shib.io",
          apiUrl: "https://puppyscan.shib.io/api",
        },
      },
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
    // 这两条链不在 Etherscan/Sourcify 支持范围内，
    // 验证时用 `hardhat verify blockscout` 子任务，避免其他验证器报错。
    blockscout: {
      enabled: true,
      apiKey: "proapi_hEfaqU6Kk2FyCLlmtb7CxOW5tP0z7j2EqP1gSHWaaMcgdV7k6c82itBVpQ4KcWWZE_kwNew",
    },
  },
});
