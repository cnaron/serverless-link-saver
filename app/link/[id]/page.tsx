import { notFound } from "next/navigation";
import ReactMarkdown from 'react-markdown';
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
                    {' · '} {new Date(link.created_time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </div>

                {/* Instant View Button - Restored & Styled */}
                {link.archiveUrl && (
                    <div style={{ margin: '20px 0' }}>
                        <a
                            href={link.archiveUrl}
                            target="_blank"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                background: 'var(--card-bg)', // Use consistent card background
                                border: '1px solid var(--border)',
                                borderRadius: '20px',
                                textDecoration: 'none',
                                color: 'var(--fg)',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
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

            </div>

            {/* Sidebar Column */}
            <div className="detail-sidebar">

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
                                🔗 <a href={related.url || '#'} target="_blank">{related.title || related.url}</a>
                                <br />
                                <span className="related-snippet">
                                    {related.summary?.slice(0, 60)}...
                                </span>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
