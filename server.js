const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'; // Default fallback

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Multer Config for Media Library
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/media');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'));
  }
});
const upload = multer({ storage: storage });

// Media API Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  res.json({ success: true, file: req.file, url: `/media/${req.file.filename}` });
});

app.get('/api/media', (req, res) => {
  const dir = path.join(__dirname, 'public/media');
  if (!fs.existsSync(dir)) return res.json({ success: true, files: [] });

  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ success: false, error: 'Failed to list media' });
    const mediaFiles = files.map(file => ({
      name: file,
      url: `/media/${file}`,
      type: file.match(/\.(jpg|jpeg|png|gif)$/i) ? 'image' : 'video'
    }));
    res.json({ success: true, files: mediaFiles });
  });
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Public Routes (Login)
app.use(express.static('public', { index: false })); // Disable auto index serving
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie('auth_token', 'valid_token', { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1 day
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Auth Middleware
const checkAuth = (req, res, next) => {
  // Skip auth for stream page (so compositor works locally) and assets
  if (req.path === '/stream.html' || req.path.startsWith('/assets/') || req.path.startsWith('/media/')) {
    return next();
  }

  // Check cookie
  if (req.cookies.auth_token === 'valid_token') {
    return next();
  }

  // If API, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Otherwise redirect to login
  res.redirect('/login');
};

app.use(checkAuth);

// Serve Index manually after auth check
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static('public')); // Serve other statics that passed checkAuth

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

let activeStreams = new Map();
const DATA_FILE = path.join(__dirname, 'data', 'overlays.json');
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
}
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, '{}');
}

function getConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (e) { return {}; }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getOverlays() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveOverlays(overlays) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(overlays, null, 2));
}

// Puppeteer Stream implementation (Supports Audio + Video)
const { launch, getStream } = require('puppeteer-stream');
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');

class StreamSession {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.browser = null;
    this.ffmpegProcess = null;
    this.status = 'idle';
    this.startTime = null;
    this.stats = { fps: 0, bitrate: 0 };
    this.stream = null;
    this.page = null; // Store page reference
    this.previewInterval = null;
  }

  log(message, type = 'info') {
    console.log(`[${this.id}] ${message}`);
    io.emit('server-log', { message: `[Server] ${message}`, type });
  }

  async start() {
    if (this.status === 'streaming') throw new Error('Stream already running');

    try {
      this.status = 'starting';
      this.log('Launching Browser (Linux/Xvfb Config)...');

      this.browser = await launch({
        executablePath: puppeteer.executablePath(),
        headless: false, // Required for extension (works with Xvfb)
        ignoreDefaultArgs: ['--mute-audio'],
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--autoplay-policy=no-user-gesture-required',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });

      this.log('Navigating to compositor...');
      await this.page.goto(`http://localhost:${PORT}/stream.html`, { waitUntil: 'load', timeout: 60000 });

      // Bring to front and click to ensure audio context is active
      await this.page.bringToFront();
      console.log('Waiting for extension to initialize (5s)...');
      await new Promise(r => setTimeout(r, 5000));

      try {
        await this.page.evaluate(() => document.body.click());
      } catch (e) { }

      // Get Stream from Puppeteer (Audio + Video)
      this.log('Capturing stream with Audio...');
      this.stream = await getStream(this.page, {
        audio: true,
        video: true,
        frameSize: 1000,
        mimeType: 'video/webm'
      });

      // Start FFmpeg
      const args = this.buildFFmpegArgs();
      this.log(`Spawning FFmpeg from: ${ffmpegPath}`);
      this.ffmpegProcess = spawn(ffmpegPath, args);

      // Pipe Puppeteer stream to FFmpeg
      this.stream.pipe(this.ffmpegProcess.stdin);

      this.status = 'streaming';
      this.startTime = Date.now();
      this.setupFFmpegHandlers();
      this.startPreview(); // Start generating preview frames

      // Clean up browser on ffmpeg exit
      this.ffmpegProcess.on('exit', (code) => {
        if (code !== 0) {
          this.log(`FFmpeg exited with code ${code}`, 'error');
        }
        this.stop();
      });

    } catch (error) {
      const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      this.log(`Start error: ${errorMsg}`, 'error');
      console.error(error); // Print full stack to server console logs
      this.stop();
      throw error;
    }

    return this;
  }

  buildFFmpegArgs() {
    const {
      streamKey,
      resolution = '1920x1080',
      framerate = 30,
      bitrate = '4500k',
      preset = 'veryfast'
    } = this.config;

    // Puppeteer stream output (webm) -> FFmpeg Input
    return [
      '-re',
      '-i', '-', // Input from stdin (pipe)

      // Input decoding (WebM/VP8/VP9 from puppeteer-stream)
      '-f', 'webm',
      '-vcodec', 'libvpx', // Ensure decoder matches

      // Transcode to YouTube settings
      '-c:v', 'libx264',
      '-preset', preset,
      '-tune', 'zerolatency',
      '-profile:v', 'high',
      '-b:v', bitrate,
      '-maxrate', bitrate,
      '-bufsize', String(parseInt(bitrate) * 2),
      '-pix_fmt', 'yuv420p',
      '-g', String(framerate * 2),
      '-r', String(framerate),

      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',

      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
    ];
  }

  setupFFmpegHandlers() {
    if (!this.ffmpegProcess) return;

    this.ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const fpsMatch = output.match(/fps=\s*(\d+)/);
      const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits\/s/);
      if (fpsMatch) this.stats.fps = parseInt(fpsMatch[1]);
      if (bitrateMatch) this.stats.bitrate = parseFloat(bitrateMatch[1]);
      io.to(this.id).emit('stream-stats', this.stats);
    });
  }

  async stop() {
    this.status = 'stopped';
    this.stopPreview();

    if (this.stream) {
      this.stream.destroy();
      this.stream = null;
    }

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
      this.ffmpegProcess = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    io.to(this.id).emit('stream-ended', { status: 'stopped' });
  }

  startPreview() {
    if (this.previewInterval) clearInterval(this.previewInterval);
    // Take a screenshot every 2 seconds for preview
    this.previewInterval = setInterval(async () => {
      if (this.page && this.status === 'streaming') {
        try {
          const screenshot = await this.page.screenshot({
            type: 'jpeg',
            quality: 50,
            encoding: 'base64',
            clip: { x: 0, y: 0, width: 1920, height: 1080 } // Ensure full frame
          });
          io.emit('preview-frame', screenshot);
        } catch (e) {
          // Ignore errors (page might be closing)
        }
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
      id: this.id,
      status: this.status,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      stats: this.stats,
      config: this.config
    };
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/stream/start', (req, res) => {
  try {
    const { streamKey, resolution, framerate, bitrate, preset } = req.body;
    if (!streamKey) {
      return res.status(400).json({ error: 'Stream key is required' });
    }
    const sessionId = `stream_${Date.now()}`;
    const session = new StreamSession(sessionId, {
      streamKey,
      resolution: resolution || '1920x1080',
      framerate: framerate || 30,
      bitrate: bitrate || '4500k',
      preset: preset || 'veryfast'
    });
    session.start();
    activeStreams.set(sessionId, session);
    res.json({ success: true, sessionId, status: session.getStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stream/stop/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeStreams.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  session.stop();
  activeStreams.delete(sessionId);
  res.json({ success: true, message: 'Stream stopped' });
});

app.get('/api/stream/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeStreams.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  res.json(session.getStatus());
});

app.get('/api/streams', (req, res) => {
  const streams = Array.from(activeStreams.values()).map(s => s.getStatus());
  res.json({ streams });
});

app.post('/api/overlay/save', (req, res) => {
  try {
    const { id, html, css, js } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Overlay ID is required' });
    }

    const overlays = getOverlays();
    const existingIndex = overlays.findIndex(o => o.id === id);
    const newOverlay = { id, html, css, js, updatedAt: Date.now() };

    if (existingIndex >= 0) {
      overlays[existingIndex] = newOverlay;
    } else {
      overlays.push(newOverlay);
    }

    saveOverlays(overlays);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/overlay/:id', (req, res) => {
  const { id } = req.params;
  const overlays = getOverlays();
  const overlay = overlays.find(o => o.id === id);
  if (!overlay) {
    return res.status(404).json({ error: 'Overlay not found' });
  }
  res.json(overlay);
});

app.get('/api/config', (req, res) => {
  res.json(getConfig());
});

app.post('/api/config', (req, res) => {
  try {
    saveConfig(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/overlays', (req, res) => {
  const data = getOverlays();
  res.json({ overlays: data });
});

app.delete('/api/overlays/:id', (req, res) => {
  try {
    const { id } = req.params;
    let data = getOverlays();
    const initialLength = data.length;
    data = data.filter(o => o.id !== id);

    if (data.length === initialLength) {
      return res.status(404).json({ error: 'Overlay not found' });
    }

    saveOverlays(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-stream', (sessionId) => {
    socket.join(sessionId);
    console.log(`Client ${socket.id} joined stream ${sessionId}`);
  });
  socket.on('leave-stream', (sessionId) => {
    socket.leave(sessionId);
    console.log(`Client ${socket.id} left stream ${sessionId}`);
  });
  socket.on('update-overlay', (data) => {
    const { sessionId, overlay } = data;
    io.to(sessionId).emit('overlay-updated', overlay);
  });

  socket.on('stream-video', (data) => {
    // Broadcast to all clients (including the puppeteer page)
    io.emit('video-change', data);
    console.log('Switching video to:', data.url);
    io.emit('server-log', { message: `Switching video: ${data.name || 'External'}`, type: 'info' });
  });

  socket.on('stream-data', ({ sessionId, chunk }) => {
    const session = activeStreams.get(sessionId);
    if (session) {
      session.write(chunk);
    }
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  activeStreams.forEach(stream => stream.stop());
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Livestream Studio running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for real-time updates`);
});

module.exports = { app, server };