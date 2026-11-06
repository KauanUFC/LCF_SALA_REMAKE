#!/usr/bin/env bash
# LCFLIGHT — development mode (backend on :3000, frontend dev server on :5173)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [ ! -f "$BACKEND/.env" ]; then
  echo "==> Creating backend/.env from .env.example"
  cp "$BACKEND/.env.example" "$BACKEND/.env"
fi

[ -d "$BACKEND/node_modules" ] || (cd "$BACKEND" && npm install)
[ -d "$FRONTEND/node_modules" ] || (cd "$FRONTEND" && npm install)

echo "==> Backend  : http://localhost:3000"
echo "==> Frontend : http://localhost:5173  (open this one; it proxies /api and /events)"
echo "    Press Ctrl+C to stop both."

(cd "$BACKEND" && npm run dev) &
BACK_PID=$!
trap 'kill $BACK_PID 2>/dev/null || true' INT TERM

(cd "$FRONTEND" && npm run dev)
