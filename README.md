
# Pharos Testnet 自动交互脚本

由 [雪糕战神@Xuegaogx](https://twitter.com/Xuegaogx) 编写  
自动执行 Pharos 测试网的水龙头领取、每日签到、转账、Swap 操作

---

## 🧾 功能说明

本脚本每轮自动完成以下步骤：

1. **加载私钥 & 代理池**
2. 针对每个地址依次执行：
   - ✅ 登录并领取水龙头（若可领取）
   - ✅ 登录并执行每日签到（若未签到）
   - ✅ 向随机地址发起 10 次 PHRS 转账（防 Bot）
   - ✅ 在 WPHRS / USDC 之间进行 10 次 Swap（模拟交互）
3. 完成所有钱包后自动倒计时 30 分钟，循环执行

---

## ✅ 使用前准备

### 环境要求

- Node.js >= 18
- 包管理器：npm / yarn / pnpm 均可
- 网络支持：直连 / 支持 http(s) 代理
- 支持 Linux / Mac / Windows (WSL)

### 克隆仓库

```bash
git clone https://github.com/GzGod/pharos.git
cd pharos
```

### 安装依赖

```bash
npm install
```

---

## 🛠 文件配置说明

### 1. 私钥文件 `pk.txt`

一行一个私钥（不带 0x）：

```
abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321
```

> ⚠️ 请勿上传该文件到公开仓库！

---

### 2. 代理池文件 `proxies.txt`（可选）

一行一个代理，格式示例：

```
http://username:password@ip:port
http://127.0.0.1:7890
```

如未提供该文件，则自动采用直连模式。

---

## ▶️ 运行脚本

```bash
node main.js
```

脚本将持续循环执行，如需后台运行可搭配 `screen` 或 `pm2` 使用。

---

## 📄 免责声明

- 本脚本仅用于 Pharos 测试网参与用途，**不提供任何投资建议**
- 请自行评估风险，使用本脚本代表您已同意自行承担后果

---

## 🙋 联系作者

- TG频道：https://t.me/xuegaoz
- GitHub：https://github.com/Gzgod
- 推特：[@Xuegaogx](https://twitter.com/Xuegaogx)
