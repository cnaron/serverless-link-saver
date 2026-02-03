import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function GET() {
    try {
        const response = await (notion.databases as any).query({
            database_id: databaseId,
            sorts: [
                {
                    property: "Created", // Assuming default timestamp, or we might need to check properties
                    direction: "descending",
                },
            ],
        });

        const links = response.results.map((page: any) => {
            const props = page.properties;
            return {
                id: page.id,
                title: props.Name?.title?.[0]?.plain_text || "Untitled",
                url: props.URL?.url || "#",
                category: props.Category?.select?.name || "Uncategorized",
                tags: props.Tags?.multi_select?.map((t: any) => t.name) || [],
                summary: props.Summary?.rich_text?.[0]?.plain_text || "No summary available.",
                notionUrl: page.url, // Link to the Notion page
            };
        });

        return NextResponse.json(links);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 });
    }
}
