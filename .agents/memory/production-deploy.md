---
name: Production deployment procedure
description: How to correctly deploy and restart the API server on the production server (185.227.108.185)
---

## Critical: Two PM2 instances exist on the server

The production server at `185.227.108.185` has **two PM2 daemons**:
- **Root's PM2** (`/root/.pm2/`) — this is the REAL one that owns port 8080 and serves all traffic
- **fatimah's PM2** (`/home/fatimah/.pm2/`) — this one can NEVER start because root already holds port 8080

**Root's PM2 config:**
- Script: `bash -c "node --enable-source-maps --env-file=.env dist/index.mjs"`
- CWD: `/var/www/yallajog.com/yallajog/yallajog/artifacts/api-server`
- Env file: `.env` in that directory (contains PORT, DATABASE_URL, SESSION_SECRET, NODE_ENV)

## Correct deployment procedure

1. Build locally in Replit workspace:
   ```
   pnpm --filter @workspace/api-server run build
   pnpm --filter @workspace/trainer-web run build
   ```

2. Copy dist files to server via scp:
   ```
   sshpass -p "$SERVER_PASSWORD" ssh ... "rm -rf .../artifacts/api-server/dist .../artifacts/trainer-web/dist"
   sshpass -p "$SERVER_PASSWORD" scp -r .../artifacts/api-server/dist fatimah@185.227.108.185:.../artifacts/api-server/dist
   sshpass -p "$SERVER_PASSWORD" scp -r .../artifacts/trainer-web/dist fatimah@185.227.108.185:.../artifacts/trainer-web/dist
   ```

3. Restart via SUDO (fatimah's pm2 restart will NOT work):
   ```
   echo '$SERVER_PASSWORD' | sudo -S pm2 restart trainer-api
   ```

**Why:**
Root's PM2 holds port 8080 exclusively. Fatimah's PM2 processes crash immediately with EADDRINUSE. Only `sudo pm2 restart trainer-api` restarts the real serving process.
