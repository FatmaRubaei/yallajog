---
name: Production deployment procedure
description: How to correctly deploy and restart the API server on the production server (185.227.108.185)
---

## Current setup (as of 2026-08-04)

The API is now managed by **systemd**, not PM2. Both PM2 instances (root and fatimah) are empty.

- **Service**: `/etc/systemd/system/trainer-api.service`
- **Startup script**: `/usr/local/bin/start-trainer-api.sh` (sources NVM, runs `node --enable-source-maps --env-file=.env dist/index.mjs`)
- **Env file**: `/var/www/yallajog.com/yallajog/yallajog/artifacts/api-server/.env` (contains PORT, DATABASE_URL, SESSION_SECRET, META_APP_ID, META_APP_SECRET, WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID, WHATSAPP_WEBHOOK_VERIFY_TOKEN)
- **App dir**: `/var/www/yallajog.com/yallajog/yallajog/artifacts/api-server/`
- **Node binary**: `/root/.nvm/versions/node/v24.14.1/bin/node`
- **Logs**: `sudo journalctl -u trainer-api -n 50`

## Deploy from Replit (one command)

```bash
bash scripts/deploy.sh          # build & deploy both API and trainer-web
bash scripts/deploy.sh api      # API only
bash scripts/deploy.sh web      # trainer-web only
```

The script builds, scps the dist, and runs `sudo systemctl restart trainer-api`.

## Manual restart on server

```bash
sudo systemctl restart trainer-api
sudo systemctl status trainer-api
```

## Critical: pino absolute path bug (fixed in build.mjs)

`esbuild-plugin-pino` bakes the absolute build-machine path (e.g. `/home/runner/workspace/artifacts/api-server/dist`) into `dist/index.mjs` as `const outputDir = "..."`. On the production server this path doesn't exist, causing `MODULE_NOT_FOUND` for `thread-stream-worker.mjs` and instant crash.

**Fix already in `build.mjs`**: a post-build step replaces `const outputDir = "..."` with `const outputDir = __dirname`. This runs automatically on every build.

## Why systemd instead of PM2

Root's PM2 had 513k crash-restarts from competing with fatimah's PM2 over port 8080. Systemd is the proper Linux service manager: auto-restart with backoff (5s), StartLimitBurst=5 prevents infinite crash loops, starts on boot, single source of truth.
