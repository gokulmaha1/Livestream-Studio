/**
 * broadcaster.js
 * The "Brain" - manages the entire streaming lifecycle.
 * Corresponds to broadcaster.py in the original architecture.
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

class Broadcaster extends EventEmitter {
    constructor(pipeline, overlayManager) {
        super();
        this.pipeline = pipeline; // Instance of Pipeline
        this.overlayManager = overlayManager; // Instance of OverlayManager
        this.ffmpegProcess = null;
        this.status = 'idle';
        this.startTime = null;
        this.stats = { fps: 0, bitrate: 0 };
        this.previewInterval = null;
    }

    async start() {
        if (this.status === 'streaming') throw new Error('Stream already running');

        this.status = 'starting';
        this.emit('status-change', this.status);

        try {
            // 1. Ensure Overlay is ready
            if (!this.overlayManager.browser) {
                await this.overlayManager.launch();
            }

            // 2. Start FFmpeg
            console.log('[Broadcaster] Starting FFmpeg process...');
            const args = this.pipeline.buildFFmpegArgs();

            // Assume 'ffmpeg' is in PATH. On native Windows this might fail if not set.
            this.ffmpegProcess = spawn('ffmpeg', args);

            this.ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString();
                // Parse stats
                const fpsMatch = output.match(/fps=\s*(\d+)/);
                const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits\/s/);

                if (fpsMatch) this.stats.fps = parseInt(fpsMatch[1]);
                if (bitrateMatch) this.stats.bitrate = parseFloat(bitrateMatch[1]);

                this.emit('stats', this.stats);
            });

            this.ffmpegProcess.on('exit', (code) => {
                console.log(`[Broadcaster] FFmpeg exited with code ${code}`);
                this.stop();
            });

            this.status = 'streaming';
            this.startTime = Date.now();
            this.emit('status-change', this.status);

            this.startPreview();

        } catch (error) {
            console.error('[Broadcaster] Start error:', error);
            this.stop();
            throw error;
        }
    }

    async stop() {
        if (this.status === 'stopped') return;

        this.status = 'stopped';
        this.stopPreview();

        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill();
            this.ffmpegProcess = null;
        }

        // We might want to keep overlay open or close it. 
        // In this architecture, let's close it to be clean.
        await this.overlayManager.close();

        this.emit('status-change', this.status);
    }

    startPreview() {
        if (this.previewInterval) clearInterval(this.previewInterval);
        this.previewInterval = setInterval(async () => {
            if (this.status === 'streaming') {
                const frame = await this.overlayManager.getScreenshot();
                if (frame) this.emit('preview-frame', frame);
            }
        }, 2000);
    }

    stopPreview() {
        if (this.previewInterval) {
            clearInterval(this.previewInterval);
            this.previewInterval = null;
        }
    }

    getStatus() {
        return {
            status: this.status,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            stats: this.stats,
            config: this.pipeline.config
        };
    }
}

module.exports = Broadcaster;
