import { notFound } from "next/navigation";
import Link from 'next/link';
import { getRecentLinks, searchRelatedLinks } from "@/lib/notion";

// Use Revalidation (ISR) for performance
export const revalidate = 60;

// Helper to fetch single page using fetch API (for caching control)
async function getLink(id: string) {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const NOTION_KEY = process.env.NOTION_KEY!;

    try {
        const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${NOTION_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            next: { revalidate: 60 }
        });

        if (!response.ok) return null;

        const page = await response.json();
        const props = (page as any).properties;

        // Try to find an OG Image if stored (Notion doesn't store OG image in properties by default unless we save it)
        // LinkMind stores 'images' json. We don't have that yet.
        // We can fall back to 'cover' pattern if available, or just empty.

        return {
            id: page.id,
            title: props.Name?.title?.[0]?.plain_text || "Untitled",
            url: props.URL?.url || "#",
            archiveUrl: props.ArchiveURL?.url,
            summary: props.Summary?.rich_text?.[0]?.plain_text || "",
            insight: props.Insight?.rich_text?.[0]?.plain_text || "",
            category: props.Category?.select?.name || "Other",
            tags: props.Tags?.multi_select?.map((t: any) => t.name) || [],
            created_time: (page as any).created_time,
            // Assuming we might have OG Image or similar later. LinkMind uses 'og_image' column in SQL.
            // In Notion, we can use the page cover? Or maybe we can't get it easily.
            // For now, we omit the OG Image in sidebar unless we decide to store it.
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
                    {/* LinkMind shows Site Name here too, we don't have it stored yet */}
                    {' · '} {new Date(link.created_time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </div>

                {/* Instant View Button - Restored & Styled - Kept as a nice extra feature even if LinkMind source doesn't have it exactly here, it fits the Vercel theme */}
                {link.archiveUrl && (
                    <div style={{ margin: '0 0 20px 0' }}>
                        <a
                            href={link.archiveUrl}
                            target="_blank"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                background: 'var(--badge-scraped-bg)',
                                color: 'var(--badge-scraped-text)',
                                borderRadius: '20px',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                            }}
                        >
                            ⚡️ Read on Telegra.ph (Instant View)
                        </a>
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

                {/* Original content section if we had it stored as Markdown. LinkMind stores it. 
                    We upload to Telegra.ph instead. 
                    So we skip the "原文内容" section for now to avoid duplications or heavy fetching.
                    Or we could fetch from Telegra.ph content? No, that's slow.
                */}

            </div>

            {/* Sidebar Column */}
            <div className="detail-sidebar">

                {/* OG Image placeholder if we had one */}
                {/* <img class="og-image" src="..." alt=""> */}

                {/* Tags */}
                {link.tags.length > 0 && (
                    <div className="section">
                        <div className="section-title">标签</div>
                        <div className="tags">
                            {link.tags.map((tag: string) => (
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
                                🔗
                                {related.id ? (
                                    <Link href={`/link/${related.id}`}>
                                        {related.title || related.url}
                                    </Link>
                                ) : (
                                    <a href={related.url || '#'} target="_blank">{related.title || related.url}</a>
                                )}

                                {related.url && (
                                    <a href={related.url} target="_blank" style={{ marginLeft: '6px', opacity: 0.5, textDecoration: 'none', fontSize: '0.8em' }} title="Original Source">
                                        ↗
                                    </a>
                                )}

                                {related.summary && (
                                    <span className="related-snippet">
                                        {related.summary.slice(0, 100)}...
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
