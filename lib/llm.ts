import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface LinkSummary {
    title: string;
    summary: string;
    tags: string[];
    category: "Tech" | "News" | "Design" | "Tutorial" | "Other";
}

const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

export async function extractKeywords(content: string): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
        const prompt = `
      Analyze the following text and extract 3 most significant unique search keywords or phrases (max 2 words each) that would help find related articles in a personal knowledge base.
      Focus on specific topics, technologies, or concepts.
      
      Output a JSON array of strings, e.g. ["Next.js", "Vector DB", "System Design"].
      
      Text:
      ${content.slice(0, 10000)}
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return JSON.parse(text) as string[];
    } catch (e) {
        console.error("Error extracting keywords:", e);
        return [];
    }
}

export async function summarizeContent(
    content: string,
    originalUrl: string,
    context: any[] = []
): Promise<LinkSummary> {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });

        // Truncate content if too long
        const truncatedContent = content.slice(0, 50000);

        const contextString = context.map(c => `- [${c.category}] ${c.title}: ${c.summary}`).join("\n");

        const prompt = `
      You are an expert content curator. Analyze the following markdown content from the URL: ${originalUrl}.
      
      I will provide "Recent Context" (the last few articles I saved). 
      If the new content relates to any of them (supports, contradicts, updates, or complements), PLEASE MENTION IT in the summary.
      
      Recent Context:
      ${contextString}

      Output a JSON object with:
      - title: A concise and descriptive title.
      - summary: A deep, insightful summary in Chinese (Simplified). Do not just recap. Extract key insights, "Aha!" moments, and value propositions. Structure it as a short paragraph followed by 3 bullet points of "Key Takeaways". 
      - tags: An array of 3-5 relevant hashtags (strings, no #).
      - category: One of ["Tech", "News", "Design", "Tutorial", "Other"].
      
      Content:
      ${truncatedContent}
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Clean up markdown code blocks if present
        const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();

        return JSON.parse(cleanText) as LinkSummary;
    } catch (error) {
        console.error("Error summarizing content with Gemini:", error);
        throw error;
    }
}
