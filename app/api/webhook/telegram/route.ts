import { NextRequest, NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { fetchPageContent } from "@/lib/jina";
import { generateSummary, generateInsight, inferCategory } from "@/lib/llm";
import { saveBookmark, searchRelatedLinks, BookmarkData } from "@/lib/notion";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

export async function POST(req: NextRequest) {
    try {
        // 1. Validate Secret Token
        const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
        if (process.env.TELEGRAM_SECRET_TOKEN && secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse Update
        const body = await req.json();

        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            // URL detection
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = text.match(urlRegex);

            if (urls && urls.length > 0) {
                const url = urls[0];

                await bot.telegram.sendMessage(chatId, `⏳ 正在处理: ${url}`);

                try {
                    // ─── Stage 1: Fetch Content ───
                    const content = await fetchPageContent(url);
                    if (!content) throw new Error("无法从 Jina Reader 获取内容");

                    // Extract title from markdown (first line usually is the title)
                    const titleMatch = content.match(/^#?\s*(.+)/);
                    const title = titleMatch ? titleMatch[1].trim() : url;

                    // ─── Stage 2: Generate Summary + Tags ───
                    const summaryResult = await generateSummary({
                        url,
                        title,
                        markdown: content
                    });

                    // ─── Stage 3: Find Related Links ───
                    const relatedLinks = await searchRelatedLinks(summaryResult.tags, 5);

                    // ─── Stage 4: Generate Insight ───
                    const insight = await generateInsight({
                        title,
                        url,
                        summary: summaryResult.summary,
                        relatedLinks
                    });

                    // ─── Stage 5: Infer Category & Save to Notion ───
                    const category = inferCategory(summaryResult.tags);
                    const bookmarkData: BookmarkData = {
                        title,
                        summary: summaryResult.summary,
                        insight,
                        tags: summaryResult.tags,
                        category
                    };

                    const notionUrl = await saveBookmark(bookmarkData, url, content);

                    // ─── Stage 6: Send Telegram Response ───
                    const escapeHtml = (str: string) => str
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");

                    const safeTitle = escapeHtml(title);
                    const safeSummary = escapeHtml(summaryResult.summary);
                    const safeInsight = escapeHtml(insight);
                    const safeTags = summaryResult.tags.map(t => `#${escapeHtml(t)}`).join(" ");

                    const host = req.headers.get("host") || "serverless-link-saver.vercel.app";
                    const protocol = host.includes("localhost") ? "http" : "https";
                    const appUrl = `${protocol}://${host}`;

                    const message = [
                        `✅ <b>已保存!</b>`,
                        ``,
                        `<b>${safeTitle}</b>`,
                        `<i>${category}</i>  ${safeTags}`,
                        ``,
                        `📝 <b>摘要：</b>`,
                        safeSummary,
                        ``,
                        `💡 <b>AI 洞见：</b>`,
                        safeInsight,
                        ``,
                        `<a href="${notionUrl}">🔗 Notion</a>  |  <a href="${appUrl}">🌌 知识库</a>`
                    ].join('\n');

                    await bot.telegram.sendMessage(chatId, message, {
                        parse_mode: "HTML",
                        link_preview_options: { is_disabled: true }
                    });

                } catch (err) {
                    console.error(err);
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    await bot.telegram.sendMessage(
                        chatId,
                        `❌ Error: ${errorMessage}`
                    );
                }
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
