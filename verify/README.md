# 验证 Shibarium 上的合约

`verify:shibarium` 走的是 `https://shibariumscan.io/api`，该接口目前会间歇性返回
403 / ECONNRESET / 连接超时（Cloudflare 侧限流或线路问题），导致 Hardhat 无法完成验证。
这不是合约或配置的问题。

## 文件

- `chain-109-Launcher.standard-input.json`：来自 `ignition/deployments/chain-109/`
  的部署构建，与链上字节码逐字节一致。
- 其他合约/部署可以用脚本重新生成：

  ```shell
  node scripts/export-standard-json.mjs <deployment-id> <ContractName>
  # 例如：node scripts/export-standard-json.mjs chain-109 Foo
  ```

## 方式一：运行脚本

```powershell
$env:NODE_USE_ENV_PROXY = "1"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"   # 换成你的代理端口

npm run verify:explorer -- 0x2785B3157f7b63cB4827F18219893f1E0ba57734
```

脚本会依次：检查链上字节码 → 检查是否已验证 → 提交标准 JSON → 轮询验证结果。

等价于 `node scripts/verify-explorer.mjs 0x...`。需要换合约或文件时：

```powershell
npm run verify:explorer -- <address> <standard-input.json> --contract project/contracts/Foo.sol:Foo
```

如果输出 `Just a moment...`，说明 Cloudflare 仍在拦：换一个出口 IP 再跑，或者用下面的浏览器上传。

## 方式二：浏览器上传

1. 打开 <https://shibariumscan.io/address/0x2785B3157f7b63cB4827F18219893f1E0ba57734#code>
2. 点击 **Verify & Publish**（Contract 标签页里）
3. 选择 **Solidity (Standard JSON input)**
4. 上传 `verify/chain-109-Launcher.standard-input.json`
5. 填写：
   - Compiler: `v0.8.34+commit.80d5c536`
   - Optimization: **Enabled**，Runs: `200`
   - Contract Name: 标准 JSON 模式一般不需要填；如果表单要求，填 `project/contracts/Launcher.sol:Launcher`
   - Constructor Arguments: 留空
6. 提交，等待验证结果

EVM 版本为 `osaka`（合约编译时的默认值），一般会从 JSON 自动识别。

## 为什么命令行会 403

`verify:shibarium`（以及官方文档那种 Etherscan 兼容写法 `verify etherscan`）提交验证表单时，
Shibariumscan 的 Cloudflare 会返回 `403`，响应体是 `<title>Just a moment...</title>` —— 这是
Cloudflare 的 managed challenge（`cType: 'managed'`），需要浏览器执行 JavaScript 才能通过。
Node、Hardhat、curl 都过不去；换 provider、加 `apiKey: "empty"`、换浏览器 UA 结果都一样。

浏览器能通过这个挑战，所以下面的手动上传方式最可靠。

## 官方 Hardhat 2 示例在 Hardhat 3 的对应

| BlockScout 官方示例（Hardhat 2） | 本项目（Hardhat 3） |
| --- | --- |
| `networks.shibarium.url: "https://shibariumscan.io/api/eth-rpc"` | `networks.shibarium.url` 保持官方 RPC（这个代理实测返回 `null`） |
| `etherscan.customChains[{ chainId: 109, urls: { apiURL, browserURL } }]` | `chainDescriptors[109].blockExplorers.etherscan` |
| `etherscan.apiKey: { shibarium: "empty" }` | `verify.etherscan.apiKey` 默认 `"empty"` |
| `npx hardhat verify --network shibarium 0x...` | `npx hardhat verify etherscan --network shibarium 0x...` |

## 附：命令行报 RPC 连接失败

如果 `verify:shibarium` 报 `HHE703 Cannot connect to the network`，通常是线路问题，挂代理即可：

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7897"   # 换成你的代理端口
npm run verify:shibarium -- 0x2785B3157f7b63cB4827F18219893f1E0ba57734
```

官方 RPC `https://rpc.shibarium.shib.io` 在代理下可用（已用 `eth_chainId` 和
`eth_getCode` 验证）。

不要使用 `https://109.rpc.thirdweb.com` 的公开端点：它只放行 `eth_chainId`，
会拒绝 `eth_getCode`，报 “We are not able to process your request at this time”。

即使 RPC 通了，Shibariumscan 仍可能返回 403，此时直接用上面的浏览器方式验证。
