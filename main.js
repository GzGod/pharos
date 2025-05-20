require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const randomUseragent = require('random-useragent');
const axios = require('axios');

// ===== 配置区 =====
const network = {
  name: 'Pharos Testnet',
  chainId: 688688,
  rpcUrl: 'https://testnet.dplabs-internal.com',
  nativeCurrency: 'PHRS',
};

const tokens = {
  USDC: { address: '0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37', decimals: 6 },
  WPHRS: { address: '0x76aaada469d23216be5f7c596fa25f282ff9b364', decimals: 18 },
};

const contractAddress = '0x1a4de519154ae51200b0ad7c90f7fac75547888a';
const multicallABI = ['function multicall(uint256 collectionAndSelfcalls, bytes[] data) public'];
const erc20ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
];

// ===== 日志输出 =====
const colors = {
  reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', white: '\x1b[37m', bold: '\x1b[1m',
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  wallet: (msg) => console.log(`${colors.yellow}[➤] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
};

const printBanner = () => {
  const asciiArt = [
    "               ╔═╗╔═╦╗─╔╦═══╦═══╦═══╦═══╗",
    "               ╚╗╚╝╔╣║─║║╔══╣╔═╗║╔═╗║╔═╗║",
    "               ─╚╗╔╝║║─║║╚══╣║─╚╣║─║║║─║║",
    "               ─╔╝╚╗║║─║║╔══╣║╔═╣╚═╝║║─║║",
    "               ╔╝╔╗╚╣╚═╝║╚══╣╚╩═║╔═╗║╚═╝║",
    "               ╚═╝╚═╩═══╩═══╩═══╩╝─╚╩═══╝"
  ];
  const infoLines = [
    "               关注tg频道：t.me/xuegaoz",
    "               我的gihub：github.com/Gzgod",
    "               我的推特：推特雪糕战神@Xuegaogx"
  ];

  console.log(`${colors.cyan}${colors.bold}`);
  asciiArt.forEach(line => console.log(line));
  console.log();
  infoLines.forEach(line => console.log(line));
  console.log(`${colors.reset}\n`);
};

// ===== 工具函数 =====
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, maxAttempts = 3, delayMs = 2000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      logger.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
};

const claimFaucet = async (wallet, proxy = null) => {
  try {
    logger.step(`开始领取水龙头 - ${wallet.address}`);
    const message = "pharos";
    const signature = await wallet.signMessage(message);

    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=S6NGMzXSCDBxhnwo`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": randomUseragent.getRandom(),
    };

    const loginResponse = await retry(async () => {
      const res = await axios.post(loginUrl, {}, {
        headers,
        httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      });
      if (res.status === 403) throw new Error('403 Forbidden: Check API access or proxy');
      return res;
    });

    const jwt = loginResponse.data?.data?.jwt;
    if (!jwt) {
      logger.warn('水龙头登录失败');
      return;
    }

    const statusResponse = await retry(async () => {
      const res = await axios.get(`https://api.pharosnetwork.xyz/faucet/status?address=${wallet.address}`, {
        headers: { ...headers, authorization: `Bearer ${jwt}` },
        httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      });
      if (res.status === 403) throw new Error('403 Forbidden: Check JWT or API restrictions');
      return res;
    });

    const available = statusResponse.data?.data?.is_able_to_faucet;
    if (!available) {
      const nextAvailable = new Date(statusResponse.data?.data?.avaliable_timestamp * 1000).toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
      logger.warn(`今日水龙头已领取，下一可用时间：${nextAvailable}`);
      return;
    }

    const claimResponse = await retry(async () => {
      const res = await axios.post(`https://api.pharosnetwork.xyz/faucet/daily?address=${wallet.address}`, {}, {
        headers: { ...headers, authorization: `Bearer ${jwt}` },
        httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      });
      if (res.status === 403) throw new Error('403 Forbidden: Check API access or rate limits');
      return res;
    });

    if (claimResponse.data?.code === 0) {
      logger.success('水龙头领取成功');
    } else {
      logger.warn(`水龙头领取失败：${claimResponse.data?.msg || '未知错误'}`);
    }
  } catch (e) {
    logger.error(`领取水龙头异常：${e.message}`);
    if (e.response) {
      logger.error(`响应详情：${JSON.stringify(e.response.data, null, 2)}`);
    }
  }
};

const performCheckIn = async (wallet, proxy = null) => {
  try {
    logger.step(`开始每日签到 - ${wallet.address}`);
    const message = "pharos";
    const signature = await wallet.signMessage(message);
    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=S6NGMzXSCDBxhnwo`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": randomUseragent.getRandom(),
    };

    const loginRes = await retry(async () => {
      const res = await axios.post(loginUrl, {}, {
        headers,
        httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      });
      if (res.status === 403) throw new Error('403 Forbidden: Check API access or proxy');
      return res;
    });

    const jwt = loginRes.data?.data?.jwt;
    if (!jwt) {
      logger.warn('签到登录失败');
      return;
    }

    const signRes = await retry(async () => {
      const res = await axios.post(`https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`, {}, {
        headers: { ...headers, authorization: `Bearer ${jwt}` },
        httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      });
      if (res.status === 403) throw new Error('403 Forbidden: Check JWT or API restrictions');
      return res;
    });

    if (signRes.data?.code === 0) {
      logger.success('签到成功');
    } else {
      logger.warn(`签到失败或已签过：${signRes.data?.msg || '未知错误'}`);
    }
  } catch (e) {
    logger.error(`签到异常：${e.message}`);
    if (e.response) {
      logger.error(`响应详情：${JSON.stringify(e.response.data, null, 2)}`);
    }
  }
};

const transferPHRS = async (wallet, provider) => {
  try {
    for (let i = 0; i < 10; i++) {
      const amount = 0.000001;
      const to = ethers.Wallet.createRandom().address;
      const balance = await provider.getBalance(wallet.address);
      const required = ethers.parseEther(amount.toString());
      if (balance < required) {
        logger.warn(`PHRS 余额不足，跳过转账 ${i + 1}`);
        return;
      }
      const tx = await wallet.sendTransaction({
        to,
        value: required,
        gasLimit: 21000,
        gasPrice: 0,
      });
      logger.loading(`转账 ${i + 1} 发出，等待确认...`);
      await tx.wait();
      logger.success(`转账 ${i + 1} 成功: ${tx.hash}`);
      await delay(1000 + Math.random() * 2000);
    }
  } catch (e) {
    logger.error(`转账异常：${e.message}`);
    if (e.transaction) {
      logger.error(`交易详情：${JSON.stringify(e.transaction, null, 2)}`);
    }
    if (e.receipt) {
      logger.error(`收据：${JSON.stringify(e.receipt, null, 2)}`);
    }
  }
};

const performSwap = async (wallet, provider) => {
  try {
    const pairs = [
      { from: 'WPHRS', to: 'USDC', amount: 0.001 },
      { from: 'USDC', to: 'WPHRS', amount: 0.1 },
    ];
    const contract = new ethers.Contract(contractAddress, multicallABI, wallet);

    for (let i = 0; i < 10; i++) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const token = tokens[pair.from];
      const decimals = token.decimals;
      const amount = ethers.parseUnits(pair.amount.toString(), decimals);
      const tokenContract = new ethers.Contract(token.address, erc20ABI, wallet);
      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance < amount) {
        logger.warn(`${pair.from} 余额不足，跳过 swap ${i + 1}`);
        return;
      }
      const allowance = await tokenContract.allowance(wallet.address, contractAddress);
      if (allowance < amount) {
        const approveTx = await tokenContract.approve(contractAddress, ethers.MaxUint256);
        await approveTx.wait();
        logger.success('授权成功');
      }
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
        [
          tokens[pair.from].address,
          tokens[pair.to].address,
          500,
          wallet.address,
          pair.from === 'WPHRS' ? '0x0000002386f26fc10000' : '0x016345785d8a0000',
          0,
          0,
        ]
      );
      const tx = await contract.multicall(
        Math.floor(Date.now() / 1000),
        [ethers.concat(['0x04e45aaf', data])],
        { gasLimit: 219249, gasPrice: 0 }
      );
      logger.loading(`Swap ${i + 1} 发出，等待确认...`);
      await tx.wait();
      logger.success(`Swap ${i + 1} 成功: ${tx.hash}`);
      await delay(1000 + Math.random() * 2000);
    }
  } catch (e) {
    logger.error(`Swap 执行异常：${e.message}`);
    if (e.transaction) {
      logger.error(`交易详情：${JSON.stringify(e.transaction, null, 2)}`);
    }
    if (e.receipt) {
      logger.error(`收据：${JSON.stringify(e.receipt, null, 2)}`);
    }
  }
};

const loadProxies = () => {
  try {
    return fs.readFileSync('proxies.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    logger.warn('未找到 proxies.txt，使用直连模式');
    return [];
  }
};

const getRandomProxy = (proxies) => proxies[Math.floor(Math.random() * proxies.length)];

const initProvider = (proxy = null) => {
  const options = { chainId: network.chainId, name: network.name };
  if (proxy) {
    logger.info(`使用代理：${proxy}`);
    const agent = new HttpsProxyAgent(proxy);
    return new ethers.JsonRpcProvider(network.rpcUrl, options, {
      fetchOptions: { agent },
      headers: { 'User-Agent': randomUseragent.getRandom() },
    });
  } else {
    logger.info('使用直连模式');
    return new ethers.JsonRpcProvider(network.rpcUrl, options);
  }
};

const waitCountdown = async (minutes = 30) => {
  const totalSeconds = minutes * 60;
  logger.info(`开始等待 ${minutes} 分钟...`);

  for (let s = totalSeconds; s >= 0; s--) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    process.stdout.write(`\r${colors.cyan}剩余时间：${m}分 ${sec}秒${colors.reset} `);
    await delay(1000);
  }

  process.stdout.write('\r计时结束，重新开始流程...\n');
};

const main = async () => {
  printBanner();

  const proxyList = loadProxies();
  const privateKeys = fs.readFileSync('pk.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (!privateKeys.length) {
    logger.error('未读取到任何私钥，请确认 pk.txt 中至少包含一个私钥');
    return;
  }

  while (true) {
    for (const pk of privateKeys) {
      const proxy = proxyList.length ? getRandomProxy(proxyList) : null;
      const provider = initProvider(proxy);
      const wallet = new ethers.Wallet(pk, provider);

      logger.wallet(`当前钱包地址：${wallet.address}`);

      await claimFaucet(wallet, proxy);
      await delay(2000); // 防止请求过快
      await performCheckIn(wallet, proxy);
      await delay(2000);
      await transferPHRS(wallet, provider);
      await delay(2000);
      await performSwap(wallet, provider);
    }

    logger.success('所有钱包执行完毕，等待下一轮...');
    await waitCountdown();
  }
};

main().catch(err => {
  logger.error(`脚本运行失败：${err.message}`);
  process.exit(1);
});
