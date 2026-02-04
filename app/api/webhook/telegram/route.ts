import { NextRequest, NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import { fetchPageContent } from "@/lib/jina";
import { generateSummary, generateInsight, inferCategory } from "@/lib/llm";
import { saveBookmark, searchRelatedLinks, BookmarkData } from "@/lib/notion";
import { createTelegraphPage } from "@/lib/telegraph";

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

                // Send initial status message
                const statusMsg = await bot.telegram.sendMessage(chatId, `⏳ 正在处理: ${url}`);
                const statusMsgId = statusMsg.message_id;

                // Helper to safely edit message
                const updateStatus = async (text: string) => {
                    try {
                        await bot.telegram.editMessageText(chatId, statusMsgId, undefined, text);
                    } catch (e) {
                        console.error("Failed to update status:", e);
                    }
                };

                try {
                    // ─── Stage 1: Fetch Content ───
                    await updateStatus(`📖 正在获取页面内容...`);
                    const pageData = await fetchPageContent(url);

                    // Handle both string (legacy) and object return types just in case, though we know it's object now
                    const content = typeof pageData === 'string' ? pageData : pageData.content;
                    const jinaTitle = typeof pageData === 'string' ? undefined : pageData.title;

                    if (!content) throw new Error("无法从 Jina Reader 获取内容");

                    // Extract title strategy:
                    // 1. Use Jina's authoritative title if available and valid
                    // 2. Fallback to extracting first line of markdown
                    // 3. Fallback to URL
                    let title = jinaTitle || "";
                    if (!title || title.trim().length === 0 || title === "undefined") {
                        const titleMatch = content.match(/^#?\s*(.+)/);
                        title = titleMatch ? titleMatch[1].trim() : url;
                    }

                    // ─── Stage 2: Generate Summary + Tags ───
                    await updateStatus(`🧠 正在生成摘要与洞见...`);
                    const summaryResult = await generateSummary({
                        url,
                        title,
                        markdown: content
                    });

                    // ─── Stage 3: Find Related Links ───
                    // This explicitly finds connections in your Notion database to inject into the Insight prompt
                    const relatedLinks = await searchRelatedLinks(summaryResult.tags, 5);

                    // ─── Stage 4: Generate Insight ───
                    const insight = await generateInsight({
                        title,
                        url,
                        summary: summaryResult.summary,
                        relatedLinks // <--- Pass related links here for context injection
                    });

                    // ─── Stage 5: Title & Metadata Refinement ───
                    let finalTitle = title;
                    const isTwitter = url.includes("twitter.com") || url.includes("x.com");
                    if (isTwitter) {
                        const genericTitles = ["X", "Post", "Tweet", "Thread"];
                        const isGeneric = genericTitles.some(t => title.trim() === t) ||
                            title.includes("on X") ||
                            title.includes("on Twitter") ||
                            title.length < 10;

                        if (isGeneric) {
                            const lines = content.split('\n')
                                .map(l => l.replace(/^#+\s*/, '').trim())
                                .filter(l => l.length > 0)
                                .filter(l => !genericTitles.includes(l));

                            if (lines.length > 0) {
                                const firstLine = lines[0].slice(0, 80);
                                finalTitle = `${firstLine}${lines[0].length >= 80 ? '…' : ''}`;
                            }
                        }
                    }

                    // ─── Stage 6: Infer Category & Save to Notion (Initial) ───
                    await updateStatus(`💾 正在归档至 Notion ...`);
                    const category = inferCategory(summaryResult.tags);
                    const bookmarkData: BookmarkData = {
                        title: finalTitle,
                        summary: summaryResult.summary,
                        insight,
                        tags: summaryResult.tags,
                        category
                    };

                    const notionPageId = await saveBookmark(bookmarkData, url, undefined);

                    const host = req.headers.get("host") || "serverless-link-saver.vercel.app";
                    const protocol = host.includes("localhost") ? "http" : "https";
                    const appUrl = `${protocol}://${host}`;
                    const appDetailUrl = `${appUrl}/link/${notionPageId}`;

                    // ─── Stage 5b: Upload to Telegra.ph ───
                    let telegraphUrl = "";
                    try {
                        telegraphUrl = await createTelegraphPage({
                            title: finalTitle,
                            content,
                            url,
                            authorUrl: appDetailUrl,
                            summary: summaryResult.summary,
                            insight
                        });

                        if (telegraphUrl) {
                            const { updateBookmarkArchiveUrl } = require("@/lib/notion");
                            await updateBookmarkArchiveUrl(notionPageId, telegraphUrl);
                        }
                    } catch (e) {
                        console.error("Telegra.ph upload failed:", e);
                    }

                    // ─── Stage 7: Send Telegram Response ───
                    const escapeHtml = (str: string) => str
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");

                    const safeTitle = escapeHtml(finalTitle);
                    const safeSummary = escapeHtml(summaryResult.summary);
                    const safeInsight = escapeHtml(insight);
                    const safeTags = summaryResult.tags.map(t => `#${escapeHtml(t.replace(/\s+/g, '_'))}`).join(" ");

                    const relatedLinksMsg = relatedLinks.length > 0
                        ? `\n<b>🔗 相关链接</b>\n` + relatedLinks.map(l => `• <a href="${l.url || '#'}">${escapeHtml((l.title || l.url || '').slice(0, 50))}</a>`).join('\n')
                        : '';

                    const displayUrl = url.length > 60 ? url.slice(0, 60) + '...' : url;

                    const message = [
                        `📄 <b><a href="${telegraphUrl || url}">${safeTitle}</a></b>`,
                        `<a href="${url}">${displayUrl}</a>`,
                        ``,
                        safeTags,
                        ``,
                        `<b>📝 摘要</b>`,
                        safeSummary,
                        ``,
                        `<b>💡 Insight</b>`,
                        safeInsight,
                        relatedLinksMsg,
                        ``,
                        `🔍 完整分析: ${appDetailUrl}`
                    ].filter(Boolean).join('\n');

                    // Final Edit: Show Result
                    await bot.telegram.editMessageText(chatId, statusMsgId, undefined, message, {
                        parse_mode: "HTML",
                        link_preview_options: {
                            is_disabled: false,
                            url: telegraphUrl, // Force Instant View
                            prefer_large_media: true
                        }
                    });

                } catch (err) {
                    console.error(err);
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    // Edit status message to show error
                    await updateStatus(`❌ 处理失败: ${errorMessage}`);
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
