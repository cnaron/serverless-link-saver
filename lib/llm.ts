import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

export interface SummaryResult {
    summary: string;
    tags: string[];
}

export interface InsightResult {
    insight: string;
}

export interface RelatedLink {
    id?: string;
    title: string;
    summary: string;
    url?: string;
}

/**
 * Stage 1: Generate Summary and Tags.
 * Prompt is a direct translation from LinkMind's agent.ts `generateSummary`.
 */
export async function generateSummary(input: {
    url: string;
    title?: string;
    description?: string;
    markdown: string;
}): Promise<SummaryResult> {
    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
        });

        // Truncate to avoid token limits (LinkMind uses 12000)
        const content = input.markdown.slice(0, 12000);

        const prompt = `你是一个信息分析助手。用户会给你一篇文章的内容，请你：
1. 用中文写一个简洁的摘要（3-5句话），抓住核心要点。无论原文是什么语言，摘要必须使用中文。
2. 提取 3-5 个关键标签（用于后续搜索关联内容）

以 JSON 格式输出：
{"summary": "...", "tags": ["tag1", "tag2", ...]}

注意：summary 字段必须是中文，不要使用英文。

标题: ${input.title || '无'}
来源: ${input.url}
描述: ${input.description || '无'}

正文:
${content}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();

        try {
            const parsed = JSON.parse(cleanText);
            return {
                summary: parsed.summary || '无法生成摘要',
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            };
        } catch {
            return { summary: cleanText.slice(0, 500), tags: [] };
        }
    } catch (error) {
        console.error("Error in generateSummary:", error);
        throw error;
    }
}

/**
 * Stage 2: Generate Insight based on related content.
 * Prompt is a direct translation from LinkMind's agent.ts `generateInsight`.
 */
export async function generateInsight(input: {
    title: string;
    url: string;
    summary: string;
    relatedLinks: RelatedLink[];
}): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const linksContext = input.relatedLinks.length > 0
            ? input.relatedLinks.map(l => `- [${l.title}](${l.url || '#'}) ${l.summary.slice(0, 100)}`).join('\n')
            : '（无相关历史链接）';

        const prompt = `你是用户的个人信息分析师。用户是一个 web 开发者，关注 AI 工具、开发者工具和开源项目。

你的任务是从**用户的角度**思考这篇文章的价值：
- 这篇文章讲了什么新东西？有什么值得关注的？
- 和用户过去关注的内容有什么关联？
- 对用户的工作或项目有什么启发？
- 是否值得深入研究？

语气要像朋友之间的分享，简洁有力，不要模板化的套话。2-4 句话即可。

文章: ${input.title || input.url}
摘要: ${input.summary}

用户之前收藏过的相关链接:
${linksContext}

请给出你的 insight：`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return text || '无法生成 insight';
    } catch (error) {
        console.error("Error in generateInsight:", error);
        return '无法生成 insight';
    }
}

/**
 * Convenience type for the full analysis result.
 */
export interface FullAnalysisResult {
    title: string;
    summary: string;
    insight: string;
    tags: string[];
    category: "Tech" | "News" | "Design" | "Tutorial" | "Other";
}

/**
 * Determine category based on tags (simple heuristic).
 */
export function inferCategory(tags: string[]): "Tech" | "News" | "Design" | "Tutorial" | "Other" {
    const lowerTags = tags.map(t => t.toLowerCase());
    if (lowerTags.some(t => ['ai', 'llm', 'api', 'code', 'dev', 'database', 'cloud', 'serverless'].includes(t))) return 'Tech';
    if (lowerTags.some(t => ['ui', 'ux', 'design', 'figma', 'font', 'css'].includes(t))) return 'Design';
    if (lowerTags.some(t => ['tutorial', 'guide', 'howto', '教程'].includes(t))) return 'Tutorial';
    if (lowerTags.some(t => ['news', '新闻', 'announcement'].includes(t))) return 'News';
    return 'Other';
}
