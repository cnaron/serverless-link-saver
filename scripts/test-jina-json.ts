const JINA_API_URL = "https://r.jina.ai/";

async function testJina(url: string) {
    console.log(`Fetching ${url}...`);

    // Test 1: Markdown (Current)
    const resMd = await fetch(`${JINA_API_URL}${url}`);
    const md = await resMd.text();
    const firstLine = md.match(/^#?\s*(.+)/)?.[1];
    console.log(`\n[Markdown Mode] First Line:\n${firstLine?.slice(0, 100)}...`);

    // Test 2: JSON
    const resJson = await fetch(`${JINA_API_URL}${url}`, {
        headers: {
            "Accept": "application/json",
            "X-Target-Selector": "body" // Optional, but good practice
        }
    });

    if (resJson.ok) {
        const data = await resJson.json();
        console.log("Full JSON:", JSON.stringify(data, null, 2));
    } else {
        console.error("JSON fetch failed:", resJson.status);
    }
}

testJina("https://www.jernesto.com/articles/thinking_hard");
