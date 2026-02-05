
const JINA_API_KEY = process.env.JINA_API_KEY;

async function fetchJina(url: string) {
    const headers: any = {
        "Accept": "application/json",
        // "X-Target-Selector": "body"
    };
    if (JINA_API_KEY) {
        headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }

    console.log("Fetching with headers:", headers);
    const response = await fetch(`https://r.jina.ai/${url}`, { headers });
    const text = await response.text();

    try {
        const json = JSON.parse(text);
        if (json.data && json.data.content) {
            console.log("--- START CONTENT START ---");
            console.log(json.data.content);
            console.log("--- END CONTENT END ---");
        }
        return text;
    } catch {
        return text;
    }
}

(async () => {
    const url = "https://gemini.google.com/share/531c63b0f081";
    await fetchJina(url);
})();
