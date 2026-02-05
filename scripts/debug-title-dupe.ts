
const { fetchPageContent } = require("../lib/jina");
const { marked } = require("marked");

// Mocking the structure from lib/telegraph.ts to reproduce the logic
const BLOCK_TAGS = ['p', 'h3', 'h4', 'blockquote', 'aside', 'figure', 'ul', 'ol', 'hr', 'pre'];

function processToken(token: any): any {
    if (token.type === 'text' || token.type === 'escape') {
        return token.text;
    }
    if (token.type === 'heading') {
        const tag = token.depth <= 2 ? 'h3' : 'h4';
        return { tag, children: [token.text] }; // Simplified for debug
    }
    return { tag: 'p', children: [token.text] }; // Fallback
}

function markdownToNodes(markdown: string): any[] {
    const tokens = marked.lexer(markdown);
    const nodes: any[] = [];
    tokens.forEach((t: any) => {
        if (t.type === 'heading') {
            nodes.push({ tag: t.depth <= 2 ? 'h3' : 'h4', children: [t.text], text: t.text });
        } else if (t.type === 'paragraph') {
            nodes.push({ tag: 'p', children: [t.text], text: t.text });
        }
    });
    return nodes;
}

// Replicating the logic from lib/telegraph.ts
function checkDedupe(title: string, firstNode: any) {
    console.log("\n--- Deduplication Check ---");
    console.log("Page Title:", title);

    if (!firstNode) {
        console.log("No first node.");
        return;
    }

    console.log("First Node Tag:", firstNode.tag);
    // In the real code it recursively extracts text, here we just use the text property we added for debug
    const nodeText = firstNode.text || "";
    console.log("First Node Text:", nodeText);

    if (firstNode.tag === 'h3' || firstNode.tag === 'h4') {
        // Loose comparison
        const match = nodeText && (title.includes(nodeText) || nodeText.includes(title));
        console.log("Match Found (includes):", match);

        // Let's also test normalized comparison
        const normTitle = title.toLowerCase().replace(/\s+/g, '');
        const normNode = nodeText.toLowerCase().replace(/\s+/g, '');
        console.log("Normalized Title:", normTitle);
        console.log("Normalized Node:", normNode);
        console.log("Match Found (normalized):", normTitle.includes(normNode) || normNode.includes(normTitle));
    } else {
        console.log("First node is not H3/H4, it is:", firstNode.tag);
    }
}

(async () => {
    const url = "https://www.jakequist.com/thoughts/openclaw-is-what-apple-intelligence-should-have-been";
    console.log("Fetching:", url);
    const data = await fetchPageContent(url);

    if (typeof data !== 'object') {
        console.log("Failed to fetch object data");
        return;
    }

    const content = data.content;
    const title = data.title;

    console.log("Fetched Title:", title);
    console.log("Content Start (first 200 chars):", content.slice(0, 200));

    const nodes = markdownToNodes(content);
    if (nodes.length > 0) {
        checkDedupe(title, nodes[0]);
    } else {
        console.log("No nodes parsed.");
    }

})();
