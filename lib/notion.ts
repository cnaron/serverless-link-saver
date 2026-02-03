import { Client } from "@notionhq/client";
import { marked } from "marked";
import { RelatedLink } from "./llm";

// ─── Config ───
const NOTION_KEY = process.env.NOTION_KEY!;
const databaseId = process.env.NOTION_DATABASE_ID!;

// We still use the SDK for creating pages (more convenient).
// But use fetch for queries (SDK has tree-shaking issues in Vercel production).
const notion = new Client({ auth: NOTION_KEY });

// ─── Types ───
export interface BookmarkData {
    title: string;
    summary: string;
    insight: string;
    tags: string[];
    category: "Tech" | "News" | "Design" | "Tutorial" | "Other";
}

export interface StoredLink {
    id: string;
    title: string;
    url: string;
    summary: string;
    insight?: string;
    category: string;
    tags: string[];
    notionUrl: string;
}

// ─── Markdown to Notion Blocks ───
function convertMarkdownToBlocks(markdown: string): any[] {
    const tokens = marked.lexer(markdown);
    const blocks: any[] = [];

    tokens.forEach((token: any) => {
        if (token.type === 'heading') {
            const type = `heading_${Math.min(token.depth, 3)}` as any;
            blocks.push({
                object: 'block',
                type: type,
                [type]: {
                    rich_text: [{ text: { content: token.text.slice(0, 2000) } }]
                }
            });
        } else if (token.type === 'paragraph') {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ text: { content: token.text.slice(0, 2000) } }]
                }
            });
        } else if (token.type === 'list') {
            token.items?.forEach((item: any) => {
                blocks.push({
                    object: 'block',
                    type: 'bulleted_list_item',
                    bulleted_list_item: {
                        rich_text: [{ text: { content: (item.text || '').slice(0, 2000) } }]
                    }
                });
            });
        } else if (token.type === 'blockquote') {
            blocks.push({
                object: 'block',
                type: 'quote',
                quote: {
                    rich_text: [{ text: { content: token.text.slice(0, 2000) } }]
                }
            });
        } else if (token.type === 'code') {
            blocks.push({
                object: 'block',
                type: 'code',
                code: {
                    language: token.lang || 'plain text',
                    rich_text: [{ text: { content: token.text.slice(0, 2000) } }]
                }
            });
        }
    });

    return blocks.slice(0, 99);
}

// ─── Save Bookmark ───
export async function saveBookmark(data: BookmarkData, url: string, content?: string): Promise<string> {
    try {
        let blocks: any[] = [];

        if (content) {
            try {
                blocks.push({
                    object: 'block',
                    type: 'heading_1',
                    heading_1: { rich_text: [{ text: { content: 'Full Content Archive' } }] }
                });
                blocks = [...blocks, ...convertMarkdownToBlocks(content)];
            } catch {
                const chunks = content.match(/.{1,2000}/g) || [];
                for (const chunk of chunks) {
                    blocks.push({
                        object: 'block',
                        type: 'paragraph',
                        paragraph: { rich_text: [{ text: { content: chunk } }] }
                    });
                }
            }
        }

        if (blocks.length > 100) {
            blocks = blocks.slice(0, 100);
        }

        const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                Name: { title: [{ text: { content: data.title } }] },
                URL: { url: url },
                Tags: { multi_select: data.tags.map(tag => ({ name: tag })) },
                Category: { select: { name: data.category } },
                Summary: { rich_text: [{ text: { content: data.summary.slice(0, 2000) } }] },
                Insight: { rich_text: [{ text: { content: data.insight.slice(0, 2000) } }] },
            },
            children: blocks
        });
        return (response as any).url;
    } catch (error) {
        console.error("Error saving to Notion:", error);
        throw error;
    }
}

// ─── Get Recent Links (using fetch API to avoid SDK issues) ───
export async function getRecentLinks(limit: number = 20): Promise<StoredLink[]> {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: limit,
                sorts: [{ timestamp: 'created_time', direction: 'descending' }]
            })
        });

        if (!response.ok) {
            console.error("Notion API Error:", await response.text());
            return [];
        }

        const data = await response.json();
        return data.results.map((page: any): StoredLink => {
            const props = page.properties;
            return {
                id: page.id,
                title: props.Name?.title?.[0]?.plain_text || "Untitled",
                url: props.URL?.url || "#",
                summary: props.Summary?.rich_text?.[0]?.plain_text || "",
                insight: props.Insight?.rich_text?.[0]?.plain_text || "",
                category: props.Category?.select?.name || "Other",
                tags: props.Tags?.multi_select?.map((t: any) => t.name) || [],
                notionUrl: page.url,
            };
        });
    } catch (error) {
        console.error("Error fetching recent links:", error);
        return [];
    }
}

// ─── Search Related Links (keyword match in tags) ───
export async function searchRelatedLinks(tags: string[], limit: number = 5): Promise<RelatedLink[]> {
    if (tags.length === 0) return [];

    try {
        const orFilters = tags.slice(0, 5).map(tag => ({
            property: "Tags",
            multi_select: { contains: tag }
        }));

        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: limit + 1, // Fetch one extra to exclude self
                filter: { or: orFilters },
                sorts: [{ timestamp: 'created_time', direction: 'descending' }]
            })
        });

        if (!response.ok) {
            console.error("Notion Search Error:", await response.text());
            return [];
        }

        const data = await response.json();
        return data.results.slice(0, limit).map((page: any): RelatedLink => {
            const props = page.properties;
            return {
                title: props.Name?.title?.[0]?.plain_text || "Untitled",
                summary: props.Summary?.rich_text?.[0]?.plain_text || "",
                url: props.URL?.url || undefined,
            };
        });
    } catch (error) {
        console.error("Error searching related links:", error);
        return [];
    }
}
