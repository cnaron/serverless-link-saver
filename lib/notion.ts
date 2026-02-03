import { Client } from "@notionhq/client";
import { LinkSummary } from "./llm";

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function saveBookmark(data: LinkSummary, url: string) {
    try {
        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                Name: { // Assuming "Name" is the title property
                    title: [
                        {
                            text: {
                                content: data.title,
                            },
                        },
                    ],
                },
                URL: { // Text or URL property
                    url: url,
                },
                Tags: { // Multi-select
                    multi_select: data.tags.map((tag) => ({ name: tag })),
                },
                Category: { // Select
                    select: {
                        name: data.category,
                    },
                },
                Summary: { // Text/RichText
                    rich_text: [
                        {
                            text: {
                                content: data.summary,
                            },
                        },
                    ],
                },
            },
            // We can also append the full content as blocks if we want, but Notion has block limits.
            // For now, let's just save metadata.
        });
        return true;
    } catch (error) {
        console.error("Error saving to Notion:", error);
        throw error;
    }
}
