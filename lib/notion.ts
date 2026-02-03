import { Client } from "@notionhq/client";
import { LinkSummary } from "./llm";

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function saveBookmark(data: LinkSummary, url: string, content?: string) {
    try {
        const blocks: any[] = [];

        // Add content blocks if provided
        if (content) {
            // Split content into chunks of 2000 characters (Notion limit)
            // A simple approach: split by newlines first to try and keep paragraphs intact.
            const chunks = content.match(/.{1,2000}/g) || [];

            blocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: {
                    rich_text: [{ text: { content: 'Full Content Archive' } }]
                }
            });

            for (const chunk of chunks) {
                blocks.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: chunk } }]
                    }
                });
            }
        }

        await notion.pages.create({
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
        return true;
    } catch (error) {
        console.error("Error saving to Notion:", error);
        throw error;
    }
}
