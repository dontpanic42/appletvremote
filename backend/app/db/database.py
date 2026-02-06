import os
import aiosqlite
import asyncio
from typing import List, Optional, Dict

# Configurable database path for Docker/Local persistence
DATABASE_URL = os.getenv("DATABASE_PATH", "atv_remote.db")

async def init_db():
    """
    Initialize the SQLite database with multi-pairing and favorites schema.
    """
    # Ensure directory exists if path is provided
    db_dir = os.path.dirname(DATABASE_URL)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    async with aiosqlite.connect(DATABASE_URL) as db:
        # 1. Create devices table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS apple_tvs (
                device_id TEXT,
                protocol TEXT,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                credentials TEXT,
                paired INTEGER DEFAULT 0,
                PRIMARY KEY (device_id, protocol)
            )
        """)
        
        # 2. Create favorites table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS favourite_apps (
                device_id TEXT,
                bundle_id TEXT,
                name TEXT NOT NULL,
                PRIMARY KEY (device_id, bundle_id)
            )
        """)
        
        # 3. Check for missing columns in favourite_apps
        cursor = await db.execute("PRAGMA table_info(favourite_apps)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'icon_url' not in column_names:
            print("Migration: Adding 'icon_url' column to favourite_apps table...")
            await db.execute("ALTER TABLE favourite_apps ADD COLUMN icon_url TEXT")
            print("Migration complete.")

        await db.commit()
    print("Database initialized successfully.")

async def save_favourite_app(device_id: str, bundle_id: str, name: str, icon_url: Optional[str] = None):
    """Save an app to the device's favorites list."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            await db.execute(
                "INSERT OR REPLACE INTO favourite_apps (device_id, bundle_id, name, icon_url) VALUES (?, ?, ?, ?)",
                (device_id, bundle_id, name, icon_url)
            )
            await db.commit()
        print(f"DEBUG DB: Saved favorite {name} ({bundle_id}) for device {device_id}")
    except Exception as e:
        print(f"ERROR DB saving favorite: {e}")

async def remove_favourite_app(device_id: str, bundle_id: str):
    """Remove an app from the device's favorites list."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            await db.execute(
                "DELETE FROM favourite_apps WHERE device_id = ? AND bundle_id = ?",
                (device_id, bundle_id)
            )
            await db.commit()
        print(f"DEBUG DB: Removed favorite {bundle_id}")
    except Exception as e:
        print(f"ERROR DB removing favorite: {e}")

async def get_favourite_apps(device_id: str) -> List[Dict]:
    """Retrieve all favorite apps for a specific device."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM favourite_apps WHERE device_id = ?", (device_id,))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"ERROR DB fetching favorites: {e}")
        return []

async def save_device_credentials(device_id: str, protocol: str, name: str, address: str, credentials: str):
    """Save credentials for a specific protocol on a device."""
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute(
            "INSERT OR REPLACE INTO apple_tvs (device_id, protocol, name, address, credentials, paired) VALUES (?, ?, ?, ?, ?, 1)",
            (device_id, protocol, name, address, credentials)
        )
        await db.commit()
    print(f"Credentials saved for {name} (Protocol: {protocol})")

async def get_all_credentials_for_device(device_id: str) -> List[Dict]:
    """Retrieve all paired protocols and credentials for a specific device."""
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM apple_tvs WHERE device_id = ?", (device_id,))
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

async def get_all_stored_devices() -> List[Dict]:
    """Retrieve all unique devices and their paired protocols."""
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM apple_tvs")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

async def delete_device(device_id: str):
    """Remove all protocol credentials for a device."""
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("DELETE FROM apple_tvs WHERE device_id = ?", (device_id,))
        await db.commit()
    print(f"All records for device {device_id} deleted from database.")
