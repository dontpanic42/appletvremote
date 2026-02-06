# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend and serving
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies for UID/GID management, healthcheck, and pyatv
RUN apt-get update && apt-get install -y \
    gosu \
    curl \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app/ ./app/

# Copy built frontend from Stage 1 into backend's static directory
COPY --from=frontend-builder /app/frontend/dist ./app/static

# Setup environment
ENV DATABASE_PATH=/app/data/atv_remote.db
ENV PYTHONUNBUFFERED=1

# Copy and setup entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]