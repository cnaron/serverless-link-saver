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
// Helper to map and flatten tokens
function processTokens(tokens: any[]): any[] {
    if (!tokens) return [];
    return tokens.map(processToken).flat().filter(Boolean);
}

/**
 * Converts Marked tokens to Telegraph Nodes recursively.
 */
function processToken(token: any): any {
    // 1. Text Nodes
    if (token.type === 'text' || token.type === 'escape') {
        // Handle inline formatting recursively if present
        if (token.tokens && token.tokens.length > 0) {
            return processTokens(token.tokens);
        }
        // Fallback: Check for raw HTML-like strings that Marked might have missed or passed through
        // But for Telegraph purely text node, we just return text.
        return token.text;
    }

    // 2. Inline Formatting
    if (token.type === 'strong') {
        return { tag: 'b', children: processTokens(token.tokens) };
    }
    if (token.type === 'em') {
        return { tag: 'i', children: processTokens(token.tokens) };
    }
    if (token.type === 'del') {
        return { tag: 's', children: processTokens(token.tokens) };
    }
    if (token.type === 'codespan') {
        return { tag: 'code', children: [token.text] };
    }
    if (token.type === 'link') {
        return {
            tag: 'a',
            attrs: { href: token.href },
            children: processTokens(token.tokens)
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
    if (token.type === 'br') {
        return { tag: 'br' };
    }
    if (token.type === 'space') {
        // Ignore structural spacing tokens (paragraphs provide their own spacing)
        // This fixes the "too many empty lines" issue.
        return null;
    }
    if (token.type === 'hr') {
        return { tag: 'hr' };
    }

    // 3. Block Elements
    if (token.type === 'paragraph') {
        // Special case: If paragraph contains ONLY an image, don't wrap in p tag?
        // Telegraph P tag can contain links and text.
        return { tag: 'p', children: processTokens(token.tokens) };
    }
    if (token.type === 'heading') {
        const tag = token.depth <= 2 ? 'h3' : 'h4';
        return { tag, children: processTokens(token.tokens) };
    }
    if (token.type === 'list') {
        const tag = token.ordered ? 'ol' : 'ul';
        // items is array of list_item tokens
        return {
            tag,
            children: token.items.map(processToken) // list items themselves are wrappers, don't flatten list items into one list
        };
    }
    if (token.type === 'list_item') {
        // List items in marked can have 'task' checkbox
        let children = processTokens(token.tokens);
        if (token.task) {
            const checkbox = token.checked ? '[x] ' : '[ ] ';
            children = [checkbox, ...children];
        }

        // Unwrap <p> tags inside <li> to prevent invalid nesting for Instant View
        // Telegraph doesn't like block level elements inside <li> sometimes
        children = children.flatMap(child => {
            if (child && typeof child === 'object' && child.tag === 'p') {
                return child.children || [];
            }
            return child;
        });

        return {
            tag: 'li',
            children: children
        };
    }
    if (token.type === 'blockquote') {
        let children = processTokens(token.tokens);

        // Unwrap <p> tags inside <blockquote>
        children = children.flatMap(child => {
            if (child && typeof child === 'object' && child.tag === 'p') {
                // Add a break if there are multiple paragraphs
                return [...(child.children || []), { tag: 'br' }];
            }
            return child;
        });

        // Remove trailing <br> if added
        if (children.length > 0 && children[children.length - 1].tag === 'br') {
            children.pop();
        }

        return {
            tag: 'blockquote',
            children: children
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

    if (token.type === 'table') {
        // Convert Markdown table to ASCII table for Telegra.ph (inside pre/code)
        const headers = token.header.map((h: any) => h.text);
        const alignments = token.align;
        const rows = token.rows.map((row: any[]) => row.map((cell: any) => cell.text));

        // Calculate column widths
        const colWidths = headers.map((h: string, i: number) => {
            let max = h.length;
            rows.forEach((row: string[]) => {
                if (row[i] && row[i].length > max) max = row[i].length;
            });
            return max;
        });

        // Helper to pad string
        const pad = (str: string, length: number) => {
            return str + ' '.repeat(Math.max(0, length - (str || '').length));
        };

        // Build Table String
        let tableStr = '| ' + headers.map((h: string, i: number) => pad(h, colWidths[i])).join(' | ') + ' |\n';
        tableStr += '|-' + headers.map((_: any, i: number) => '-'.repeat(colWidths[i])).join('-|-') + '-|\n';

        rows.forEach((row: string[]) => {
            tableStr += '| ' + row.map((cell: string, i: number) => pad(cell || '', colWidths[i])).join(' | ') + ' |\n';
        });

        return {
            tag: 'pre',
            children: [{
                tag: 'code',
                children: [tableStr]
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

const BLOCK_TAGS = ['p', 'h3', 'h4', 'blockquote', 'aside', 'figure', 'ul', 'ol', 'hr', 'pre'];

function markdownToNodes(markdown: string): any[] {
    const tokens = marked.lexer(markdown);
    const rawNodes: any[] = [];

    // Helper to flatten arrays
    const addNode = (n: any) => {
        if (!n) return;
        if (Array.isArray(n)) {
            n.forEach(addNode);
        } else {
            rawNodes.push(n);
        }
    };

    tokens.forEach(token => {
        const processed = processToken(token);
        addNode(processed);
    });

    // Group consecutive inline nodes into <p>
    const finalNodes: any[] = [];
    let inlineBuffer: any[] = [];

    const flushBuffer = () => {
        if (inlineBuffer.length > 0) {
            finalNodes.push({
                tag: 'p',
                children: [...inlineBuffer]
            });
            inlineBuffer = [];
        }
    };

    for (const node of rawNodes) {
        // If node is a string, it's inline text
        // If node is an object with a tag, check if it's a block tag
        const isBlock = typeof node === 'object' && node.tag && BLOCK_TAGS.includes(node.tag);

        // Treat pre/code (tables) as block
        if (isBlock) {
            flushBuffer();
            finalNodes.push(node);
        } else {
            // It's inline (text, b, i, a, br, img, etc not in figure)
            // Note: img can be block-like but telegra.ph accepts p>img
            inlineBuffer.push(node);
        }
    }
    flushBuffer();

    return finalNodes;
}

interface TelegraphPageOptions {
    title: string;
    content: string; // Markdown
    url: string; // Original Source URL
    authorUrl?: string; // URL for the Author link (e.g. our App Detail Page)
    summary?: string;
    insight?: string;
    image?: string;
}

/**
 * Uploads content to Telegra.ph with rich header and metadata.
 */
export async function createTelegraphPage(opts: TelegraphPageOptions) {
    let token = ACCESS_TOKEN;

    if (!token) {
        console.warn("TELEGRAPH_ACCESS_TOKEN not found. Creating temporary account.");
        token = await createAccount("LinkSaver", "AI Link Saver");
    }

    const contentNodes = markdownToNodes(opts.content);
    const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    // Simplify date for author field
    const simpleDate = beijingTime.split(' ')[0];

    const headerNodes: any[] = [];

    /*
    // 0. Hero Image - REMOVED per user request
    if (opts.image) {
        headerNodes.push({
            tag: 'img',
            attrs: { src: opts.image }
        });
        headerNodes.push({ tag: 'br' }); // Spacing
    }
    */

    // Strategy Update:
    // 1. Metadata (Link/Date) -> Moved to 'Author' field natively supported by IV
    // 2. Summary/Insight -> REMOVED from body per user request (User wants clean original text)

    /* 
    // REMOVED: Summary & Insight are now only in Telegram Message
    if (opts.summary) {
        headerNodes.push({ 
            tag: 'p', 
            children: [
                { tag: 'b', children: ['📝 AI 摘要：'] },
                opts.summary
            ] 
        });
    }

    if (opts.insight) {
        headerNodes.push({ 
            tag: 'p', 
            children: [
                { tag: 'b', children: ['💡 Insight：'] },
                opts.insight
            ] 
        });
    }

    // Divider only if we have summary/insight
    if (headerNodes.length > 0) {
        headerNodes.push({ tag: 'hr' });
    }
    */

    const finalNodes = [...headerNodes, ...contentNodes];

    const page = await ph.createPage(token!, opts.title, finalNodes, {
        author_name: `LinkSaver • ${simpleDate}`, // "LinkSaver • 2026/02/04"
        author_url: opts.url, // Clicking author jumps to original
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
