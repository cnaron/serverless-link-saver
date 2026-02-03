import Telegraph from "telegraph-node";
import { marked } from "marked";

const ph = new Telegraph();

// User should persist this token. For serverless, we'll try to use an env var, 
// or create a new account if missing (not ideal for editing, but fine for archiving).
const ACCESS_TOKEN = process.env.TELEGRAPH_ACCESS_TOKEN;

/**
 * Creates a new Telegra.ph account (if needed).
 * Useful for one-time setup or if token is lost.
 */
export async function createAccount(shortName: string, authorName: string) {
    const account = await ph.createAccount(shortName, { author_name: authorName });
    return account.access_token;
}

/**
 * Converts Markdown to Telegra.ph Nodes.
 * Since telegraph-node expects a specific DOM-like structure, we'll do a simplified conversion.
 * 
 * Note: telegraph-node's types might be tricky. The API expects an array of Nodes.
 * Node = String | { tag: string, attrs?: object, children?: Node[] }
 */
/**
 * Converts Marked tokens to Telegraph Nodes recursively.
 */
function processToken(token: any): any {
    // 1. Text Nodes
    if (token.type === 'text' || token.type === 'escape') {
        // If the text token has nested tokens (inline formatting), process them recursively
        if (token.tokens) {
            return token.tokens.map(processToken);
        }
        return token.text;
    }

    // 2. Inline Formatting
    if (token.type === 'strong') {
        return { tag: 'b', children: token.tokens.map(processToken) };
    }
    if (token.type === 'em') {
        return { tag: 'i', children: token.tokens.map(processToken) };
    }
    if (token.type === 'del') {
        return { tag: 's', children: token.tokens.map(processToken) };
    }
    if (token.type === 'codespan') {
        return { tag: 'code', children: [token.text] };
    }
    if (token.type === 'link') {
        return {
            tag: 'a',
            attrs: { href: token.href },
            children: token.tokens.map(processToken)
        };
    }
    if (token.type === 'image') {
        return {
            tag: 'img',
            attrs: { src: token.href },
            children: [] // Images are void elements in Telegraph usually
        };
    }
    if (token.type === 'br' || token.type === 'space') {
        return { tag: 'br' };
    }

    // 3. Block Elements
    if (token.type === 'paragraph') {
        return { tag: 'p', children: token.tokens.map(processToken) };
    }
    if (token.type === 'heading') {
        // Telegraph only supports h3 and h4. Map h1/h2 -> h3
        const tag = token.depth <= 2 ? 'h3' : 'h4';
        return { tag, children: token.tokens.map(processToken) };
    }
    if (token.type === 'list') {
        const tag = token.ordered ? 'ol' : 'ul';
        return {
            tag,
            children: token.items.map(processToken)
        };
    }
    if (token.type === 'list_item') {
        return {
            tag: 'li',
            children: token.tokens.map(processToken)
        };
    }
    if (token.type === 'blockquote') {
        return {
            tag: 'blockquote',
            children: token.tokens.map(processToken)
        };
    }
    if (token.type === 'code') {
        return {
            tag: 'pre',
            children: [{
                tag: 'code',
                children: [token.text]
            }]
        };
    }

    // 4. HTML parsing basic support
    if (token.type === 'html') {
        // Allow basic tags if possible, or just return text content
        // For simple bold/italic in HTML
        if (token.text.match(/<b>|<strong>/)) {
            return { tag: 'b', children: [token.text.replace(/<[^>]*>/g, '')] };
        }
        if (token.text.match(/<i>|<em>/)) {
            return { tag: 'i', children: [token.text.replace(/<[^>]*>/g, '')] };
        }
        return token.text.replace(/<[^>]*>/g, ''); // Strip tags for safety/compatibility
    }

    // Fallback for unknown elements -> string representation only
    // Ideally we shouldn't hit this often if we cover standard tokens
    if (token.text) return token.text;
    return "";
}

function markdownToNodes(markdown: string): any[] {
    const tokens = marked.lexer(markdown);

    // Flatten the result of mapping, as processToken can return arrays (fragment-like) 
    // or single objects
    const nodes: any[] = [];

    tokens.forEach(token => {
        const result = processToken(token);
        if (Array.isArray(result)) {
            nodes.push(...result);
        } else if (result) {
            nodes.push(result);
        }
    });

    return nodes;
}

interface TelegraphPageOptions {
    title: string;
    content: string; // Markdown
    url: string;
    summary?: string;
    insight?: string;
}

/**
 * Uploads content to Telegra.ph with rich header and metadata.
 */
export async function createTelegraphPage(opts: TelegraphPageOptions) {
    let token = ACCESS_TOKEN;

    if (!token) {
        // Fallback: Create a temporary account (Token will be lost on restart!)
        // In production, user should set TELEGRAPH_ACCESS_TOKEN env var.
        console.warn("TELEGRAPH_ACCESS_TOKEN not found. Creating temporary account.");
        token = await createAccount("LinkSaver", "AI Link Saver");
    }

    const contentNodes = markdownToNodes(opts.content);

    // Construct Header Nodes
    // 1. Original Link
    // 2. Beijing Time
    // 3. Summary (Quote block)
    // 4. Insight (Quote block with indicator)
    // 5. Divider
    const headerNodes: any[] = [];

    // Beijing Time
    const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    headerNodes.push({
        tag: 'p',
        children: [
            { tag: 'a', attrs: { href: opts.url }, children: [`🔗 原文链接`] },
            `  |  📅 ${beijingTime}`
        ]
    });

    if (opts.summary) {
        headerNodes.push({ tag: 'h4', children: ['📝 AI 摘要'] });
        headerNodes.push({ tag: 'blockquote', children: [opts.summary] });
    }

    if (opts.insight) {
        headerNodes.push({ tag: 'h4', children: ['💡 深度洞见'] });
        headerNodes.push({
            tag: 'blockquote',
            children: [{ tag: 'b', children: ['Insight: '] }, opts.insight]
        });
    }

    headerNodes.push({ tag: 'hr' });
    headerNodes.push({ tag: 'h4', children: ['📄 原文内容'] });
    headerNodes.push({ tag: 'br' });

    const finalNodes = [...headerNodes, ...contentNodes];

    const page = await ph.createPage(token!, opts.title, finalNodes, {
        author_name: "LinkSaver AI",
        author_url: opts.url, // Link author name to original URL
        return_content: true
    });

    return page.url;
}

/**
 * Fetches a Telegra.ph page by path.
 */
export async function getTelegraphPage(path: string) {
    // path is the part after https://telegra.ph/
    try {
        const page = await ph.getPage(path, { return_content: true });
        return page;
    } catch (error) {
        console.error("Error fetching Telegra.ph page:", error);
        return null;
    }
}
