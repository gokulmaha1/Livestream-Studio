# Deploying to Linux (Audio Enabled)

To stream with **Audio** from a Linux server (VPS), we use `Xvfb` (Virtual Framebuffer) to trick Chrome into thinking it has a screen. This allows the audio/video capture extension to work perfectly.

## 1. Install System Dependencies

Run these commands on your Ubuntu/Debian server:

```bash
# Update system
sudo apt update

# Install Chrome Dependencies & Xvfb
sudo apt install -y xvfb chromium-browser ffmpeg libgbm-dev
```

## 2. Install Node.js Dependencies

In your project folder:

```bash
npm install
```

## 3. Run with Virtual Display

Instead of just `npm start`, you must wrap it with `xvfb-run`:

```bash
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" npm start
```

### Explanation of Flags:
*   `xvfb-run`: Creates a virtual screen.
*   `-screen 0 1920x1080x24`: Sets the screen resolution to 1080p (matches our code).
*   `npm start`: Runs your app inside this virtual screen.

## 4. Verify

1.  Your app will start on port 3000.
2.  Open the dashboard in your browser.
3.  Click **Start Stream**.
4.  The server should launch Chrome (internally in Xvfb) and start streaming with audio to RTMP.

## Troubleshooting

If you see errors about "Missing X libraries", you might need to install Puppeteer deps:

```bash
sudo apt install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt update
sudo apt install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1
```
