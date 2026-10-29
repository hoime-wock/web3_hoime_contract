import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * 部署 Faucet 水龙头到 Puppynet。
 *
 * 合约没有构造参数，部署账户自动成为 owner；
 * 部署后向合约地址转入 BONE 即可开始发放。
 */
export default buildModule("FaucetModule", (m) => {
  const faucet = m.contract("Faucet");

  return { faucet };
});
