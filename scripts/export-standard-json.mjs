import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [deploymentId, contractNameArg] = process.argv.slice(2);

if (!deploymentId) {
  console.error(
    "Usage: node scripts/export-standard-json.mjs <deployment-id> [contract-name]",
  );
  console.error(
    "Example: node scripts/export-standard-json.mjs chain-109 Launcher",
  );
  process.exit(1);
}

const deploymentDir = path.join("ignition", "deployments", deploymentId);
const artifactsDir = path.join(deploymentDir, "artifacts");

let artifactFiles;
try {
  artifactFiles = (await readdir(artifactsDir)).filter((f) => f.endsWith(".json"));
} catch {
  console.error(`Deployment not found: ${deploymentDir}`);
  process.exit(1);
}

const matches = contractNameArg
  ? artifactFiles.filter((f) => f.endsWith(`#${contractNameArg}.json`))
  : artifactFiles;

if (matches.length === 0) {
  console.error(
    `No artifact for contract "${contractNameArg}" in ${artifactsDir}`,
  );
  process.exit(1);
}

if (matches.length > 1) {
  console.error(
    `Multiple artifacts found, pass the contract name explicitly: ${matches.join(", ")}`,
  );
  process.exit(1);
}

const artifact = JSON.parse(
  await readFile(path.join(artifactsDir, matches[0]), "utf8"),
);
const buildInfoPath = path.join(
  deploymentDir,
  "build-info",
  `${artifact.buildInfoId}.json`,
);
const buildInfo = JSON.parse(await readFile(buildInfoPath, "utf8"));

await mkdir("verify", { recursive: true });

const outPath = path.join(
  "verify",
  `${deploymentId}-${artifact.contractName}.standard-input.json`,
);
await writeFile(outPath, `${JSON.stringify(buildInfo.input, null, 2)}\n`);

const { optimizer, evmVersion } = buildInfo.input.settings;

console.log(`wrote ${outPath}`);
console.log(`contract : project/${artifact.sourceName}:${artifact.contractName}`);
console.log(`compiler : v${buildInfo.solcLongVersion}`);
console.log(`optimizer: enabled=${optimizer?.enabled} runs=${optimizer?.runs}`);
console.log(`evm      : ${evmVersion ?? "(compiler default)"}`);
