module.exports = {
    apps: [{
        name: "livestream-studio",
        script: "./start_xvfb.sh",
        interpreter: "bash",
        watch: false,
        autorestart: true,
        max_memory_restart: '2G',
        env: {
            NODE_ENV: "production",
            PORT: 3000
        },
        error_file: "./logs/err.log",
        out_file: "./logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
};
