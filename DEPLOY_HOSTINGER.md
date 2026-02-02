# Deploying Livestream Studio to Hostinger VPS (Ubuntu)

This guide helps you deploy the Livestream Studio application to a Hostinger Virtual Private Server (VPS) running Ubuntu.

## Prerequisites

1.  **Hostinger VPS**: Clean install of Ubuntu 20.04 or 22.04.
2.  **SSH Access**: You should be able to terminal into your server.
3.  **Domain (Optional)**: If you want to use a domain name (like `studio.yourdomain.com`).

---

## Step 1: Connect to VPS

Open your terminal (PowerShell, Command Prompt, or Terminal) and SSH into your server:

```bash
ssh root@your_vps_ip_address
```

*(Enter your password when prompted)*

---

## Step 2: Upload Files

You can upload your project files using **SFTP** (FileZilla) or **Git**.

### Option A: Using Git (Recommended)

1.  Push your local code to GitHub.
2.  On the VPS, clone the repository:

```bash
git clone https://github.com/yourusername/Livestream-Studio.git
cd Livestream-Studio
```

### Option B: SFTP

Upload the entire project folder to `/root/Livestream-Studio` (exclude `node_modules`).

---

## Step 3: Run the Setup Script

We have prepared a script to install all dependencies (Node.js, Chrome, FFmpeg, Xvfb).

1.  Make the script executable:
    ```bash
    chmod +x hostinger_setup.sh
    ```
2.  Run it:
    ```bash
    ./hostinger_setup.sh
    ```

*This process may take 5-10 minutes.*

---

## Step 4: Configure Application

1.  Create your `.env` file (if you have environment variables):
    ```bash
    nano .env
    ```
    *(Paste your variables, then Ctrl+X, Y, Enter to save)*

2.  Ensure `start_xvfb.sh` is executable:
    ```bash
    chmod +x start_xvfb.sh
    ```

---

## Step 5: Start with PM2

We use PM2 to keep the application running 24/7.

1.  Start the app:
    ```bash
    pm2 start ecosystem.config.js
    ```

2.  Check status:
    ```bash
    pm2 status
    pm2 logs
    ```

3.  **Enable Auto-Start on Reboot**:
    ```bash
    pm2 save
    pm2 startup
    ```
    *(Run the command displayed by `pm2 startup` if prompted)*

---

## Step 6: Accessing the App

Your application should now be running!

open `http://your_vps_ip_address:3000` in your browser.

---

## Step 7: Setup Nginx Reverse Proxy (Optional - for Domain/HTTPS)

To use port 80/443 (standard web ports) instead of 3000.

1.  Install Nginx:
    ```bash
    sudo apt install nginx -y
    ```
2.  Create config:
    ```bash
    sudo nano /etc/nginx/sites-available/livestream
    ```
3.  Paste this (replace `your_domain.com`):
    ```nginx
    server {
        listen 80;
        server_name your_domain.com;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
4.  Enable site and restart Nginx:
    ```bash
    sudo ln -s /etc/nginx/sites-available/livestream /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

Now you can access via `http://your_domain.com`.
