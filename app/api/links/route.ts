import { NextResponse } from "next/server";
import { getRecentLinks } from "@/lib/notion";

export const dynamic = 'force-dynamic'; // Disable static generation for this route

export async function GET() {
    try {
        const links = await getRecentLinks(50);
        return NextResponse.json(links);
    } catch (error) {
        console.error("API /api/links error:", error);
        return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 });
    }
}
