# web3_hoime_contract

基于 **Hardhat 3 + viem** 的 ERC20 代币创建（launchpad）合约项目。

用户向 `Launcher` 支付固定费用，即可部署一个自定义名称、符号、总量和精度的 `MyToken`（OpenZeppelin ERC20）。
多付的 ETH 会在同一笔交易中退还；owner 可以调整创建费用并提取累计费用。

## 目录结构

```
contracts/
  Launcher.sol        # 代币工厂：收费、部署、退款、提现
  MyToken.sol         # 固定供应量的 ERC20，支持自定义精度
  Launcher.t.sol      # Solidity 单元测试（forge-std）
test/
  launcher.ts         # TypeScript 集成测试（node:test + viem）
ignition/modules/
  Launcher.ts         # Ignition 部署模块
abi/
  Launcher.json       # 导出的 ABI（前端 / 脚本使用）
  MyToken.json
scripts/
  export-abi.mjs      # 从编译产物导出 ABI
  send-op-tx.ts       # Hardhat 官方示例脚本（OP 链发送交易）
hardhat.config.ts
```

## 环境要求

- Node.js 22.13 及以上（本项目在 Node.js v24 上验证）
- npm

## 安装

```shell
npm install
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run build` | 编译合约（`hardhat build`） |
| `npm run test` | 运行全部测试（Solidity + TypeScript） |
| `npm run test:solidity` | 只运行 Solidity 单元测试 |
| `npm run test:nodejs` | 只运行 TypeScript 集成测试 |
| `npm run typecheck` | 类型检查（`tsc --noEmit`，需先 build） |
| `npm run export:abi` | 从编译产物导出 ABI 到 `abi/` |
| `npm run clean` | 清理 `artifacts/` 和 `cache/` |
| `npm run deploy:local` | 部署到本地模拟网络 |
| `npm run deploy:sepolia` | 部署到 Sepolia 并验证源码 |
| `npm run deploy:shibarium` | 部署到 Shibarium 主网 |
| `npm run deploy:puppynet` | 部署到 Puppynet 测试网 |
| `npm run verify:sepolia` | 单独验证 Sepolia 上的部署 |
| `npm run verify:shibarium` | 在 Shibariumscan 验证合约（需追加地址） |
| `npm run verify:puppynet` | 在 Puppyscan 验证合约（需追加地址） |

也可以直接使用 `npx hardhat <task>`。

## 测试

```shell
npx hardhat test            # 全部
npx hardhat test solidity   # contracts/Launcher.t.sol
npx hardhat test nodejs     # test/launcher.ts
```

- Solidity 单元测试覆盖：构造参数、正常创建、自定义精度、找零、事件、费用不足、精度超限、零供应量、分页边界、`setCost` / `withdraw` 权限与零地址。
- TypeScript 集成测试覆盖：部署、创建代币并校验元数据与余额变化、费用不足回滚、非 owner 无法提现。

收集覆盖率：

```shell
npx hardhat test --coverage
```

## 配置变量

私钥是必填项；两条 Shibarium 网络的 RPC 地址已内置默认值，只有想换节点时才需要覆盖：

| 变量 | 用途 |
| --- | --- |
| `SEPOLIA_RPC_URL` | Sepolia RPC 节点地址 |
| `SEPOLIA_PRIVATE_KEY` | 部署账户私钥（需要有 Sepolia ETH） |
| `SHIBARIUM_PRIVATE_KEY` | Shibarium 部署账户私钥（需要有 BONE 支付 gas） |
| `PUPPYNET_PRIVATE_KEY` | Puppynet 部署账户私钥（测试网 BONE） |
| `SHIBARIUM_RPC_URL` | 可选，覆盖默认的 `https://rpc.shibarium.shib.io` |
| `PUPPYNET_RPC_URL` | 可选，覆盖默认的 `https://rpc.puppynet.shib.io` |
| `ETHERSCAN_API_KEY` | Etherscan API Key，用于 Sepolia 源码验证 |

推荐用 Hardhat keystore 保存私钥（加密存储，不会落进仓库）：

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set SHIBARIUM_PRIVATE_KEY
npx hardhat keystore set PUPPYNET_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
```

需要自定义 RPC 节点时，再设置对应的 `*_RPC_URL`（keystore 或环境变量均可）。

也可以直接设置环境变量（Hardhat 3 不会自动读取 `.env` 文件）：

```powershell
$env:SEPOLIA_RPC_URL = "https://..."
$env:SEPOLIA_PRIVATE_KEY = "0x..."
$env:SHIBARIUM_PRIVATE_KEY = "0x..."
$env:PUPPYNET_PRIVATE_KEY = "0x..."
$env:ETHERSCAN_API_KEY = "..."
```

## 部署

本地模拟网络（进程退出后状态丢失）：

```shell
npx hardhat ignition deploy ignition/modules/Launcher.ts
```

Sepolia（部署完成后自动验证）：

```shell
npx hardhat ignition deploy ignition/modules/Launcher.ts --network sepolia --verify
```

部署记录保存在 `ignition/deployments/chain-11155111/`。之后可以单独重新验证：

```shell
npx hardhat ignition verify chain-11155111
```

### Shibarium / Puppynet

| 网络 | Chain ID | RPC | 浏览器 | Gas 代币 |
| --- | --- | --- | --- | --- |
| Shibarium | 109 | `https://rpc.shibarium.shib.io` | <https://shibariumscan.io> | BONE |
| Puppynet | 157 | `https://rpc.puppynet.shib.io` | <https://puppyscan.shib.io> | BONE |

```shell
# Shibarium 主网
npx hardhat ignition deploy ignition/modules/Launcher.ts --network shibarium

# Puppynet 测试网
npx hardhat ignition deploy ignition/modules/Launcher.ts --network puppynet
```

两个浏览器都是 Blockscout，验证时用 `blockscout` 子任务（Launcher 构造函数没有参数，直接传地址即可）：

```shell
npx hardhat verify blockscout --network shibarium <Launcher 地址>
npx hardhat verify blockscout --network puppynet <Launcher 地址>
```

对应的 npm 脚本：

```shell
npm run verify:shibarium -- <Launcher 地址>
npm run verify:puppynet -- <Launcher 地址>
```

> 不要把 `--verify` 加在 `ignition deploy` 上，也不要用 `ignition verify chain-109`：Ignition 的验证会依次尝试所有启用的验证器，而这两条链不在 Etherscan/Sourcify 的支持范围内，会先报错。用上面的 `verify blockscout` 子任务可以只跑 Blockscout。

部署记录分别保存在 `ignition/deployments/chain-109/` 和 `ignition/deployments/chain-157/`。

## 合约说明

### Launcher

| 成员 | 说明 |
| --- | --- |
| `cost()` | 当前创建费用，默认 `2 ether` |
| `createToken(name, symbol, totalSupply, decimals)` | 支付 `cost` 部署一个新代币；多余的 ETH 原路退回；返回代币地址 |
| `setCost(newCost)` | 仅 owner，更新创建费用，不能为 0 |
| `withdraw(to)` | 仅 owner，把合约内全部 ETH 提取到 `to`，`to` 不能是零地址 |
| `getUserTokens(user, offset, limit)` | 分页查询某用户创建的全部代币地址 |
| `getUserTokenCount(user)` | 某用户创建的代币总数 |

事件：`Pay`、`Refund`、`TokenCreate`、`Withdrawals`、`UpdateCost`。

### MyToken

- 固定供应量：构造时一次性 `_mint` 给创建者，没有增发函数。
- 自定义精度：`decimals <= 18`，通过重写 `decimals()` 实现。
- 不继承 `Ownable`，部署后没有任何管理员权限。

## 新增合约如何验证

新增 `contracts/Foo.sol` 后，流程和 `Launcher` 完全一样：

1. 写测试并编译：

   ```shell
   npm run build
   npm run test
   ```

2. 新建 `ignition/modules/Foo.ts`，部署到目标网络：

   ```shell
   npx hardhat ignition deploy ignition/modules/Foo.ts --network puppynet
   ```

3. 用部署输出里的地址验证（Shibarium / Puppynet 都用 `blockscout` 子任务）：

   ```shell
   # 无构造参数
   npx hardhat verify blockscout --network puppynet 0x合约地址

   # 有构造参数：按构造函数顺序跟在地址后面
   npx hardhat verify blockscout --network puppynet 0x合约地址 "name" 1000000 18

   # 参数是数组 / 结构体：用参数文件
   npx hardhat verify blockscout --network puppynet --constructor-args-path scripts/foo-args.ts 0x合约地址
   ```

   `scripts/foo-args.ts` 默认导出一个参数数组：

   ```ts
   export default ["name", 1000000n, 18];
   ```

4. 多个合约字节码相同、无法自动识别时，用 `--contract` 指定：

   ```shell
   npx hardhat verify blockscout --network puppynet --contract contracts/Foo.sol:Foo 0x合约地址
   ```

5. Shibarium 主网如果 `hardhat verify` 被 Cloudflare 拦（403），改用独立脚本，先生成标准 JSON：

   ```shell
   node scripts/export-standard-json.mjs chain-109 Foo
   npm run verify:explorer -- 0x地址 verify/chain-109-Foo.standard-input.json --contract project/contracts/Foo.sol:Foo
   ```

   脚本不依赖 Hardhat 的 build profile 和 keystore，直接向浏览器 API 提交标准 JSON。

注意事项：

- Ignition 部署和 `verify` 默认都用 `production` build profile；如果部署时用了 `--build-profile default`，验证时也要加同名的 `--build-profile`，否则字节码对不上。
- 如果 `verify` 报 `HHE80009: bytecode does not match any of your local contracts`，通常就是本地产物被 `npm run build`（default profile）覆盖了。先 `npx hardhat build --build-profile production` 再验证。
- 必须用**部署时的同一份源码和编译设置**验证；部署后哪怕只改注释，metadata hash 也会变，只能用部署时的代码重新验证。
- 验证是按地址的：同一个合约部署到多条链或多个地址，要分别验证。
- 工厂创建的合约（比如 `MyToken`）要手动传构造参数：`initialOwner`、`name`、`symbol`、未乘精度的 `totalSupply`、`decimals`。
- 用 `verify blockscout` 子任务；不要用不带子任务的 `hardhat verify`，它会依次尝试 Etherscan、Blockscout、Sourcify，在这些链上会因不支持的验证器报错退出。
- 被 Cloudflare 拦时，用独立脚本 `npm run verify:explorer -- 0x合约地址`（不依赖 Hardhat 的 build profile 或 keystore）；具体见 [verify/README.md](verify/README.md)。

## ABI

ABI 是合约接口描述（函数名、参数、返回值、事件），不包含实现逻辑或私钥，前端和脚本靠它来编码调用数据。

Hardhat 默认不生成独立的 `.abi` 文件，ABI 在编译产物的 `abi` 字段里：

- `artifacts/contracts/Launcher.sol/Launcher.json`
- `artifacts/contracts/MyToken.sol/MyToken.json`

为方便前端使用，可以直接导出成独立文件：

```shell
npm run build
npm run export:abi
```

脚本会自动扫描 `artifacts/contracts/` 下所有非测试合约（`*.t.sol` 会跳过），每个合约生成一个 `abi/<ContractName>.json`。新增合约后重新执行这两条命令即可，不需要改脚本。

已部署的合约也可以在浏览器上取 ABI：

- Puppyscan / Shibariumscan 的合约页面 → **Contract** 标签 → 源码区域下方的 **ABI** 区块（可展开、可复制）
- 或直接请求 API：

  ```text
  https://puppyscan.shib.io/api?module=contract&action=getabi&address=<合约地址>
  https://shibariumscan.io/api?module=contract&action=getabi&address=<合约地址>
  ```

  `result` 字段就是 ABI 的 JSON 字符串。

## 安全说明

- `withdraw` 和 `setCost` 受 `onlyOwner` 保护；owner 权限请使用多签或可信地址。
- `createToken` / `withdraw` 使用 `ReentrancyGuard`，并且先更新状态再执行外部调用（checks-effects-interactions）。
- `withdraw` 拒绝零地址，避免 owner 放弃所有权后把资金发送到 `address(0)`。
- 本项目尚未经过第三方审计，请勿直接用于主网生产环境。
