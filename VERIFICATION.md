# 合约验证记录与操作指南

> 最后更新：2026-10-30
> 目的：记录当前部署的验证状态、已经踩过的坑，以及以后有空时如何补验证。

## 1. 当前状态

| 网络 | chainId | 合约 | 地址 | 验证状态 |
| --- | --- | --- | --- | --- |
| Shibarium 主网 | 109 | `Launcher` | `0x2785B3157f7b63cB4827F18219893f1E0ba57734` | ❌ Shibariumscan 未验证；✅ Sourcify `exact_match` |
| Puppynet 测试网 | 157 | `Launcher` | `0x2785B3157f7b63cB4827F18219893f1E0ba57734` | ✅ Puppyscan 已验证 |

两个链地址相同，是因为同一个部署账户、同一个 nonce；这是正常的。

部署相关参数：

| 项 | 值 |
| --- | --- |
| 部署者 / owner | `0x516BC75c7E0f013b6928B88B994f2D3c2EBc4fcD` |
| `cost` | `2 BONE` |
| 编译器 | `v0.8.34+commit.80d5c536` |
| Optimizer | enabled, runs `200` |
| EVM version | `osaka` |
| 运行时字节码 | 6,440 字节 |
| 链上 metadata hash | `d137daa948ad30b4f9de90caf9027fa7c43987efcc9aa62368533e801a05c30e` |

## 2. 重要：源码目录已经移动

部署时的源码路径是：

```text
contracts/Launcher.sol
contracts/MyToken.sol
```

后来移动成了：

```text
contracts/01-Launcher/Launcher.sol
contracts/01-Launcher/MyToken.sol
contracts/01-Launcher/Launcher.t.sol
```

Solidity 的 metadata 里包含**源文件路径**，所以移动后重新编译：

- 运行时字节码同样是 6,440 字节；
- 但 metadata 变成 `752115fbea03046a4917d35cc0def2ab7a520a159c956705f99f5e88c4431102`；
- 和链上的 `d137…` 不再一致。

**结论：已部署的两个合约，不能用当前目录重新编译后跑 `hardhat verify`；必须使用部署时保存的标准 JSON。**

移动目录不影响新部署的合约——新合约用新路径编译，验证时用新生成的标准 JSON 即可。

## 3. 必须保留的文件（不要删）

| 文件 / 目录 | 作用 |
| --- | --- |
| `verify/chain-109-Launcher.standard-input.json` | 部署时的标准 JSON，源码路径是旧的 `project/contracts/Launcher.sol`，与链上字节码完全匹配 |
| `ignition/deployments/chain-109/` | 主网部署记录：`deployed_addresses.json`、`journal.jsonl`、artifact、build-info |
| `ignition/deployments/chain-157/` | 测试网部署记录，同上 |
| git commit `500cec7` | 移动前的旧目录结构，可以用 `git show` 取回源码 |
| Sourcify 记录 | 已经 `exact_match`，可作为独立验证来源 |

建议给这个 commit 打个 tag，防止以后找不到：

```shell
git tag deploy-2026-10-24 500cec7
```

## 4. 验证 Shibarium 主网（未完成）

### 方式 A：项目脚本（推荐）

```powershell
$env:NODE_USE_ENV_PROXY = "1"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"   # 换成自己的代理端口

npm run verify:explorer -- 0x2785B3157f7b63cB4827F18219893f1E0ba57734
```

脚本会：

1. 用 RPC 读链上字节码；
2. 检查是否已经验证；
3. 把 `verify/chain-109-Launcher.standard-input.json` 提交到 Shibariumscan；
4. 轮询 `checkverifystatus` 并打印结果。

退出码：`0` 成功/已验证，`1` 失败，`2` 被 Cloudflare 挑战。

如果输出 `Just a moment...`，说明 Cloudflare 在拦验证请求。可以：

- 换一个出口 IP（换代理节点、手机热点）后重跑；
- 或者用方式 B。

### 方式 B：浏览器上传

1. 打开：
   <https://shibariumscan.io/address/0x2785B3157f7b63cB4827F18219893f1E0ba57734/contract-verification>
2. 选择 **Solidity (Standard JSON input)**
3. 上传 `verify/chain-109-Launcher.standard-input.json`
4. 填写：
   - Compiler: `v0.8.34+commit.80d5c536`
   - Optimization: **Enabled**，Runs: `200`
   - Constructor Arguments: 留空
   - Contract Name: 标准 JSON 模式一般自动识别；若要求填写，填 `project/contracts/Launcher.sol:Launcher`
5. 提交。如果页面弹出 Cloudflare 人机验证，手动完成即可。

> 注意：Shibariumscan 的验证接口目前对部分网络/请求返回 403（Cloudflare managed challenge），
> 这不是合约或请求内容的问题。换网络或直接用浏览器页面提交即可。

### 方式 C：Sourcify（已经完成）

Sourcify 上已经是 `exact_match`：

- 页面：<https://sourcify.dev/server/repo-ui/109/0x2785B3157f7b63cB4827F18219893f1E0ba57734>
- 验证时间：`2026-10-24T13:52:02Z`
- `creationMatch: exact_match`，`runtimeMatch: exact_match`

再次执行会提示已验证：

```shell
npx hardhat verify sourcify --network shibarium 0x2785B3157f7b63cB4827F18219893f1E0ba57734
```

Shibariumscan 当前没有启用 Sourcify 导入（`verification_options` 里没有 sourcify），
所以 Sourcify 的验证不会自动出现在它的页面上。

## 5. 重新生成标准 JSON

即使目录移动了，也可以从部署记录重新生成**旧路径**的标准 JSON：

```shell
node scripts/export-standard-json.mjs chain-109 Launcher
```

它读取 `ignition/deployments/chain-109/build-info/` 里的部署构建，不读当前 `contracts/`，
所以生成出来的仍然是 `project/contracts/Launcher.sol`，不会因为移动目录而失效。

输出文件名：`verify/chain-109-Launcher.standard-input.json`。

新部署的合约：

```shell
node scripts/export-standard-json.mjs chain-157 Foo
# 生成 verify/chain-157-Foo.standard-input.json
```

脚本会打印合约全名、编译器版本、optimizer、EVM 版本，直接照抄到验证页面即可。

## 6. 以后新部署的合约怎么验证

### Puppynet / 支持 Blockscout 的链

```shell
npx hardhat build --build-profile production
npx hardhat verify blockscout --network puppynet 0x新地址 [构造参数...]
```

如果报 `HHE80009`，说明本地 artifacts 不是 production 构建，重新执行上面的
`hardhat build --build-profile production` 即可。

### Shibarium 主网

```shell
node scripts/export-standard-json.mjs chain-109 Foo
npm run verify:explorer -- 0x新地址 verify/chain-109-Foo.standard-input.json `
  --contract project/contracts/01-Launcher/Foo.sol:Foo
```

`--contract` 用脚本打印出来的全名；新目录下是 `project/contracts/01-Launcher/...`。

### 工厂创建的合约（比如 `MyToken`）

没有 Ignition 部署记录，需要手动传构造参数：

```text
initialOwner, name, symbol, totalSupply（未乘精度）, decimals
```

Shibarium 上可以用本项目的构建 + 浏览器标准 JSON，构造参数按顺序填。

## 7. 常见错误对照

| 错误 | 原因 | 处理 |
| --- | --- | --- |
| `HHE80009: bytecode does not match any of your local contracts` | 本地产物与链上字节码不一致（profile 或源码路径不同） | 旧合约用旧标准 JSON；新合约先 `hardhat build --build-profile production` |
| `HHE80001 ... 403 Forbidden` | Shibariumscan 的 Cloudflare 拦截 | 换出口 IP；或用浏览器页面提交 |
| `HHE703 Cannot connect to the network` | RPC 连不上 | 挂代理；官方 RPC `https://rpc.shibarium.shib.io` |
| `We are not able to process your request` | 用了 thirdweb 公开 RPC | 它不支持 `eth_getCode`，换回官方 RPC |
| `already verified` | 已经验证过 | 无需操作；需要重验加 `--force` |

## 8. 后续部署检查清单

- [ ] 部署后保留 `ignition/deployments/chain-<id>/`
- [ ] 生成并备份标准 JSON（`verify/...`）
- [ ] 记录地址、源码路径、编译器版本、optimizer 参数
- [ ] git commit + tag（例如 `deploy-2026-10-24`）
- [ ] 验证：Puppynet 用 `hardhat verify`；Shibarium 用 `verify:explorer` 或浏览器
- [ ] Sourcify 作为独立兜底：`npx hardhat verify sourcify --network shibarium 0x...`
- [ ] **不要移动已部署合约的源码路径**；如果必须移动，先保留旧路径副本或标准 JSON

## 9. 遗留事项

- `hardhat.config.ts` 里 `verify.blockscout.apiKey` 目前是明文写死的，建议移到 keystore：
  `npx hardhat keystore set BLOCKSCOUT_API_KEY`，再把配置改成
  `apiKey: configVariable("BLOCKSCOUT_API_KEY", { default: "" })`。
- Shibariumscan 的验证服务恢复后，优先用方式 A 或 B 把主网补上。
- Sourcify 已 `exact_match`，即使 Shibariumscan 一直不可用，也算有独立验证记录。
