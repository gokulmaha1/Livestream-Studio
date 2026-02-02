const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');

class StreamController {
    constructor() {
        this.isStreaming = false;
        this.sources = [];
        this.selectedSource = null;
        this.overlays = [];
    }

    async getAvailableSources() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
                thumbnailSize: { width: 150, height: 150 }
            });
            this.sources = sources;
            return sources;
        } catch (error) {
            console.error('Error getting sources:', error);
            return [];
        }
    }

    selectSource(sourceId) {
        this.selectedSource = this.sources.find(s => s.id === sourceId);
        return this.selectedSource;
    }

    addOverlay(overlay) {
        this.overlays.push({
            id: Date.now(),
            ...overlay
        });
    }

    removeOverlay(overlayId) {
        this.overlays = this.overlays.filter(o => o.id !== overlayId);
    }

    updateOverlay(overlayId, updates) {
        const overlay = this.overlays.find(o => o.id === overlayId);
        if (overlay) {
            Object.assign(overlay, updates);
        }
    }

    getOverlays() {
        return this.overlays;
    }

    clearOverlays() {
        this.overlays = [];
    }

    generateFFmpegCommand(config) {
        const {
            streamKey,
            resolution,
            framerate,
            bitrate,
            audioCodec = 'aac',
            audioBitrate = '128k',
            preset = 'veryfast',
            useHardwareAcceleration = false
        } = config;

        const [width, height] = resolution.split('x').map(Number);

        let command = [];

        // Input source
        if (this.selectedSource) {
            // Screen capture
            command.push('-f', 'gdigrab'); // Windows
            // For Linux: '-f', 'x11grab'
            // For Mac: '-f', 'avfoundation'
            command.push('-framerate', framerate.toString());
            command.push('-i', 'desktop');
        } else {
            // Color bars test pattern
            command.push('-f', 'lavfi');
            command.push('-i', `testsrc=size=${resolution}:rate=${framerate}`);
        }

        // Video encoding
        if (useHardwareAcceleration) {
            // NVIDIA GPU acceleration
            command.push('-c:v', 'h264_nvenc');
            command.push('-preset', 'p4'); // Fast preset for NVENC
        } else {
            command.push('-c:v', 'libx264');
            command.push('-preset', preset);
        }

        command.push(
            '-tune', 'zerolatency',
            '-b:v', bitrate,
            '-maxrate', bitrate,
            '-bufsize', (parseInt(bitrate) * 2) + 'k',
            '-pix_fmt', 'yuv420p',
            '-g', (framerate * 2).toString(),
            '-keyint_min', framerate.toString(),
            '-sc_threshold', '0'
        );

        // Scaling if needed
        command.push('-vf', `scale=${width}:${height}`);

        // Audio
        command.push(
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-c:a', audioCodec,
            '-b:a', audioBitrate,
            '-ar', '44100'
        );

        // Output
        command.push(
            '-f', 'flv',
            `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
        );

        return command;
    }

    generateAdvancedFFmpegCommand(config) {
        // Advanced command with multiple inputs and complex filters
        const {
            streamKey,
            resolution,
            framerate,
            bitrate,
            videoSource,
            audioSource,
            overlayPath
        } = config;

        let command = [];

        // Main video input
        command.push('-f', 'lavfi');
        command.push('-i', `color=c=black:s=${resolution}:r=${framerate}`);

        // Overlay input (if any)
        if (overlayPath && fs.existsSync(overlayPath)) {
            command.push('-i', overlayPath);
        }

        // Complex filter for overlays
        let filterComplex = '';
        if (overlayPath) {
            filterComplex = '[0:v][1:v]overlay=10:10[v]';
            command.push('-filter_complex', filterComplex);
            command.push('-map', '[v]');
        }

        // Encoding settings
        command.push(
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-tune', 'zerolatency',
            '-profile:v', 'high',
            '-level', '4.2',
            '-b:v', bitrate,
            '-maxrate', bitrate,
            '-bufsize', (parseInt(bitrate) * 2) + 'k',
            '-pix_fmt', 'yuv420p',
            '-g', (framerate * 2).toString(),
            '-r', framerate.toString()
        );

        // Audio
        command.push(
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
            '-c:a', 'aac',
            '-b:a', '160k',
            '-ar', '48000'
        );

        // Output
        command.push(
            '-f', 'flv',
            `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
        );

        return command;
    }
}

module.exports = StreamController;
