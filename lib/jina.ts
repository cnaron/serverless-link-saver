export async function fetchPageContent(url: string): Promise<string> {
    try {
        const response = await fetch(`https://r.jina.ai/${url}`, {
            method: "GET",
            headers: {
                // "Authorization": "Bearer <YOUR_JINA_KEY>" // Optional for higher rate limits
                "Accept": "application/json" // request JSON usually returns data object, but Jina r.jina.ai returns text usually? 
                // Docs say: https://r.jina.ai/<url> returns Markdown.
                // Let's verify Jina API behavior. usually it returns raw markdown text. 
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`Jina API error: ${response.statusText}`);
        }

        return await response.text();
    } catch (error) {
        console.error("Error fetching content from Jina:", error);
        return "";
    }
}
