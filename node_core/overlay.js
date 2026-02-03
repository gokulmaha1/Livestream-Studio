/**
 * overlay.js
 * The "Artist" - renders HTML overlays using Puppeteer.
 * Corresponds to overlay.py (WebKit2) in the original architecture.
 */

const puppeteer = require('puppeteer');

class OverlayManager {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async launch(port = 3000) {
        console.log('[Overlay] Launching Browser...');

        // Launch standard Puppeteer
        this.browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome', // Adjust if on Windows native without WSL
            headless: false, // Visible on Xvfb
            defaultViewport: null,
            ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--start-fullscreen',
                '--kiosk',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-notifications',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        // Debugging: Log browser console
        this.page.on('console', msg => {
            console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
        });

        console.log('[Overlay] Navigating to compositor...');
        // We assume the server is running on localhost
        await this.page.goto(`http://127.0.0.1:${port}/stream.html`, { waitUntil: 'load', timeout: 60000 });

        // Ensure page is actually loaded
        await this.page.waitForSelector('body');
        await this.page.bringToFront();

        console.log('[Overlay] Ready.');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    async getScreenshot() {
        if (!this.page) return null;
        try {
            return await this.page.screenshot({
                type: 'jpeg',
                quality: 50,
                encoding: 'base64',
                clip: { x: 0, y: 0, width: 1920, height: 1080 }
            });
        } catch (e) {
            return null;
        }
    }
}

module.exports = OverlayManager;
