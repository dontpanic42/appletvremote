#!/bin/bash

# Default UID/GID if not provided
USER_ID=${PUID:-1000}
GROUP_ID=${PGID:-1000}

echo "Starting with UID: $USER_ID, GID: $GROUP_ID"

# Check if group exists, if not create it
if ! getent group appgroup > /dev/null 2>&1; then
    groupadd -g "$GROUP_ID" appgroup
fi

# Check if user exists, if not create it
if ! id -u appuser > /dev/null 2>&1; then
    useradd -u "$USER_ID" -g "$GROUP_ID" -m appuser
fi

# Ensure the database directory is writable by the app user
DB_DIR=$(dirname "$DATABASE_PATH")
mkdir -p "$DB_DIR"
chown -R appuser:appgroup "$DB_DIR"

# Run the application
exec gosu appuser uvicorn app.main:app --host 0.0.0.0 --port 8000
