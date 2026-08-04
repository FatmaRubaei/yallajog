#!/usr/bin/env bash
# Deploy YallaJog API and/or Trainer Web to production.
# Usage (from workspace root):
#   bash scripts/deploy.sh          # deploy both
#   bash scripts/deploy.sh api      # API only
#   bash scripts/deploy.sh web      # trainer-web only
#
# Requires SERVER_PASSWORD env var (set in Replit Secrets).
set -euo pipefail

TARGET="${1:-both}"
SERVER="fatimah@185.227.108.185"
APP_DIR="/var/www/yallajog.com/yallajog/yallajog"

scp_opts="-o StrictHostKeyChecking=no"

deploy_api() {
  echo "==> Building API..."
  pnpm --filter @workspace/api-server run build

  echo "==> Deploying API dist to server..."
  sshpass -p "$SERVER_PASSWORD" ssh $scp_opts "$SERVER" \
    "rm -rf $APP_DIR/artifacts/api-server/dist"
  sshpass -p "$SERVER_PASSWORD" scp $scp_opts -r \
    artifacts/api-server/dist \
    "$SERVER:$APP_DIR/artifacts/api-server/dist"

  echo "==> Restarting API service..."
  sshpass -p "$SERVER_PASSWORD" ssh $scp_opts "$SERVER" \
    "echo '$SERVER_PASSWORD' | sudo -S systemctl restart trainer-api && sleep 3 && echo '$SERVER_PASSWORD' | sudo -S systemctl status trainer-api --no-pager | grep -E 'Active|Main PID'"

  echo "==> Verifying..."
  sleep 2
  HTTP=$(sshpass -p "$SERVER_PASSWORD" ssh $scp_opts "$SERVER" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/trainer/profile")
  if [ "$HTTP" = "401" ] || [ "$HTTP" = "200" ]; then
    echo "✓ API is up (HTTP $HTTP)"
  else
    echo "✗ API check returned HTTP $HTTP — check logs with: ssh $SERVER 'sudo journalctl -u trainer-api -n 30'"
    exit 1
  fi
}

deploy_web() {
  echo "==> Building trainer-web..."
  pnpm --filter @workspace/trainer-web run build

  echo "==> Deploying trainer-web dist to server..."
  sshpass -p "$SERVER_PASSWORD" ssh $scp_opts "$SERVER" \
    "rm -rf $APP_DIR/artifacts/trainer-web/dist"
  sshpass -p "$SERVER_PASSWORD" scp $scp_opts -r \
    artifacts/trainer-web/dist \
    "$SERVER:$APP_DIR/artifacts/trainer-web/dist"

  echo "✓ trainer-web deployed (served statically by nginx, no restart needed)"
}

case "$TARGET" in
  api)   deploy_api ;;
  web)   deploy_web ;;
  both)  deploy_api; deploy_web ;;
  *)     echo "Usage: $0 [api|web|both]"; exit 1 ;;
esac

echo ""
echo "==> Deploy complete!"
