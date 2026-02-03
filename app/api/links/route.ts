import { NextRequest, NextResponse } from "next/server";
import { getRecentLinks, searchRelatedLinks } from "@/lib/notion";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const tagFilter = url.searchParams.get('tag');

        if (tagFilter) {
            // Filter by tag
            const links = await searchRelatedLinks([tagFilter], 50);
            // searchRelatedLinks returns RelatedLink[], but we need full StoredLink
            // For now, get all and filter client-side (or enhance searchRelatedLinks)
            const allLinks = await getRecentLinks(100);
            const filtered = allLinks.filter(link =>
                link.tags.some(t => t.toLowerCase() === tagFilter.toLowerCase())
            );
            return NextResponse.json(filtered);
        }

        const links = await getRecentLinks(50);
        return NextResponse.json(links);
    } catch (error) {
        console.error("API /api/links error:", error);
        return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 });
    }
}
