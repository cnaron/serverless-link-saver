import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface LinkSummary {
    title: string;
    summary: string;
    tags: string[];
    category: "Tech" | "News" | "Design" | "Tutorial" | "Other";
}

export async function summarizeContent(content: string, originalUrl: string): Promise<LinkSummary | null> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

        // Truncate content if too long to save token cost/time, though Flash context is huge.
        // 50k chars is safe.
        const truncatedContent = content.slice(0, 50000);

        const prompt = `
      You are an expert content curator. Analyze the following markdown content from the URL: ${originalUrl}.
      
      Output a JSON object with:
      - title: A concise and descriptive title.
      - summary: A 2-3 sentence summary of the key points.
      - tags: An array of 3-5 relevant hashtags (strings, no #).
      - category: One of ["Tech", "News", "Design", "Tutorial", "Other"].
      
      Content:
      ${truncatedContent}
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return JSON.parse(text) as LinkSummary;
    } catch (error) {
        console.error("Error summarizing content with Gemini:", error);
        return null;
    }
}
