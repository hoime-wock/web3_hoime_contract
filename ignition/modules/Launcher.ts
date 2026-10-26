import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * 部署 Launcher 工厂合约。
 *
 * 部署后 owner 为部署账户，cost 默认为 2 ETH；
 * 可通过 `setCost` 调整费用，通过 `withdraw(to)` 提取累计费用。
 */
export default buildModule("LauncherModule", (m) => {
  const launcher = m.contract("Launcher");

  return { launcher };
});
