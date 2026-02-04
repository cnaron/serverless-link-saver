import { marked } from "marked";

// Mocking the structure from lib/telegraph.ts

function processToken(token: any): any {
    if (token.type === 'text') return token.text;
    if (token.type === 'space') return null; // This is what lib/telegraph.ts does
    if (token.type === 'strong') {
        return { tag: 'b', children: processTokens(token.tokens) };
    }
    return token.text;
}

function processTokens(tokens: any[]): any[] {
    if (!tokens) return [];
    // The current implementation in lib/telegraph.ts:
    return tokens.map(processToken).flat();
}

const markdown = "**Bold Text**\n**More Bold**";
// marked lexer might produce space tokens between blocks, but usually inside inline tokens (like strong) it's text.
// Let's try a list item which might have space tokens?
const listMarkdown = "- Item 1\n\n  Item 2";

// Let's simulate a token structure that definitely yields space
const mockTokens = [
    { type: 'text', text: 'Hello' },
    { type: 'space', raw: '\n' },
    { type: 'text', text: 'World' }
];

console.log("Processing mock tokens with space...");
const result = processTokens(mockTokens);
console.log("Result:", JSON.stringify(result));

if (result.includes(null)) {
    console.error("FAIL: Result contains null!");
} else {
    console.log("PASS: Result is clean.");
}
