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

                await bot.telegram.sendMessage(chatId, `⏳ 正在处理: ${url}`);

                try {
                    // ─── Stage 1: Fetch Content ───
                    const content = await fetchPageContent(url);
                    if (!content) throw new Error("无法从 Jina Reader 获取内容");

                    // Extract title from markdown (first line usually is the title)
                    const titleMatch = content.match(/^#?\s*(.+)/);
                    let title = titleMatch ? titleMatch[1].trim() : url;

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

                    // ─── Stage 5: Title & Metadata Refinement ───
                    // Align title logic with LinkMind (especially for Twitter)
                    let finalTitle = title;
                    const isTwitter = url.includes("twitter.com") || url.includes("x.com");
                    if (isTwitter) {
                        // Aggressively fix generic Twitter titles (Jina often returns "Post", "X", "Tweet")
                        const genericTitles = ["X", "Post", "Tweet", "Thread"];
                        const isGeneric = genericTitles.some(t => title.trim() === t) ||
                            title.includes("on X") ||
                            title.includes("on Twitter") ||
                            title.length < 10; // Heuristic: very short titles are usually bad for tweets

                        if (isGeneric) {
                            // Clean content lines to find real text
                            const lines = content.split('\n')
                                .map(l => l.replace(/^#+\s*/, '').trim()) // Remove markdown headers (e.g. "# Post")
                                .filter(l => l.length > 0)
                                .filter(l => !genericTitles.includes(l)); // Skip lines that are just "Post"

                            if (lines.length > 0) {
                                // Use first meaningful line as title
                                const firstLine = lines[0].slice(0, 80);
                                finalTitle = `${firstLine}${lines[0].length >= 80 ? '…' : ''}`;
                            }
                        }
                    }

                    // ─── Stage 6: Infer Category & Save to Notion (Initial) ───
                    const category = inferCategory(summaryResult.tags);
                    const bookmarkData: BookmarkData = {
                        title: finalTitle,
                        summary: summaryResult.summary,
                        insight,
                        tags: summaryResult.tags,
                        category
                    };

                    // Save first to get the Notion Page ID
                    // We need this ID to generate the App URL for the Telegra.ph author link
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
                            url, // Source URL
                            authorUrl: appDetailUrl, // Author Link -> Our App Detail Page
                            summary: summaryResult.summary,
                            insight
                        });

                        // Update Notion with the Archive URL
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
                    // Tags format: #Tag1 #Tag2 (LinkMind: underscore for spaces? No, sample uses #Tag)
                    // LinkMind code: `#${t.replace(/\s+/g, '_')}`
                    const safeTags = summaryResult.tags.map(t => `#${escapeHtml(t.replace(/\s+/g, '_'))}`).join(" ");

                    // LinkMind Message Format:
                    // 📄 <b>[Title]</b>
                    // <a href="[URL]">[Truncated URL]</a>
                    //
                    // [Tags]
                    //
                    // <b>📝 摘要</b>
                    // [Summary]
                    //
                    // <b>💡 Insight</b>
                    // [Insight]
                    //
                    // <b>🔗 相关链接</b> (if any)
                    // • <a href="...">Title</a>
                    // 
                    // 🔍 完整分析: [PermanentLink]

                    const relatedLinksMsg = relatedLinks.length > 0
                        ? `\n<b>🔗 相关链接</b>\n` + relatedLinks.map(l => `• <a href="${l.url || '#'}">${escapeHtml((l.title || l.url || '').slice(0, 50))}</a>`).join('\n')
                        : '';

                    // Truncate URL for display
                    const displayUrl = url.length > 60 ? url.slice(0, 60) + '...' : url;

                    const message = [
                        `📄 <b><a href="${telegraphUrl || url}">${safeTitle}</a></b>`, // Link Title to Telegra.ph (Instant View)
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

                    await bot.telegram.sendMessage(chatId, message, {
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
