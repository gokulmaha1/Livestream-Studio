/**
 * pipeline.js
 * The "Builder" - creates FFmpeg/GStreamer pipeline arguments.
 * Corresponds to pipeline.py in the original architecture.
 */

class Pipeline {
    constructor(config = {}) {
        this.config = config;
        this.defaults = {
            resolution: '1920x1080',
            framerate: 30,
            bitrate: '4500k',
            preset: 'veryfast',
            streamKey: ''
        };
    }

    setConfig(newConfig) {
        this.config = { ...this.defaults, ...this.config, ...newConfig };
    }

    /**
     * Builds the arguments for the FFmpeg command.
     * We use "x11grab" as a stand-in for the "GStreamer pipeline" concept
     * because we are on a system where we might need to capture a display.
     * 
     * @returns {string[]} Array of command line arguments
     */
    buildFFmpegArgs() {
        const { streamKey, resolution, framerate, bitrate, preset } = this.config;

        if (!streamKey) {
            throw new Error('Stream key is required to build pipeline');
        }

        return [
            // 1. VIDEO INPUT: X11Grab (Display :99 -> Xvfb)
            '-f', 'x11grab',
            '-draw_mouse', '0',
            '-s', resolution,
            '-framerate', String(framerate),
            '-i', ':99', // Capture Xvfb display directly

            // 2. AUDIO INPUT: Silent Audio (Placeholder)
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',

            // 3. ENCODING
            '-c:v', 'libx264',
            '-preset', preset,
            '-tune', 'zerolatency',
            '-profile:v', 'high',
            '-b:v', bitrate,
            '-maxrate', bitrate,
            '-bufsize', String(parseInt(bitrate) * 2),
            '-pix_fmt', 'yuv420p',
            '-g', String(framerate * 2),

            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2',

            // 4. OUTPUT: FLV (RTMP)
            '-f', 'flv',
            `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
        ];
    }
}

module.exports = Pipeline;
