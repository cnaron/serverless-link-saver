import { NextRequest, NextResponse } from "next/server";

const NOTION_KEY = process.env.NOTION_KEY!;

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const pageId = params.id;

    try {
        // 1. Fetch page properties
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            headers: {
                'Authorization': `Bearer ${NOTION_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        });

        if (!pageRes.ok) {
            return NextResponse.json({ error: "Page not found" }, { status: 404 });
        }

        const page = await pageRes.json();
        const props = page.properties;

        // 2. Fetch page content (blocks)
        const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
            headers: {
                'Authorization': `Bearer ${NOTION_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        });

        const blocksData = await blocksRes.json();
        const blocks = blocksData.results || [];

        // 3. Convert blocks to markdown
        const markdown = blocksToMarkdown(blocks);

        // 4. Get tags for related search
        const tags = props.Tags?.multi_select?.map((t: any) => t.name) || [];

        return NextResponse.json({
            id: page.id,
            title: props.Name?.title?.[0]?.plain_text || "Untitled",
            url: props.URL?.url || "#",
            summary: props.Summary?.rich_text?.[0]?.plain_text || "",
            insight: props.Insight?.rich_text?.[0]?.plain_text || "",
            category: props.Category?.select?.name || "Other",
            tags,
            notionUrl: page.url,
            content: markdown,
        });
    } catch (error) {
        console.error("Error fetching article:", error);
        return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 });
    }
}

// Helper: Convert Notion blocks to Markdown
function blocksToMarkdown(blocks: any[]): string {
    return blocks.map((block) => {
        const type = block.type;
        const content = block[type];

        if (!content) return '';

        const getText = (richText: any[]) =>
            richText?.map((t: any) => t.plain_text || '').join('') || '';

        switch (type) {
            case 'heading_1':
                return `# ${getText(content.rich_text)}`;
            case 'heading_2':
                return `## ${getText(content.rich_text)}`;
            case 'heading_3':
                return `### ${getText(content.rich_text)}`;
            case 'paragraph':
                return getText(content.rich_text);
            case 'bulleted_list_item':
                return `- ${getText(content.rich_text)}`;
            case 'numbered_list_item':
                return `1. ${getText(content.rich_text)}`;
            case 'quote':
                return `> ${getText(content.rich_text)}`;
            case 'code':
                return `\`\`\`${content.language || ''}\n${getText(content.rich_text)}\n\`\`\``;
            case 'divider':
                return '---';
            default:
                return '';
        }
    }).filter(Boolean).join('\n\n');
}
