module.exports = {
  apps: [
    {
      name: 'eakmail-backend',
      cwd: './EakMail-backend',
      script: 'node',
      args: '--env-file=.env dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
