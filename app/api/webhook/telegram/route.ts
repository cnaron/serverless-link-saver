import { NextRequest, NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { fetchPageContent } from "@/lib/jina";
import { summarizeContent } from "@/lib/llm";
import { saveBookmark, getRecentBookmarks } from "@/lib/notion";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

export async function POST(req: NextRequest) {
    try {
        // 1. Validate Secret Token (Optional but recommended)
        const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
        if (process.env.TELEGRAM_SECRET_TOKEN && secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse Update
        const body = await req.json();

        // 3. Handle Update manually to keep generic
        // We only care about text messages with text
        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            // Simple URL detection
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = text.match(urlRegex);

            if (urls && urls.length > 0) {
                const url = urls[0]; // Take first URL

                // Ack immediately? Serverless has limits. Vercel allows 60s, usually enough.
                // Send "Processing" message
                await bot.telegram.sendMessage(chatId, `⏳ Processing: ${url}`);

                try {
                    // A. Jina Reader
                    const content = await fetchPageContent(url);
                    if (!content) throw new Error("Failed to fetch content");

                    // B. Contextual Memory (Fetch recent bookmarks)
                    const recentBookmarks = await getRecentBookmarks(10);

                    // C. Gemini LLM (with Context)
                    const summary = await summarizeContent(content, url, recentBookmarks);
                    if (!summary) throw new Error("Failed to summarize content");

                    // C. Notion
                    await saveBookmark(summary, url, content);

                    // Success Message
                    await bot.telegram.sendMessage(
                        chatId,
                        `✅ *Saved!*\n\n*${summary.title}*\n_${summary.category}_\n\n${summary.summary}`,
                        { parse_mode: "Markdown" }
                    );

                } catch (err) {
                    console.error(err);
                    await bot.telegram.sendMessage(chatId, `❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
            } else {
                // No URL found
                // await bot.telegram.sendMessage(chatId, "Please send a valid URL.");
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: "alive" });
}
