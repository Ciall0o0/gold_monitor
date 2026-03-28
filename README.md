# 黄金监测与AI预警系统

基于 Cloudflare Workers 的上海黄金交易所 AU9999 价格监测服务，集成 OPENROUTER AI 分析和 Server酱 推送。

## 功能特性

- 📊 每15分钟自动监测黄金价格
- 📈 技术指标计算（MA5/MA10/MA20、RSI、趋势判断）
- 🤖 OPENROUTER AI 智能分析涨跌概率
- 🚨 双重预警机制（价格偏离+AI预测）
- 📱 Server酱微信推送
- 💾 Cloudflare KV 价格历史存储

## 预警触发条件

1. 价格偏离5日均线超过 **5%**
2. AI预测有较大幅度涨跌且置信度 **≥70%**

## 部署步骤

### 1. 准备工作

```bash
# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login
```

### 2. 创建 KV Namespace

```bash
npx wrangler kv:namespace create "PRICE_HISTORY"
```

将返回的 id 填入 `wrangler.toml`。

### 3. 配置 Secrets

```bash
# 设置 OPENROUTER API Key
npx wrangler secret put OPENROUTER_API_KEY

# 设置 Server酱 SendKey
npx wrangler secret put SERVERCHAN_SENDKEY
```

### 4. 部署

```bash
npm run deploy
```

### 5. 配置 Cron Trigger

在 Cloudflare Dashboard 的 Workers 设置中添加 Cron Trigger：
```
*/15 * * * *
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/price` | GET | 获取当前价格 |
| `/history` | GET | 获取价格历史 |
| `/monitor` | POST | 手动触发监测 |
| `/test-alert` | POST | 发送测试消息 |

## 成本估算

| 项目 | 费用 |
|------|------|
| Cloudflare Workers | 免费 (10万次/天) |
| OPENROUTER API | ~¥1-5/月 |
| Server酱 | 免费 |

## 技术栈

- TypeScript
- Cloudflare Workers
- Cloudflare KV
- OPENROUTER API
- Server酱

## License

MIT
