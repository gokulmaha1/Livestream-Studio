/**
 * main.js
 * The "Entry Point" - where everything starts.
 * Corresponds to main.py in the original architecture.
 */

const Pipeline = require('./pipeline');
const OverlayManager = require('./overlay');
const Broadcaster = require('./broadcaster');
const Server = require('./server');

async function main() {
    console.log('[Main] Initializing services...');

    // 1. Initialize Components
    const pipeline = new Pipeline();
    const overlayManager = new OverlayManager();
    const broadcaster = new Broadcaster(pipeline, overlayManager);

    // 2. Initialize Server (UI/Controller)
    const PORT = process.env.PORT || 3000;
    const server = new Server(PORT, broadcaster);

    // 3. Start Server
    server.start();

    console.log('[Main] System Ready.');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('[Main] Shutting down...');
        await broadcaster.stop(); // Stops ffmpeg and closes browser
        process.exit(0);
    });
}

main().catch(err => {
    console.error('[Main] Fatal Error:', err);
    process.exit(1);
});
