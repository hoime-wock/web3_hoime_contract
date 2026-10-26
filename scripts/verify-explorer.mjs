import { readFile } from "node:fs/promises";
import querystring from "node:querystring";

const args = process.argv.slice(2);
const address = args[0];

if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error(`
Usage:
  node scripts/verify-explorer.mjs <address> [standard-input.json] [options]

Options:
  --contract <fqn>   合约全名，默认 project/contracts/Launcher.sol:Launcher
  --compiler <ver>   编译器版本，默认 v0.8.34+commit.80d5c536
  --api <url>        浏览器 API，默认 https://shibariumscan.io/api
  --rpc <url>        RPC，默认 SHIBARIUM_RPC_URL 或官方 RPC

Environment:
  CF_CLEARANCE       Cloudflare 的 cf_clearance cookie（可选，见 README）
  VERIFY_UA          与获取 cookie 时一致的浏览器 User-Agent
`);
  process.exit(1);
}

function option(name, fallback) {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

const inputPath =
  args[1] && !args[1].startsWith("--")
    ? args[1]
    : "verify/chain-109-Launcher.standard-input.json";
const contractName = option(
  "--contract",
  "project/contracts/Launcher.sol:Launcher",
);
const compiler = option("--compiler", "v0.8.34+commit.80d5c536");
const api = option("--api", "https://shibariumscan.io/api").replace(/\/+$/, "");
const rpc = option(
  "--rpc",
  process.env.SHIBARIUM_RPC_URL ?? "https://rpc.shibarium.shib.io",
);

const headers = {
  "user-agent":
    process.env.VERIFY_UA ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
};

if (process.env.CF_CLEARANCE) {
  headers.cookie = `cf_clearance=${process.env.CF_CLEARANCE}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, init = {}, timeoutMs = 60_000) {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  return { response, text };
}

function isChallenge(text) {
  return text.includes("Just a moment") || text.includes("cf_chl_opt");
}

function challengeMessage() {
  return `
Shibariumscan 返回了 Cloudflare 人机验证页（Just a moment...），命令行无法完成 JavaScript 挑战。

可以：
1. 换一个出口 IP（换代理节点、手机热点等）后重新运行本命令；
2. 用浏览器打开验证页面，上传 ${inputPath}（Solidity Standard JSON input 模式）。
`;
}

async function rpcCall(method, params) {
  const { response, text } = await request(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed: HTTP ${response.status}`);
  }

  const body = JSON.parse(text);
  if (body.error) {
    throw new Error(`RPC ${method} failed: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

function networkMessage(error) {
  return `
网络请求失败：${error.message}

如果直连不稳定，可以用 Node 24 内置的代理支持运行：
  $env:NODE_USE_ENV_PROXY = "1"
  $env:HTTPS_PROXY = "http://127.0.0.1:7897"   # 换成你的代理端口
  node scripts/verify-explorer.mjs ${address}
`;
}

console.log(`Checking contract on-chain: ${address}`);
let code;
try {
  code = await rpcCall("eth_getCode", [address, "latest"]);
} catch (error) {
  console.error(networkMessage(error));
  process.exit(1);
}

if (code === "0x" || code === undefined) {
  console.error(`No bytecode at ${address} on ${rpc}`);
  process.exit(1);
}
console.log(`On-chain bytecode: ${(code.length - 2) / 2} bytes`);

console.log("Checking current verification status...");
try {
  const status = await request(
    `${api}?module=contract&action=getsourcecode&address=${address}`,
  );
  if (status.response.ok && !isChallenge(status.text)) {
    try {
      const info = JSON.parse(status.text).result?.[0];
      if (info?.SourceCode) {
        console.log(
          `Already verified: ${info.ContractName} (${info.CompilerVersion})`,
        );
        process.exit(0);
      }
    } catch {
      // 忽略解析失败，继续提交
    }
  }
} catch (error) {
  console.warn(`Status check failed (${error.message}); continuing.`);
}

const input = JSON.parse(await readFile(inputPath, "utf8"));
console.log(`Submitting ${inputPath} as ${contractName} (${compiler})...`);

const body = querystring.stringify({
  contractaddress: address,
  sourceCode: JSON.stringify(input),
  codeformat: "solidity-standard-json-input",
  contractname: contractName,
  compilerversion: compiler,
  constructorArguments: "",
});

let submit;
try {
  submit = await request(
    `${api}?module=contract&action=verifysourcecode&apikey=empty&chainid=109`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
    120_000,
  );
} catch (error) {
  console.error(networkMessage(error));
  process.exit(1);
}

if (isChallenge(submit.text)) {
  console.error(challengeMessage());
  process.exit(2);
}

let submitBody;
try {
  submitBody = JSON.parse(submit.text);
} catch {
  console.error(`Unexpected response (HTTP ${submit.response.status}):`);
  console.error(submit.text.slice(0, 500));
  process.exit(1);
}

if (submitBody.status !== "1") {
  console.error(`Submission rejected: ${JSON.stringify(submitBody)}`);
  process.exit(1);
}

const guid = submitBody.result;
console.log(`Submitted. GUID: ${guid}`);
console.log("Waiting for verification result (up to 3 minutes)...");

let finalMessage;
for (let attempt = 1; attempt <= 60; attempt++) {
  await sleep(3000);

  let poll;
  try {
    poll = await request(
      `${api}?module=contract&action=checkverifystatus&guid=${guid}&apikey=empty&chainid=109`,
    );
  } catch (error) {
    console.error(networkMessage(error));
    process.exit(1);
  }

  if (isChallenge(poll.text)) {
    console.error(challengeMessage());
    process.exit(2);
  }

  let pollBody;
  try {
    pollBody = JSON.parse(poll.text);
  } catch {
    continue;
  }

  const message = String(pollBody.result ?? pollBody.message ?? "");
  if (message.toLowerCase().includes("pending")) {
    if (attempt % 5 === 0) {
      console.log(`  still pending (${attempt * 3}s)`);
    }
    continue;
  }

  finalMessage = message;
  break;
}

console.log(`Result: ${finalMessage ?? "timeout, check the explorer page"}`);

try {
  const finalStatus = await request(
    `${api}?module=contract&action=getsourcecode&address=${address}`,
  );
  if (finalStatus.response.ok && !isChallenge(finalStatus.text)) {
    const info = JSON.parse(finalStatus.text).result?.[0];
    if (info?.SourceCode) {
      console.log(`Verified: ${info.ContractName} (${info.CompilerVersion})`);
      console.log(`Explorer: https://shibariumscan.io/address/${address}#code`);
      process.exit(0);
    }
  }
} catch {
  // 网络失败时保留上面的 Result 输出
}

process.exit(1);
