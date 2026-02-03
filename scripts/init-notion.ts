/*
 * Usage: 
 * 1. Add NOTION_KEY to .env
 * 2. Run: npx ts-node scripts/init-notion.ts <PARENT_PAGE_ID>
 */

import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_KEY });

const parentPageId = process.argv[2];

if (!process.env.NOTION_KEY) {
    console.error("❌ Error: NOTION_KEY is missing in .env file.");
    process.exit(1);
}

if (!parentPageId) {
    console.error("❌ Error: Please provide the Parent Page ID as an argument.");
    console.error("Usage: npx ts-node scripts/init-notion.ts <PARENT_PAGE_ID>");
    process.exit(1);
}

async function createDatabase() {
    try {
        console.log(`⏳ Creating database under page: ${parentPageId}...`);

        const response = await notion.databases.create({
            parent: {
                type: "page_id",
                page_id: parentPageId,
            },
            title: [
                {
                    type: "text",
                    text: {
                        content: "LinkMind Bookmarks",
                    },
                },
            ],
            properties: {
                Name: {
                    title: {},
                },
                URL: {
                    url: {},
                },
                Tags: {
                    multi_select: {},
                },
                Category: {
                    select: {
                        options: [
                            { name: "Tech", color: "blue" },
                            { name: "News", color: "green" },
                            { name: "Design", color: "pink" },
                            { name: "Tutorial", color: "orange" },
                            { name: "Other", color: "gray" },
                        ],
                    },
                },
                Summary: {
                    rich_text: {},
                },
            },
        } as any);

        console.log("✅ Database Created Successfully!");
        console.log("------------------------------------------------");
        console.log(`📝 Database ID: ${response.id}`);
        console.log("------------------------------------------------");
        console.log("👉 Please copy this Database ID and paste it into your .env file as NOTION_DATABASE_ID");

    } catch (error: any) {
        console.error("❌ Failed to create database:", error.body || error);
    }
}

createDatabase();
