FROM node:22-slim AS base

WORKDIR /app

# System deps for Puppeteer + ffmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy workspace root + package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all deps
RUN npm ci

# Copy source
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY bin/ ./bin/

# Build
RUN npm run build -w shared 2>/dev/null || true
RUN npm run build -w frontend

# Expose
EXPOSE 43101

# Data volume
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=43101
ENV AGENT_OS_DATA_DIR=/app/data

CMD ["npx", "tsx", "backend/src/index.ts"]
