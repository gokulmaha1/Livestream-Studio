/**
 * server.js
 * The "Controller" - API and Web UI (GTK replacement).
 * Corresponds to ui.py in the original architecture.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

class Server {
    constructor(port, broadcaster) {
        this.port = port;
        this.broadcaster = broadcaster;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        // Serve the public directory (where index.html, stream.html live)
        // Adjust path relative to node_core
        const publicPath = path.join(__dirname, '../public');
        this.app.use(express.static(publicPath));
    }

    setupRoutes() {
        this.app.post('/api/stream/start', async (req, res) => {
            try {
                const { streamKey, resolution, bitrate } = req.body;
                // Update Pipeline Config
                this.broadcaster.pipeline.setConfig({ streamKey, resolution, bitrate });

                await this.broadcaster.start();
                res.json({ success: true, status: this.broadcaster.getStatus() });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/stream/stop', async (req, res) => {
            await this.broadcaster.stop();
            res.json({ success: true, message: 'Stream stopped' });
        });

        this.app.get('/api/stream/status', (req, res) => {
            res.json(this.broadcaster.getStatus());
        });
    }

    setupSocket() {
        // Listen to Broadcaster events and emit to clients
        this.broadcaster.on('stats', (stats) => this.io.emit('stream-stats', stats));
        this.broadcaster.on('preview-frame', (frame) => this.io.emit('preview-frame', frame));
        this.broadcaster.on('status-change', (status) => this.io.emit('stream-ended', { status }));

        this.io.on('connection', (socket) => {
            console.log('[Server] Client connected');
            // Existing Socket Logic for overlays (simplified for prototype)
            socket.on('apply-overlay', (overlay) => this.io.emit('overlay-updated', overlay));
            socket.on('video-change', (data) => this.io.emit('video-change', data));
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`[Server] Listening on http://localhost:${this.port}`);
        });
    }
}

module.exports = Server;
