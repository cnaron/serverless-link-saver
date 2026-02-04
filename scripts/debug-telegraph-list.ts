import { marked } from "marked";

// Configure Marked (copying config from lib/telegraph.ts)
marked.use({
    breaks: true,
    gfm: true
});

function processToken(token: any): any {
    // Simplified version of lib/telegraph.ts extraction logic for debugging
    if (token.type === 'text' || token.type === 'escape') {
        if (token.tokens && token.tokens.length > 0) {
            return token.tokens.map(processToken);
        }
        return token.text;
    }
    if (token.type === 'strong') return { tag: 'b', children: token.tokens.map(processToken) };
    if (token.type === 'list') return { tag: token.ordered ? 'ol' : 'ul', children: token.items.map(processToken) };
    if (token.type === 'list_item') {
        // This is the suspect part
        return { tag: 'li', children: token.tokens.map(processToken) };
    }
    if (token.type === 'paragraph') {
        // List items often contain paragraphs in marked
        return { tag: 'p', children: token.tokens.map(processToken) };
    }
    return token.text || "";
}

const markdown = `
Conclusion

1. **Prompt Processing (Prefill):** The prompt tokens are embedded.
2. **KV Cache Management:** Detailed management.
3. Simple item.
`;

const tokens = marked.lexer(markdown);
console.log("Tokens tree:", JSON.stringify(tokens, null, 2));

const nodes = tokens.map(processToken);
console.log("\nNodes tree:", JSON.stringify(nodes, null, 2));
