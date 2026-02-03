import { notFound } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

// Use Notion client directly for server component to ensure fresh data
// Or better, use our fetch helper from notion.ts to avoid build issues
import { Client } from "@notionhq/client";
import { getRecentLinks, searchRelatedLinks } from "@/lib/notion";

// FORCE DYNAMIC: This page must be rendered on request
export const dynamic = 'force-dynamic';

// Helper to fetch single page (notion.ts helper doesn't exist for single id yet)
async function getLink(id: string) {
    const notion = new Client({ auth: process.env.NOTION_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID!;

    try {
        const response = await notion.pages.retrieve({ page_id: id });
        const props = (response as any).properties;

        // Fetch page content (blocks) -> markdown (simplified)
        // NOT IMPLEMENTED: Fetching full blocks content for now.
        // If we want "Full Archive View", we specifically need to fetch blocks.
        // However, if we are archiving to Telegra.ph, maybe we just show Telegra.ph link?
        // User requested "Click title -> show archived markdown".
        // AND "web要跟linkmind一模一样". LinkMind stores markdown in `item.markdown` (from SQLite).
        // In our Notion setup, we didn't save full markdown text property (Notion limits text prop to 2000 chars).
        // We saved it as blocks OR we have a Telegra.ph link.
        // Telegra.ph link is better for "reading" now.
        // But LinkMind detail page shows "原文内容" (Original Content).

        // Compromise: We fetch blocks and render standard markdown, 
        // OR we rely on Telegra.ph link. 
        // User said: "Click title -> show archived markdown". 
        // "web要跟linkmind一模一样" -> LinkMind has a section "原文内容".
        // Since Notion blocks ARE the archive, let's try to render them simply or just link to Telegra.ph?
        // Wait, earlier I removed blocks saving to Notion in favor of Telegra.ph URL.
        // So there IS NO CONTENT in Notion body anymore for new links.
        // So I can't render "Full Content".
        // I should probably show the Telegra.ph view via iframe? No, Telegram blocks iframes usually.
        // I will just link to Telegra.ph conspicuously.

        return {
            id: response.id,
            title: props.Name?.title?.[0]?.plain_text || "Untitled",
            url: props.URL?.url || "#",
            archiveUrl: props.ArchiveURL?.url,
            summary: props.Summary?.rich_text?.[0]?.plain_text || "",
            insight: props.Insight?.rich_text?.[0]?.plain_text || "",
            category: props.Category?.select?.name || "Other",
            tags: props.Tags?.multi_select?.map((t: any) => t.name) || [],
            created_time: (response as any).created_time,
        };
    } catch (error) {
        console.error("Error fetching page:", error);
        return null;
    }
}

export default async function LinkDetail({ params }: { params: { id: string } }) {
    const link = await getLink(params.id);

    if (!link) {
        notFound();
    }

    // Get related links based on tags
    const relatedLinks = await searchRelatedLinks(link.tags, 5);

    return (
        <div className="detail-layout">
            {/* Main Column */}
            <div className="detail-main">
                <h1>{link.title}</h1>
                <div className="meta">
                    <a href={link.url} target="_blank">{link.url}</a>
                    {' · '} {new Date(link.created_time).toLocaleString('zh-CN')}
                </div>

                {/* Action Bar / Telegra.ph Link */}
                {link.archiveUrl && (
                    <div className="section" style={{ borderLeft: "4px solid var(--accent)" }}>
                        <div className="section-title">⚡️ Instant View</div>
                        <div>
                            <a href={link.archiveUrl} target="_blank" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                Read on Telegra.ph
                            </a>
                        </div>
                    </div>
                )}

                {link.summary && (
                    <div className="section">
                        <div className="section-title">摘要</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{link.summary}</div>
                    </div>
                )}

                {link.insight && (
                    <div className="section">
                        <div className="section-title">Insight</div>
                        <div className="insight">{link.insight}</div>
                    </div>
                )}

                {/* Since content is not in Notion (we use Telegra.ph), we skip "原文内容" section 
            or maybe fetch from Telegra.ph API? That's overkill. 
            The ArchiveURL button above serves the purpose. 
        */}

            </div>

            {/* Sidebar Column */}
            <div className="detail-sidebar">

                {/* Tags */}
                {link.tags.length > 0 && (
                    <div className="section">
                        <div className="section-title">标签</div>
                        <div className="tags">
                            {link.tags.map(tag => (
                                <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="tag">
                                    {tag}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Related Links */}
                {relatedLinks.length > 0 && (
                    <div className="section">
                        <div className="section-title">相关链接</div>
                        {relatedLinks.filter(l => l.url !== link.url).map((related, i) => (
                            <div key={i} className="related-item">
                                🔗 <a href={related.url || '#'} target="_blank">{related.title || related.url}</a>
                                <br />
                                <span className="related-snippet">
                                    {related.summary?.slice(0, 60)}...
                                </span>
                                {/* Internal link to detail page? LinkMind links to #fragment. 
                    We can link to our detail page if we have ID, but searchRelatedLinks returns limited props.
                    Ideally searchRelatedLinks should return ID.
                    But standard `url` is external. 
                    Let's check if we can modify searchRelatedLinks to return ID?
                    Actually for now external link is fine, matches "Related Links" concept.
                */}
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
