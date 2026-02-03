import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface LinkSummary {
    title: string;
    summary: string;
    tags: string[];
    category: "Tech" | "News" | "Design" | "Tutorial" | "Other";
}

export async function extractKeywords(content: string): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
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
): Promise<LinkSummary | null> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

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
      - summary: A 2-3 sentence summary (mentions context if relevant).
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
