import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

const { viem, networkHelpers } = await network.create();
const publicClient = await viem.getPublicClient();

const COST = 2n * 10n ** 18n;

async function deployLauncher() {
  const launcher = await viem.deployContract("Launcher");
  return { launcher };
}

describe("Launcher (integration)", async function () {
  it("deploys with the default cost and owner", async function () {
    const { launcher } = await networkHelpers.loadFixture(deployLauncher);
    const [owner] = await viem.getWalletClients();

    assert.equal(await launcher.read.cost(), COST);
    assert.equal(
      (await launcher.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase(),
    );
  });

  it("creates a token, mints the supply and refunds the excess", async function () {
    const { launcher } = await networkHelpers.loadFixture(deployLauncher);
    const [, alice] = await viem.getWalletClients();

    const supply = 1_000_000n;
    const excess = 10n ** 18n;

    await viem.assertions.balancesHaveChanged(
      launcher.write.createToken(["Integration Token", "ITK", supply, 18], {
        account: alice.account,
        value: COST + excess,
      }),
      [
        { address: alice.account.address, amount: -COST },
        { address: launcher.address, amount: COST },
      ],
    );

    const tokenAddresses = await launcher.read.getUserTokens([
      alice.account.address,
      0n,
      10n,
    ]);
    assert.equal(tokenAddresses.length, 1);

    const token = await viem.getContractAt("MyToken", tokenAddresses[0]);

    assert.equal(await token.read.name(), "Integration Token");
    assert.equal(await token.read.symbol(), "ITK");
    assert.equal(await token.read.decimals(), 18);
    assert.equal(await token.read.totalSupply(), supply * 10n ** 18n);
    assert.equal(
      await token.read.balanceOf([alice.account.address]),
      supply * 10n ** 18n,
    );
    assert.equal(
      await launcher.read.getUserTokenCount([alice.account.address]),
      1n,
    );
  });

  it("rejects a payment below the cost", async function () {
    const { launcher } = await networkHelpers.loadFixture(deployLauncher);
    const [, alice] = await viem.getWalletClients();

    await viem.assertions.revertWith(
      launcher.write.createToken(["X", "X", 1n, 18], {
        account: alice.account,
        value: COST - 1n,
      }),
      "Launcher: insufficient fee",
    );
  });

  it("only lets the owner withdraw the collected fees", async function () {
    const { launcher } = await networkHelpers.loadFixture(deployLauncher);
    const [owner, alice, bob] = await viem.getWalletClients();

    await launcher.write.createToken(["Fee Token", "FEE", 1n, 18], {
      account: alice.account,
      value: COST,
    });

    await viem.assertions.revertWithCustomErrorWithArgs(
      launcher.write.withdraw([bob.account.address], {
        account: alice.account,
      }),
      launcher,
      "OwnableUnauthorizedAccount",
      [alice.account.address],
    );

    const amount = await publicClient.getBalance({ address: launcher.address });
    assert.equal(amount, COST);

    await viem.assertions.balancesHaveChanged(
      launcher.write.withdraw([bob.account.address], { account: owner.account }),
      [
        { address: launcher.address, amount: -amount },
        { address: bob.account.address, amount },
      ],
    );

    assert.equal(
      await publicClient.getBalance({ address: launcher.address }),
      0n,
    );
  });
});
