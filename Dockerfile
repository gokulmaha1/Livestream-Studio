# Base image
FROM node:18-slim

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install FFmpeg and Xvfb
RUN apt-get update && apt-get install -y \
    ffmpeg \
    xvfb \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies (including Puppeteer)
# Note: We skip downloading Chromium here because we want to use the installed Google Chrome Stable
# OR we rely on Puppeteer's bundled one if it works. 
# Best practice for production: Use installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm install

# Bundle app source
COPY . .

# Expose port (must match your app's port)
EXPOSE 3000

# Copy start script
COPY start_xvfb.sh ./
RUN chmod +x start_xvfb.sh

# Start the application using the Xvfb wrapper
CMD ["./start_xvfb.sh"]
