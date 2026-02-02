#!/bin/bash
# ------------------------------------------------------------------
# Start Script for Livestream Studio on Linux (VPS)
# Wraps the Node.js application in xvfb-run to provide a virtual display
# required for Puppeteer to capture audio and video.
# ------------------------------------------------------------------

# Ensure we are in the project directory
cd "$(dirname "$0")"

# Define screen resolution (Must match app settings for best results)
RESOLUTION="1920x1080x24"

# Check if xvfb-run is installed
if ! command -v xvfb-run &> /dev/null; then
    echo "Error: xvfb-run is not installed."
    echo "Please run: sudo apt install xvfb"
    exit 1
fi

echo "Starting Livestream Studio with Xvfb ($RESOLUTION)..."
echo "Log file: output.log"

# Run with auto-servernum to avoid collisions
# -ac disable access control (useful for some vps setups)
xvfb-run --auto-servernum --server-args="-screen 0 $RESOLUTION -ac" npm start
