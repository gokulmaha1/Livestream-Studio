# Deploying Livestream Studio with Docker

Docker is the recommended way to deploy Livestream Studio because it packages all the complex dependencies (Chrome, FFmpeg, Xvfb) into a single, isolated container.

## Prerequisites

1.  **VPS (Hostinger/Ubuntu)**: A fresh VPS.
2.  **Docker Installed**: If not, follow step 1.

---

## Step 1: Install Docker on VPS

SSH into your VPS and run these commands to install Docker and Docker Compose:

```bash
# Update and install basic tools
sudo apt update
sudo apt install -y curl git

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify
docker --version
docker compose version
```

---

## Step 2: Deploy the App

### Option A: Clone from Git (Recommended)

1.  Clone your repo:
    ```bash
    git clone https://github.com/yourusername/Livestream-Studio.git
    cd Livestream-Studio
    ```

2.  Build and Start:
    ```bash
    docker compose up -d --build
    ```

### Option B: Upload Files

Upload your project folder (excluding `node_modules`) to the VPS, navigate to it, and run the same command.

---

## Step 3: Verify Deployment

1.  Check if container is running:
    ```bash
    docker compose ps
    ```
    docker compose ps
    ```
2.  Your app should be live at:
    `http://your_vps_ip:3000`

---

## Step 4: Configure Authentication (Secure your Dashboard)

Since your dashboard is public, you **must** set a password.

1.  Edit your `.env` file on the VPS:
    ```bash
    nano .env
    ```
2.  Add this line:
    ```env
    ADMIN_PASSWORD=your_secure_password
    ```
3.  Restart to apply:
    ```bash
    docker compose down
    docker compose up -d
    ```

---

## Step 5: Important Notes

### 1. Persistent Data
The `docker-compose.yml` file is configured to save your data (overlays and uploaded media) to the host machine.
- Overlays: `./data`
- Media: `./public/media`

This means even if you delete the container and rebuild it, your saved scenes and uploads will NOT be lost.

### 2. Updating the App
When you push new code to Git:
```bash
git pull
docker compose up -d --build
```
This rebuilds the container with the new code using the cached layers (very fast).

### 3. Logs
To see the application logs (and streaming output):
```bash
docker compose logs -f
```

### 4. Memory Config
We set `shm_size: '2gb'` in the compose file. This is crucial for Chrome to run reliably without crashing on complex pages.
