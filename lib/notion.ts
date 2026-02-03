import { Client } from "@notionhq/client";
import { LinkSummary } from "./llm";
import { marked } from "marked";

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

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
        } else if (token.type === 'list_item') {
            // marked nesting is complex, simplifying to bullet points for now
            blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                    rich_text: [{ text: { content: token.text.slice(0, 2000) } }]
                }
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

    // Notion API limit: 100 blocks per request. If more, we trunc for now or need pagination (advanced)
    return blocks.slice(0, 99);
}

export async function saveBookmark(data: LinkSummary, url: string, content?: string) {
    try {
        let blocks: any[] = [];

        // Add content blocks if provided
        if (content) {
            try {
                // Add a header first
                blocks.push({
                    object: 'block',
                    type: 'heading_1',
                    heading_1: {
                        rich_text: [{ text: { content: 'Full Content Archive' } }]
                    }
                });

                const contentBlocks = convertMarkdownToBlocks(content);
                blocks = [...blocks, ...contentBlocks];
            } catch (e) {
                console.error("Error converting markdown to blocks:", e);
                // Fallback to simpler chunking if complex parsing fails
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

        // Ensure we don't exceed 100 blocks (Notion API Create limit)
        if (blocks.length > 100) {
            blocks = blocks.slice(0, 100);
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ text: { content: "... (Content truncated due to Notion API limits)" } }]
                }
            });
        }

        const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                Name: {
                    title: [{ text: { content: data.title } }],
                },
                URL: {
                    url: url,
                },
                Tags: {
                    multi_select: data.tags.map((tag) => ({ name: tag })),
                },
                Category: {
                    select: { name: data.category },
                },
                Summary: {
                    rich_text: [{ text: { content: data.summary } }],
                },
            },
            children: blocks
        });
        return (response as any).url;
    } catch (error) {
        console.error("Error saving to Notion:", error);
        throw error;
    }
}

export async function searchSimilarBookmarks(keywords: string[]) {
    if (keywords.length === 0) return [];

    try {
        // Construct OR filter for Title and Tags
        const orFilter: any[] = [];
        keywords.forEach(kw => {
            orFilter.push({
                property: "Name",
                title: { contains: kw }
            });
            orFilter.push({
                property: "Tags",
                multi_select: { contains: kw }
            });
        });

        const response = await (notion.databases as any).query({
            database_id: databaseId,
            page_size: 10,
            filter: {
                or: orFilter
            }
        });

        return response.results.map((page: any) => {
            return {
                title: page.properties.Name.title[0]?.text.content || "Untitled",
                summary: page.properties.Summary.rich_text[0]?.text.content || "",
                category: page.properties.Category.select?.name || "",
                tags: page.properties.Tags.multi_select?.map((t: any) => t.name).join(", ") || "",
            };
        });
    } catch (error) {
        console.error("Error searching similar bookmarks:", error);
        return [];
    }
}
