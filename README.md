# Serverless Link Saver

A cloud-native, serverless personal knowledge collector.

> **Inspiration**: This project is heavily inspired by **[LinkMind](https://github.com/reorx/linkmind)** by [reorx](https://github.com/reorx). It aims to replicate the core "Read-it-later" and AI analysis experience using a 100% serverless infrastructure.

## 🧠 Philosophy: Local First & Cloud Native

We deeply resonate with the architectural philosophy shared by the author of LinkMind:

> "User data should always be readable and available locally. Even if LinkMind becomes a SaaS, the cloud is merely a processor and buffer. Ultimately, all user data... should be automatically synced to a local archive in a human-readable format."

> "I envision a Daemon service... responsible for indexing and vectorizing this local data, enabling fast, precise semantic search."

### Our Solution Architecture

To adapt this philosophy for users without a 24/7 VPS, we designed a **Two-Layer Architecture**:

#### ✅ Layer 1: The Cloud "Collection Engine" (This Project)
This repository implements the "Cloud Processor & Buffer" layer. It is designed to be **Serverless, Free, and Maintenance-Free**.

*   **Trigger**: Telegram Bot (via Webhook).
*   **Parsing**: **Jina Reader API** (turns web pages into Markdown).
*   **Intelligence**: **Google Gemini 1.5** (summarizes, tags, and categorizes).
*   **Storage**: **Notion** (serves as the cloud database and CMS).
*   **Archiving**: Full markdown content is saved into the Notion page body, ensuring data persistence even if the original link dies.

#### 🚧 Layer 2: The Local "Brain" (Future Roadmap)
To fulfill the "Local First" vision, a future local client (running on your Mac/PC/NAS) will:
1.  Periodically sync new items from Notion to a local folder (Markdown files).
2.  Index these files using **MeiliSearch** or **SeekDB** (AI-native DB).
3.  Provide a lightning-fast, privacy-focused offline semantic search.

---

## 🚀 Deployment (Layer 1)

You can deploy this Collection Engine for **Free** on Vercel.

### Prerequisites
1.  **Notion**: Create an internal integration.
2.  **Telegram**: Create a bot via @BotFather.
3.  **Gemini**: Get a free API key from Google AI Studio.

### 1. Initialize Notion Database
We provide a script to automatically verify or create the necessary database fields for you.

```bash
# Set your Notion Key
export NOTION_KEY="secret_your_notion_key"

# Run initialization (Use a Page ID where you want the DB to live)
npx ts-node scripts/init-notion.ts <YOUR_PAGE_ID>
```

### 2. Deploy to Vercel
1.  Fork/Clone this repository.
2.  Import to Vercel.
3.  Set the following Environment Variables:
    *   `TELEGRAM_BOT_TOKEN`
    *   `NOTION_KEY`
    *   `NOTION_DATABASE_ID` (Output from Step 1)
    *   `GEMINI_API_KEY`
4.  Deploy!

### 3. Set Webhook
Once deployed, activate your bot by visiting:
`https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/webhook/telegram`

## 🛠 Tech Stack
*   **Framework**: Next.js 14 (App Router)
*   **Host**: Vercel (Edge/Serverless Functions)
*   **Database**: Notion API
*   **LLM**: Google Gemini (via `google-generative-ai`)
*   **Web Parser**: Jina Reader API

---

## License
MIT
