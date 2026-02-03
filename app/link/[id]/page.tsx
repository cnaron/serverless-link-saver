import { notFound } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { Client } from "@notionhq/client";
import { getRecentLinks, searchRelatedLinks } from "@/lib/notion";
import { getTelegraphPage } from "@/lib/telegraph";

// FORCE DYNAMIC: This page must be rendered on request
export const dynamic = 'force-dynamic';

// Helper to fetch single page (notion.ts helper doesn't exist for single id yet)
async function getLink(id: string) {
    const notion = new Client({ auth: process.env.NOTION_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID!;

    try {
        const response = await notion.pages.retrieve({ page_id: id });
        const props = (response as any).properties;

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

// Simple Renderer for Telegra.ph Nodes
function TelegraphRenderer({ nodes }: { nodes: any[] }) {
    if (!nodes || !Array.isArray(nodes)) return null;

    return (
        <div className="telegraph-content">
            {nodes.map((node, i) => <TelegraphNode key={i} node={node} />)}
        </div>
    );
}

function TelegraphNode({ node }: { node: any }) {
    if (typeof node === 'string') {
        return <>{node}</>;
    }

    const { tag, attrs, children } = node;
    const childNodes = children ? children.map((child: any, i: number) => <TelegraphNode key={i} node={child} />) : null;

    switch (tag) {
        case 'p': return <p {...attrs}>{childNodes}</p>;
        case 'b': case 'strong': return <strong {...attrs}>{childNodes}</strong>;
        case 'i': case 'em': return <em {...attrs}>{childNodes}</em>;
        case 'a': return <a {...attrs} target="_blank">{childNodes}</a>;
        case 'h3': return <h3 {...attrs}>{childNodes}</h3>;
        case 'h4': return <h4 {...attrs}>{childNodes}</h4>;
        case 'blockquote': return <blockquote {...attrs}>{childNodes}</blockquote>;
        case 'ul': return <ul {...attrs}>{childNodes}</ul>;
        case 'ol': return <ol {...attrs}>{childNodes}</ol>;
        case 'li': return <li {...attrs}>{childNodes}</li>;
        case 'img': return <img {...attrs} style={{ maxWidth: '100%', borderRadius: '4px' }} />;
        case 'hr': return <hr {...attrs} />;
        case 'br': return <br />;
        case 'pre': return <pre {...attrs}>{childNodes}</pre>;
        case 'code': return <code {...attrs}>{childNodes}</code>;
        case 's': return <s {...attrs}>{childNodes}</s>;
        default: return <div {...attrs}>{childNodes}</div>;
    }
}

export default async function LinkDetail({ params }: { params: { id: string } }) {
    const link = await getLink(params.id);

    if (!link) {
        notFound();
    }

    // Get related links based on tags
    const relatedLinks = await searchRelatedLinks(link.tags, 5);

    // Fetch Telegra.ph content if available
    let telegraphContentNodes: any[] = [];
    if (link.archiveUrl && link.archiveUrl.includes('telegra.ph')) {
        const path = link.archiveUrl.split('telegra.ph/')[1];
        if (path) {
            const page = await getTelegraphPage(path);
            if (page && page.content) {
                // Filter content to remove the header logic we injected
                // We injected headerNodes ending with { tag: 'h4', children: ['📄 原文内容'] }
                // So we look for that node and render everything AFTER it.
                // If not found (old format), render everything.

                const splitIndex = page.content.findIndex((n: any) =>
                    n.tag === 'h4' && n.children && n.children[0] === '📄 原文内容'
                );

                if (splitIndex !== -1) {
                    telegraphContentNodes = page.content.slice(splitIndex + 1);
                } else {
                    telegraphContentNodes = page.content;
                }
            }
        }
    }

    return (
        <div className="detail-layout">
            {/* Main Column */}
            <div className="detail-main">
                <h1>{link.title}</h1>
                <div className="meta">
                    <a href={link.url} target="_blank">{link.url}</a>
                    {' · '} {new Date(link.created_time).toLocaleString('zh-CN')}
                </div>

                {/* Removed "Read on Telegra.ph" block */}

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

                {/* Render Telegra.ph Content Inline */}
                {telegraphContentNodes.length > 0 && (
                    <div className="section">
                        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>原文内容</span>
                            <a href={link.archiveUrl} target="_blank" style={{ fontSize: '0.85rem', fontWeight: 'normal', textDecoration: 'none', opacity: 0.8 }}>
                                ⚡️ Instant View
                            </a>
                        </div>
                        <div className="content">
                            <TelegraphRenderer nodes={telegraphContentNodes} />
                        </div>
                    </div>
                )}

                {/* Fallback link if no content fetched but url exists? Option. */}
                {link.archiveUrl && telegraphContentNodes.length === 0 && (
                    <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                        <a href={link.archiveUrl} target="_blank">🔗 Read on Telegra.ph</a>
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
