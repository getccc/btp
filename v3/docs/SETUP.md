# V3 信号采集与分析平台 — 本地配置与启动指南

本文档指导你如何在本地环境（或单机服务器）上配置并启动 V3 平台。系统采用 Docker Compose 进行一键编排，无需在宿主机安装 Python 或 Node.js 环境。

---

## 1. 环境准备

确保你的机器上已安装以下软件：
- **Docker** (版本 >= 20.10)
- **Docker Compose** (版本 >= 2.0)
- **Git** (可选，用于拉取代码)

---

## 2. 配置文件准备

进入项目根目录 `v3/`，复制环境变量模板文件：

```bash
cd v3
cp .env.example .env
```

使用文本编辑器打开 `.env` 文件，填入真实的配置信息。以下是各项配置的详细说明：

### 2.1 数据库与 Redis 配置
保持默认即可，Docker Compose 会自动使用这些凭据初始化数据库。
```env
DB_USER=signal
DB_PASSWORD=signal_pass
DATABASE_URL=postgresql+asyncpg://signal:signal_pass@postgres:5432/signal_platform
REDIS_URL=redis://redis:6379/0
```

### 2.2 DeepSeek LLM 配置
前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请 API Key。
```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2.3 Telegram 监控配置 (User Client)
用于监听公开群组消息。你需要一个**真实的 Telegram 账号**。
前往 [my.telegram.org](https://my.telegram.org/) 申请 API ID 和 Hash。
```env
TG_API_ID=12345678
TG_API_HASH=abcdef1234567890abcdef1234567890
TG_PHONE=+8613800138000  # 你的手机号，带国家代码
```
> **注意**：首次启动时，Telethon 可能会要求输入验证码。由于是在 Docker 内运行，建议先在本地运行一次脚本生成 `telethon.session` 文件，然后挂载到 Docker 中；或者通过 `docker attach` 进入容器输入验证码。

### 2.4 Telegram 推送配置 (Bot API)
用于接收高分机会警报。
1. 在 Telegram 中找 `@BotFather` 创建一个新 Bot，获取 Token。
2. 找 `@userinfobot` 获取你自己的 Chat ID。
```env
TG_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TG_OWNER_CHAT_ID=987654321
```

### 2.5 X/Twitter 采集账号池
用于抓取 KOL 推文。建议准备 2-3 个小号以防风控。必须是严格的 JSON 数组格式。
```env
X_ACCOUNTS=[{"username":"your_twitter_handle","password":"your_password","email":"your_email@example.com"}]
```

### 2.6 链上 API Key 池
用于高频轮询链上数据。必须是严格的 JSON 数组格式。

**BSC 免费节点申请：**
- [BscScan](https://bscscan.com/apis) (5 calls/s)
- [NodeReal](https://nodereal.io/) (免费 Tier)
- [Moralis](https://moralis.io/) (免费 Tier)

```env
BSC_API_KEYS=[{"provider":"bscscan","key":"YOUR_BSCSCAN_KEY"},{"provider":"nodereal","key":"YOUR_NODEREAL_KEY"}]
```

**Solana 免费节点申请：**
- [Helius](https://dev.helius.xyz/) (强烈推荐，免费额度高)
- [Alchemy](https://www.alchemy.com/)

```env
SOLANA_API_KEYS=[{"provider":"helius","key":"YOUR_HELIUS_KEY"},{"provider":"alchemy","key":"YOUR_ALCHEMY_KEY"}]
```

---

## 3. 启动系统

在 `v3/` 目录下执行以下命令：

```bash
# 后台启动所有服务
docker compose up -d
```

### 启动过程说明：
1. **Postgres & Redis**：首先启动。Postgres 会自动创建 `signal_platform` 数据库。
2. **Backend**：等待数据库就绪后启动。启动时会自动执行 `alembic upgrade head` 创建所有 11 张表，并写入默认的系统配置（如评分权重、采集间隔）。
3. **Frontend**：Nginx 容器启动，代理前端静态文件并将 `/api` 和 `/ws` 转发给 Backend。

### 查看日志：
```bash
# 查看后端日志（排查采集器和 LLM 报错）
docker compose logs -f backend

# 查看所有服务日志
docker compose logs -f
```

---

## 4. 访问与初始化配置

系统启动成功后，打开浏览器访问：
👉 **http://localhost:3000**

### 4.1 检查系统健康状态
进入首页 **Dashboard**，查看右上角的系统状态指示灯是否为绿色（Connected）。
查看下方卡片，确认 5 个采集器（X KOL, Telegram, BSC, Solana, Price Quote）是否处于 `running` 或 `idle` 状态。

### 4.2 添加监控目标
系统默认没有任何监控目标，你需要手动添加：
1. 点击左侧菜单 **⚙️ Config -> KOL List**，添加几个你关注的 Twitter KOL（如 `@VitalikButerin`）。
2. 点击 **⚙️ Config -> Smart Money**，添加几个 BSC 或 Solana 的大户地址。
3. 点击 **⚙️ Config -> Telegram Groups**，添加你要监控的公开群组链接（如 `t.me/binanceexchange`）。

### 4.3 调整系统参数 (可选)
点击 **⚙️ Config -> System Settings**：
- **Scoring Weights**：调整各项得分在总分中的占比。
- **Notification Rules**：设置触发 Telegram 警报的最低分数（默认 75 分）。
- **Collector Intervals**：调整采集频率（注意不要超过免费 API 的限流阈值）。

---

## 5. 常见问题排查 (FAQ)

**Q: 采集器状态显示 `error`，日志提示 `429 Too Many Requests`？**
A: 你的 API Key 免费额度已耗尽或请求频率过高。请在 System Settings 中调大 `Collector Intervals`，或者在 `.env` 中添加更多的 API Key 到池中。

**Q: Telegram 采集器没有抓取到消息？**
A: 检查 `v3/backend/sessions/` 目录下是否生成了 `.session` 文件。如果没有，说明 Telethon 登录失败（通常是因为需要输入手机验证码）。你需要进入容器手动运行一次登录脚本。

**Q: LLM 分析一直失败？**
A: 检查 `.env` 中的 `DEEPSEEK_API_KEY` 是否正确，以及账户是否有余额。DeepSeek 必须充值后才能正常使用 API。

**Q: 如何完全重置系统并清空数据？**
A: 执行以下命令（**警告：将丢失所有数据！**）：
```bash
docker compose down -v
docker compose up -d
```
