#!/bin/bash

echo "======================================"
echo "Livestream Studio Setup"
echo "======================================"
echo ""

# Check Node.js
echo "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js $NODE_VERSION found"
else
    echo "✗ Node.js not found"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check npm
echo "Checking npm installation..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✓ npm $NPM_VERSION found"
else
    echo "✗ npm not found"
    exit 1
fi

# Check FFmpeg
echo "Checking FFmpeg installation..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo "✓ FFmpeg found: $FFMPEG_VERSION"
else
    echo "✗ FFmpeg not found"
    echo ""
    echo "Please install FFmpeg:"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    echo "  macOS: brew install ffmpeg"
    echo "  Linux: sudo apt-get install ffmpeg"
    echo ""
    read -p "Continue without FFmpeg? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed successfully"
else
    echo "✗ Failed to install dependencies"
    exit 1
fi

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "To build executables:"
echo "  npm run build:mac    # macOS"
echo "  npm run build:win    # Windows"
echo "  npm run build:linux  # Linux"
echo ""
echo "For more information, see README.md"
echo ""
