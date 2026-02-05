
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        console.log("Launching browser...");
        // Locate Chrome executable - adjust pattern if needed or rely on puppeteer detection
        // For now, let's try rely on standard launch but catch errors
        const browser = await puppeteer.launch({
            // executablePath: '/Users/naron/.cache/puppeteer/chrome/mac_arm-144.0.7559.96/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors']
        });

        const page = await browser.newPage();
        const url = "https://gemini.google.com/share/201444bc1cb4";

        console.log("Navigating to:", url);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log("Waiting for body...");
        await page.waitForSelector('body');

        // Allow some time for hydration
        await new Promise(r => setTimeout(r, 5000));

        // Get full HTML
        const content = await page.content();
        console.log("--- HTML START ---");
        console.log(content.slice(0, 1000)); // Log first 1000 chars to verify
        // Check for specific keywords
        const hasReference = content.includes("引用") || content.includes("Sources") || content.includes("http");
        console.log("Contains '引用' or 'Sources'?", hasReference);

        console.log("--- HTML END ---");

        await browser.close();
    } catch (e) {
        console.error("Puppeteer Error:", e);
    }
})();
