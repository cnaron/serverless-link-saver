/*
 * Usage: 
 * npx ts-node scripts/setup-database.ts <DATABASE_ID>
 */

import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.argv[2];

if (!databaseId) {
    console.error("❌ Error: Please provide the Database ID");
    process.exit(1);
}

async function setupDatabase() {
    console.log(`⏳ Configuring Database: ${databaseId}...`);
    try {
        // 1. Try to Update the Database Schema
        await notion.databases.update({
            database_id: databaseId,
            properties: {
                "Tags": {
                    multi_select: {},
                },
                "Category": {
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
                "Summary": {
                    rich_text: {},
                },
            },
        } as any);
        console.log("✅ Database Schema Updated Successfully!");

        // 2. Verify URL property exists or create it
        // Note: We can't easily rename properties by API without checking existing names.
        // We assume 'URL' might be missing if it's a fresh DB.
        try {
            await notion.databases.update({
                database_id: databaseId,
                properties: {
                    "URL": { url: {} }
                }
            } as any);
            console.log("✅ 'URL' property verified.");
        } catch (e) {
            console.log("⚠️ Could not add 'URL' property (might already exist with different type).");
        }

        console.log("------------------------------------------------");
        console.log(`📝 Your DATABASE_ID is ready: ${databaseId}`);
        console.log("------------------------------------------------");

    } catch (error: any) {
        console.error("❌ Failed to configure database:", error.body || error);
        // Fallback? If it wasn't found, maybe the user hasn't connected the integration?
    }
}

setupDatabase();
