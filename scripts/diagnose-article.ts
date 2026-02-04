import { marked } from "marked";

// Mocking Jina fetch (since I can't import the lib easily without full env context sometimes, but let's try direct fetch)
// Actually I'll just use a fetch here.
const JINA_API_KEY = process.env.JINA_API_KEY;

async function fetchJina(url: string) {
    if (!JINA_API_KEY) {
        console.warn("No JINA_API_KEY, cannot fetch real content.");
        return "";
    }
    const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
            'Authorization': `Bearer ${JINA_API_KEY}`,
            'X-Return-Format': 'markdown'
        }
    });
    return await response.text();
}

// COPIED logic from lib/telegraph.ts to ensure exact reproduction
const BLOCK_TAGS = ['p', 'h3', 'h4', 'blockquote', 'aside', 'figure', 'ul', 'ol', 'hr', 'pre'];

function stripHtml(html: string) {
    return html.replace(/<[^>]*>?/gm, '');
}

function processTokens(tokens: any[]): any[] {
    if (!tokens) return [];
    return tokens.map(processToken).flat().filter(Boolean);
}

function processToken(token: any): any {
    if (token.type === 'text' || token.type === 'escape') {
        if (token.tokens && token.tokens.length > 0) return processTokens(token.tokens);
        return token.text;
    }
    if (token.type === 'strong') return { tag: 'b', children: processTokens(token.tokens) };
    if (token.type === 'em') return { tag: 'i', children: processTokens(token.tokens) };
    if (token.type === 'del') return { tag: 's', children: processTokens(token.tokens) };
    if (token.type === 'codespan') return { tag: 'code', children: [token.text] };
    if (token.type === 'link') return { tag: 'a', attrs: { href: token.href }, children: processTokens(token.tokens) };
    if (token.type === 'image') {
        const imgNode = { tag: 'img', attrs: { src: token.href } };
        if (token.title || token.text) {
            return { tag: 'figure', children: [imgNode, { tag: 'figcaption', children: [token.title || token.text] }] };
        }
        return imgNode;
    }
    if (token.type === 'br') return { tag: 'br' };
    if (token.type === 'space') return null;
    if (token.type === 'hr') return { tag: 'hr' };
    if (token.type === 'paragraph') return { tag: 'p', children: processTokens(token.tokens) };
    if (token.type === 'heading') {
        const tag = token.depth <= 2 ? 'h3' : 'h4';
        return { tag, children: processTokens(token.tokens) };
    }
    if (token.type === 'list') {
        const tag = token.ordered ? 'ol' : 'ul';
        return { tag, children: token.items.map(processToken) };
    }
    if (token.type === 'list_item') {
        let children = processTokens(token.tokens);
        if (token.task) {
            const checkbox = token.checked ? '[x] ' : '[ ] ';
            children = [checkbox, ...children];
        }
        children = children.flatMap(child => {
            if (child && typeof child === 'object' && child.tag === 'p') return child.children || [];
            return child;
        });
        return { tag: 'li', children: children };
    }
    if (token.type === 'blockquote') {
        let children = processTokens(token.tokens);
        children = children.flatMap(child => {
            if (child && typeof child === 'object' && child.tag === 'p') return [...(child.children || []), { tag: 'br' }];
            return child;
        });
        if (children.length > 0 && children[children.length - 1].tag === 'br') children.pop();
        return { tag: 'blockquote', children: children };
    }
    if (token.type === 'code') return { tag: 'pre', children: [{ tag: 'code', children: [token.text] }] };

    // HTML Handling
    if (token.type === 'html') {
        const html = token.text.trim();
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
            if (srcMatch) return { tag: 'iframe', attrs: { src: srcMatch[1] } };
        }
        if (html.includes('<b>') || html.includes('<strong>')) return { tag: 'b', children: [stripHtml(html)] };
        if (html.includes('<i>') || html.includes('<em>')) return { tag: 'i', children: [stripHtml(html)] };
        return stripHtml(html);
    }

    if (token.text) return token.text;
    return "";
}

function markdownToNodes(markdown: string): any[] {
    const tokens = marked.lexer(markdown);
    const rawNodes: any[] = [];
    const addNode = (n: any) => {
        if (!n) return;
        if (Array.isArray(n)) n.forEach(addNode);
        else rawNodes.push(n);
    };
    tokens.forEach(token => addNode(processToken(token)));

    const finalNodes: any[] = [];
    let inlineBuffer: any[] = [];

    const flushBuffer = () => {
        if (inlineBuffer.length > 0) {
            finalNodes.push({ tag: 'p', children: [...inlineBuffer] });
            inlineBuffer = [];
        }
    };

    for (const node of rawNodes) {
        const isBlock = typeof node === 'object' && node.tag && BLOCK_TAGS.includes(node.tag);
        if (isBlock) {
            flushBuffer();
            finalNodes.push(node);
        } else {
            inlineBuffer.push(node);
        }
    }
    flushBuffer();
    return finalNodes;
}

(async () => {
    console.log("Fetching content...");
    const url = "https://www.bicameral-ai.com/blog/introducing-bicameral";
    const markdown = await fetchJina(url);
    if (!markdown) {
        console.error("Failed to fetch markdown (check JINA_API_KEY environment variable?). Using mock.");
        return;
    }
    console.log("Markdown fetched. Length:", markdown.length);
    console.log("Preview:", markdown.slice(0, 500));

    const nodes = markdownToNodes(markdown);
    console.log("Nodes structure generated.");

    // Scan for potential issues
    function scanNodes(nodes: any[], depth = 0) {
        nodes.forEach(node => {
            if (typeof node === 'object') {
                // Check 1: iframe/video inside p
                if (node.tag === 'p' && node.children) {
                    node.children.forEach((child: any) => {
                        if (child.tag === 'iframe' || child.tag === 'video' || child.tag === 'figure') {
                            console.warn(`WARN: Found ${child.tag} inside <p>! This might break IV.`);
                        }
                    });
                }
                if (node.children) scanNodes(node.children, depth + 1);
            }
        });
    }
    scanNodes(nodes);
})();
