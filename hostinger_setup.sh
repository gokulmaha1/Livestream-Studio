#!/bin/bash
# ------------------------------------------------------------------
# Livestream Studio - Hostinger/Ubuntu VSP Setup Script
# ------------------------------------------------------------------

set -e # Exit on error

echo "=================================================="
echo "🎥 Livestream Studio - VPS Setup"
echo "=================================================="
echo ""

# 1. Update System
echo "🔄 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Basic Tools
echo "🛠️ Installing basic tools..."
sudo apt install -y curl wget git unzip gnupg build-essential

# 3. Install Node.js (v18 LTS)
echo "🟢 Installing Node.js v18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✓ Node.js is already installed: $(node -v)"
fi

# 4. Install FFmpeg
echo "📼 Installing FFmpeg..."
sudo apt install -y ffmpeg

# 5. Install Xvfb (Virtual Framebuffer) & Graphics Libs
echo "🖥️ Installing Xvfb and graphics libraries..."
sudo apt install -y xvfb libgbm-dev libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2

# 6. Install Google Chrome Stable (Recommended for Puppeteer)
echo "🌐 Installing Google Chrome Stable..."
if ! command -v google-chrome &> /dev/null; then
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
    sudo apt update
    sudo apt install -y google-chrome-stable
else
    echo "✓ Google Chrome is already installed"
fi

# 7. Install PM2 (Process Manager)
echo "🚀 Installing PM2..."
sudo npm install -g pm2

# 8. Setup Directory
echo "📦 Installing project dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    echo "⚠️ package.json not found in current directory."
    echo "Please upload your project files or git clone your repo, then run 'npm install'"
fi

# 9. Permissions
chmod +x start_xvfb.sh

echo ""
echo "=================================================="
echo "✅ Setup Complete!"
echo "=================================================="
echo "Next Steps:"
echo "1. Configure your .env file"
echo "2. Run 'pm2 start ecosystem.config.js' to start the server"
echo "3. Run 'pm2 save' and 'pm2 startup' to enable auto-start"
echo "=================================================="
