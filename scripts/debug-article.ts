import { GoogleGenerativeAI } from "@google/generative-ai";
// import fetch from "node-fetch"; // Rely on global fetch

// --- Jina Logic ---
async function fetchPageContent(url: string): Promise<string> {
    try {
        const response = await fetch(`https://r.jina.ai/${url}`, {
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error(`Jina error: ${response.statusText}`);
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            return json.data?.content || text;
        } catch { return text; }
    } catch (e) { console.error(e); return ""; }
}

// --- LLM Logic ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

async function generateInsight(input: any): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const prompt = `Generate a short insight for the user about: ${input.title} - ${input.url}`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error in generateInsight:", error);
        throw error;
    }
}

// --- Run ---
const TARGET_URL = "https://x.com/karpathy/status/1886192184808149383";

async function run() {
    console.log("1. Fetching Jina Content...");
    const content = await fetchPageContent(TARGET_URL);
    console.log("\n--- RAW MARKDOWN START ---");
    console.log(content);
    console.log("--- RAW MARKDOWN END ---\n");

    console.log("2. Testing Insight...");
    try {
        const insight = await generateInsight({
            title: "Test",
            url: TARGET_URL,
            summary: "summary"
        });
        console.log("Insight:", insight);
    } catch (e) {
        console.error("Insight Failed:", e);
    }
}

run();
