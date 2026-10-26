import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ARTIFACTS_DIR = path.join("artifacts", "contracts");
const OUTPUT_DIR = "abi";

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      yield full;
    }
  }
}

const contracts = new Map();

for await (const file of walk(ARTIFACTS_DIR)) {
  const artifact = JSON.parse(await readFile(file, "utf8"));

  if (typeof artifact.contractName !== "string" || !Array.isArray(artifact.abi)) {
    continue;
  }

  // 跳过测试合约（*.t.sol）
  if (artifact.sourceName?.endsWith(".t.sol")) {
    continue;
  }

  if (contracts.has(artifact.contractName)) {
    console.warn(
      `skip duplicate "${artifact.contractName}": ${file} (already exported)`,
    );
    continue;
  }

  contracts.set(artifact.contractName, artifact);
}

if (contracts.size === 0) {
  console.error("No artifacts found. Run `npm run build` first.");
  process.exit(1);
}

await mkdir(OUTPUT_DIR, { recursive: true });

for (const name of [...contracts.keys()].sort()) {
  const artifact = contracts.get(name);
  const outPath = path.join(OUTPUT_DIR, `${name}.json`);

  await writeFile(outPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
  console.log(`${outPath}: ${artifact.abi.length} entries`);
}
