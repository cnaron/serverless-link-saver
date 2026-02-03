import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // Note: The SDK might not expose listModels directly on the main class in all versions,
    // but let's try accessing it via the model manager or similar if available, 
    // or just try a standard generation with a fallback to see the error.
    // Actually, usually it's separate. Let's try to just fetch the model info if possible.
    // Wait, the error message said "Call ListModels".
    // The 'generative-ai' Node SDK doesn't always expose listModels simply.
    // We might need to use the REST API directly for listing if the SDK doesn't make it obvious.

    // Let's try using the fetch API directly for certainty.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY found");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Available Models:");
        if (data.models) {
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log(data);
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
