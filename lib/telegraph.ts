import Telegraph from "telegraph-node";
import { marked } from "marked";

const ph = new Telegraph();

// Configure Marked to treat newlines as <br> (breaks: true)
marked.use({
    breaks: true,
    gfm: true
});

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

// Helper to strip HTML tags if needed
function stripHtml(html: string) {
    return html.replace(/<[^>]*>?/gm, '');
}

/**
 * Converts Marked tokens to Telegraph Nodes recursively.
 */
function processToken(token: any): any {
    // 1. Text Nodes
    if (token.type === 'text' || token.type === 'escape') {
        // Handle inline formatting recursively if present
        if (token.tokens && token.tokens.length > 0) {
            return token.tokens.map(processToken);
        }
        // Fallback: Check for raw HTML-like strings that Marked might have missed or passed through
        // But for Telegraph purely text node, we just return text.
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
        // Telegraph creates a figure for images with caption usually, but single img tag is allowed
        // But caption is nice.
        const imgNode = {
            tag: 'img',
            attrs: { src: token.href },
        };
        if (token.title || token.text) {
            return {
                tag: 'figure',
                children: [
                    imgNode,
                    { tag: 'figcaption', children: [token.title || token.text] }
                ]
            };
        }
        return imgNode;
    }
    if (token.type === 'br' || token.type === 'space') {
        return { tag: 'br' };
    }
    if (token.type === 'hr') {
        return { tag: 'hr' };
    }

    // 3. Block Elements
    if (token.type === 'paragraph') {
        // Special case: If paragraph contains ONLY an image, don't wrap in p tag?
        // Telegraph P tag can contain links and text.
        return { tag: 'p', children: token.tokens.map(processToken) };
    }
    if (token.type === 'heading') {
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
        // List items in marked can have 'task' checkbox
        let children = token.tokens.map(processToken);
        if (token.task) {
            const checkbox = token.checked ? '[x] ' : '[ ] ';
            children = [checkbox, ...children];
        }
        return {
            tag: 'li',
            children: children
        };
    }
    if (token.type === 'blockquote') {
        return {
            tag: 'blockquote',
            children: token.tokens.map(processToken)
        };
    }
    if (token.type === 'code') {
        // Telegraph doesn't support syntax highlighting classes, just pre/code
        return {
            tag: 'pre',
            children: [{
                tag: 'code',
                children: [token.text]
            }]
        };
    }

    // 4. HTML parsing - Robust Attempt
    if (token.type === 'html') {
        const html = token.text.trim();

        // Check for specific tags Telegraph supports
        if (html.startsWith('<img')) {
            const srcMatch = html.match(/src="([^"]+)"/);
            if (srcMatch) return { tag: 'img', attrs: { src: srcMatch[1] } };
        }

        if (html.startsWith('<video')) {
            const srcMatch = html.match(/src="([^"]+)"/);
            if (srcMatch) return { tag: 'video', attrs: { src: srcMatch[1] } };
        }

        if (html.startsWith('<iframe')) {
            const srcMatch = html.match(/src="([^"]+)"/);
            // Telegraph allows iframes from YouTube, Vimeo, Twitter, etc.
            if (srcMatch) return { tag: 'iframe', attrs: { src: srcMatch[1] } };
        }

        // Simple formatting
        if (html.includes('<b>') || html.includes('<strong>')) {
            return { tag: 'b', children: [stripHtml(html)] };
        }
        if (html.includes('<i>') || html.includes('<em>')) {
            return { tag: 'i', children: [stripHtml(html)] };
        }

        // Just return text content if we can't map it safely
        return stripHtml(html);
    }

    // Fallback: return nothing for unknown blocks to avoid crashing telegraph API
    // but try to return text if possible
    if (token.text) return token.text;
    return "";
}

function markdownToNodes(markdown: string): any[] {
    const tokens = marked.lexer(markdown);
    const nodes: any[] = [];

    // Helper to flatten arrays
    const addNode = (n: any) => {
        if (!n) return;
        if (Array.isArray(n)) {
            n.forEach(addNode);
        } else {
            nodes.push(n);
        }
    };

    tokens.forEach(token => {
        addNode(processToken(token));
    });

    return nodes;
}

interface TelegraphPageOptions {
    title: string;
    content: string; // Markdown
    url: string; // Original Source URL
    authorUrl?: string; // URL for the Author link (e.g. our App Detail Page)
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
        author_url: opts.authorUrl || opts.url,
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
