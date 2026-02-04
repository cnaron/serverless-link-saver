export interface PageContent {
    title: string;
    content: string;
    image?: string;
}

export async function fetchPageContent(url: string): Promise<PageContent> {
    try {
        const response = await fetch(`https://r.jina.ai/${url}`, {
            method: "GET",
            headers: {
                // "Authorization": "Bearer <YOUR_JINA_KEY>" // Optional for higher rate limits
                "Accept": "application/json",
                // "X-Target-Selector": "body" // Removed to allow smarter extraction
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`Jina API error: ${response.statusText}`);
        }

        const text = await response.text();

        try {
            const json = JSON.parse(text);
            if (json && json.data && json.data.content) {
                // Extract Open Graph image as fallback/hero
                const metadata = json.data.metadata || {};
                const leadImage = metadata['og:image'] || metadata['twitter:image'];

                return {
                    title: json.data.title || "", // Use authoritative title
                    content: json.data.content,
                    image: leadImage
                };
            }
            // Fallback if structure is different but still valid JSON
            return { title: "", content: text };
        } catch (e) {
            return { title: "", content: text }; // Fallback if not JSON
        }
    } catch (error) {
        console.error("Error fetching content from Jina:", error);
        return { title: "", content: "" };
    }
}
