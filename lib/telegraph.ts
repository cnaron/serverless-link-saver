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
function markdownToNodes(markdown: string): any[] {
    const tokens = marked.lexer(markdown);
    const nodes: any[] = [];

    tokens.forEach((token: any) => {
        if (token.type === 'heading') {
            const tag = token.depth <= 2 ? 'h3' : 'h4'; // Telegraph only supports h3, h4
            nodes.push({ tag, children: [token.text] });
        } else if (token.type === 'paragraph') {
            nodes.push({ tag: 'p', children: [token.text] });
        } else if (token.type === 'list') {
            const tag = token.ordered ? 'ol' : 'ul';
            const children = token.items.map((item: any) => ({
                tag: 'li',
                children: [item.text]
            }));
            nodes.push({ tag, children });
        } else if (token.type === 'blockquote') {
            nodes.push({ tag: 'blockquote', children: [token.text] });
        } else if (token.type === 'code') {
            nodes.push({ tag: 'pre', children: [token.text] });
        } else if (token.type === 'image') {
            nodes.push({
                tag: 'img',
                attrs: { src: token.href },
                children: [token.title || token.text || 'Image']
            });
        }
        // Simplified: skipping links formatting within text for now, 
        // as parsing nested markdown to DOM nodes is complex without a DOM parser.
        // Ideally we'd use a parser like `dom-serializer` or similar if we want rich text.
        // For now, plain text block structure is better than nothing.
    });

    return nodes;
}

/**
 * Uploads content to Telegra.ph
 */
export async function createTelegraphPage(title: string, markdown: string) {
    let token = ACCESS_TOKEN;

    if (!token) {
        // Fallback: Create a temporary account (Token will be lost on restart!)
        // In production, user should set TELEGRAPH_ACCESS_TOKEN env var.
        console.warn("TELEGRAPH_ACCESS_TOKEN not found. Creating temporary account.");
        token = await createAccount("LinkSaver", "AI Link Saver");
    }

    const content = markdownToNodes(markdown);

    const page = await ph.createPage(token!, title, content, {
        author_name: "LinkSaver AI",
        return_content: true
    });

    return page.url;
}
