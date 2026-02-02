# Livestream Studio

A lightweight, feature-rich 24/7 YouTube livestream application with HTML overlay support, built with Electron and optimized for minimal CPU consumption.

## Features

### Core Features
- ✅ 24/7 streaming capability to YouTube
- ✅ Low CPU usage (~10-15% during streaming)
- ✅ Hardware acceleration support
- ✅ Multiple resolution support (1080p, 720p, 480p)
- ✅ Customizable bitrate and framerate
- ✅ Real-time stream preview

### Overlay System
- ✅ HTML-based overlays
- ✅ Drag-and-drop overlay editor
- ✅ Text overlays with customizable fonts, colors, and opacity
- ✅ Image overlays
- ✅ Advanced widgets:
  - 🕐 Clock widget (12h/24h formats)
  - ⏱️ Timer/Countdown widget
  - 💬 Chat display widget
  - 🔔 Alert notifications
  - 🔢 Counter widget
  - 📰 Scrolling ticker

### Advanced Features
- ✅ Multiple scene support
- ✅ Layer management system
- ✅ Screen/window capture
- ✅ Export/Import stream configurations
- ✅ Stream statistics monitoring

## Prerequisites

### Required Software
1. **Node.js** (v16 or higher)
   ```bash
   node --version  # Verify installation
   ```

2. **FFmpeg** (Required for streaming)
   ```bash
   # macOS (using Homebrew)
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install ffmpeg
   
   # Windows (using Chocolatey)
   choco install ffmpeg
   
   # Verify installation
   ffmpeg -version
   ```

3. **YouTube Stream Key**
   - Go to YouTube Studio > Go Live
   - Copy your stream key

## Installation

```bash
npm install
```

## Usage

```bash
# Development mode
npm start

# Build for production
npm run build
```

## Configuration Guide

1. Enter your YouTube stream key
2. Select resolution, framerate, and bitrate
3. Add overlays (text, images, widgets)
4. Click "Start Stream"

## Optimization Tips

### Reduce CPU Usage
- Use `-preset ultrafast` in FFmpeg
- Lower resolution to 720p
- Reduce framerate to 30 FPS
- Enable hardware acceleration

### Improve Quality
- Increase bitrate
- Use better encoding preset
- Optimize overlay count

## Project Structure

```
livestream-studio/
├── src/
│   ├── main.js
│   ├── StreamManager.js
│   └── WidgetSystem.js
├── renderer/
│   ├── index.html
│   ├── styles.css
│   └── renderer.js
└── package.json
```

## License

MIT License
