#!/usr/bin/env bash
# LCFLIGHT — build the frontend and start the backend (serves UI + API on :3000)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "==> LCFLIGHT launcher"

# 1. Backend .env (create from example if missing)
if [ ! -f "$BACKEND/.env" ]; then
  echo "==> Creating backend/.env from .env.example"
  cp "$BACKEND/.env.example" "$BACKEND/.env"
fi

# 2. Install deps if missing
if [ ! -d "$BACKEND/node_modules" ]; then
  echo "==> Installing backend dependencies"
  (cd "$BACKEND" && npm install)
fi
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "==> Installing frontend dependencies"
  (cd "$FRONTEND" && npm install)
fi

# 3. Build frontend (backend serves ../frontend/dist)
echo "==> Building frontend"
(cd "$FRONTEND" && npm run build)

# 4. Start backend (serves dist/ + API + SSE on PORT, default 3000)
PORT="${PORT:-3000}"
echo "==> Starting backend on http://localhost:${PORT}"
echo "    Open http://localhost:${PORT} in your browser (Ctrl+C to stop)"
cd "$BACKEND"
exec node src/server.js
