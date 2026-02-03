import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function GET() {
    try {
        const response = await notion.databases.query({
            database_id: databaseId,
        });

        const nodes: any[] = [];
        const links: any[] = [];
        const existingNodes = new Set<string>();

        response.results.forEach((page: any) => {
            // 1. Article Node
            const pageId = page.id;
            const title = page.properties.Name.title[0]?.text.content || "Untitled";
            const category = page.properties.Category.select?.name || "Uncategorized";

            const url = page.properties.URL?.url || page.url; // 'page.url' is the Notion public link

            if (!existingNodes.has(pageId)) {
                nodes.push({
                    id: pageId,
                    name: title,
                    group: "article",
                    val: 20, // Size
                    url: url // Pass URL to frontend
                });
                existingNodes.add(pageId);
            }

            // 2. Tag Nodes & Links
            const tags = page.properties.Tags.multi_select || [];
            tags.forEach((tag: any) => {
                const tagId = `tag-${tag.name}`;

                if (!existingNodes.has(tagId)) {
                    nodes.push({
                        id: tagId,
                        name: tag.name,
                        group: "tag",
                        val: 10, // Size
                        color: "#ff00ff" // Distinct color for tags
                    });
                    existingNodes.add(tagId);
                }

                links.push({
                    source: pageId,
                    target: tagId,
                });
            });

            // 3. Category Links (Optional: link article to category node)
            // For now, let's keep it simple: Article <-> Tags
        });

        return NextResponse.json({ nodes, links });
    } catch (error) {
        console.error("Graph API Error:", error);
        return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
    }
}
