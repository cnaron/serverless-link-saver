# Serverless Link Saver

一个云原生、无服务器 (Serverless) 的个人知识收藏夹。

> **致敬与灵感**: 本项目深受 **[LinkMind](https://github.com/reorx/linkmind)** (by [reorx](https://github.com/reorx)) 的启发。我们的目标是构建一个 **100% Serverless** 的架构，复刻其核心的"稍后读"与 AI 分析体验，同时实现零成本维护。

## 🧠 核心理念：本地优先 (Local First) & 云原生

我们高度认同 LinkMind 作者提出的架构哲学：

> "用户的数据应始终在本地可读可用。即便 LinkMind 做成了一个 SaaS 服务，那么云端也只是它的一个处理器和暂存器。最终所有的用户数据... 都应该在用户的本地自动同步一份完整的归档数据，且格式易于人类的阅读。"

> "我正在构思一个 Daemon 服务... 负责对本地的这些数据进行索引和向量化，使其能够快速精准地搜索到相关信息。"

### 我们的解决方案架构

为了让没有 24小时 VPS 的用户也能践行这一哲学，我们设计了 **双层架构 (Two-Layer Architecture)**：

#### ✅ Layer 1: 云端采集引擎 (本仓库)
本仓库实现了"云端处理器与暂存器"层。它的设计目标是 **Serverless、免费、且无需维护**。

*   **触发器**: Telegram Bot (通过 Webhook).
*   **网页解析**: **Jina Reader API** (将网页转为 Markdown).
*   **智能分析**: **Google Gemini 1.5** (自动总结、打标签、分类).
*   **存储归档**: **Notion** (作为云端数据库和 CMS).
*   **全文存档**: 网页的 Markdown 全文会直接存入 Notion 页面的正文块 (Blocks) 中，确保即使原链接失效，数据依然永久保存。

#### 🚧 Layer 2: 本地第二大脑 (未来路线图)
为了完全实现 "Local First" 的愿景，未来的本地客户端 (运行在 Mac/PC/NAS 上) 将负责：
1.  定期从 Notion 同步新条目到本地文件夹 (存为 Markdown 文件).
2.  使用 **MeiliSearch** 或 **SeekDB** (AI原生数据库) 建立索引.
3.  提供极速、隐私优先的离线语义搜索能力.

---

## 🚀 部署指南 (Layer 1)

您可以将本采集引擎 **免费** 部署在 Vercel 上。

### 准备工作
1.  **Notion**: 创建一个 Internal Integration。
2.  **Telegram**: 通过 @BotFather 创建一个 Bot。
3.  **Gemini**: 从 Google AI Studio 获取免费 API Key。

### 1. 初始化 Notion 数据库
我们要找个地方存数据。我们提供了一个脚本，可以自动帮您在 Notion 页面里建好数据库（包含所有必要的字段）。

```bash
# 设置您的 Notion Key
export NOTION_KEY="secret_your_notion_key"

# 运行初始化脚本 (填入您想放置数据库的 Page ID)
npx ts-node scripts/init-notion.ts <YOUR_PAGE_ID>
```

### 2. 部署到 Vercel
1.  Fork 或 Clone 本仓库。
2.  在 Vercel 中导入 (Import) 本项目。
3.  配置 **Environment Variables (环境变量)**:
    *   `TELEGRAM_BOT_TOKEN`
    *   `NOTION_KEY`
    *   `NOTION_DATABASE_ID` (即第一步脚本输出的 ID)
    *   `GEMINI_API_KEY`
4.  点击 Deploy!

### 3. 设置 Webhook
部署完成后，您需要告诉 Telegram 把消息发到哪里。
在浏览器访问以下链接（替换为您自己的 Token 和 Vercel 域名）：

`https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/webhook/telegram`

---

## 🛠 技术栈
*   **框架**: Next.js 14 (App Router)
*   **托管**: Vercel (Edge/Serverless Functions)
*   **数据库**: Notion API
*   **LLM**: Google Gemini (via `google-generative-ai`)
*   **网页解析**: Jina Reader API

---

## License
MIT
