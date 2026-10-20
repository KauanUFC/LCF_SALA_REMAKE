# LCFLIGHT backend + frontend production image.
# Multi-stage: build the React frontend, then run the Express backend
# which serves the compiled assets from ../frontend/dist.

# --- Stage 1: frontend build ---
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend ---
FROM node:24-alpine
WORKDIR /app

# better-sqlite3 needs a compiler + python for native addons.
RUN apk add --no-cache python3 make g++

COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/src ./src
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PORT=3000
ENV DB_PATH=/app/data/lcflight.db
ENV FRONTEND_DIR=./frontend/dist
ENV NODE_ENV=production

WORKDIR /app
EXPOSE 3000
CMD ["node", "src/server.js"]