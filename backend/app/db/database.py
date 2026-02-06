import aiosqlite
import json
from typing import List, Optional, Dict

DATABASE_URL = "atv_remote.db"

async def init_db():
    """
    Initialize the SQLite database and create the apple_tvs table if it doesn't exist.
    This includes columns for device identification, credentials, and pairing status.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS apple_tvs (
                device_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                protocol TEXT,
                credentials TEXT,
                paired INTEGER DEFAULT 0
            )
        """)
        await db.commit()
    print("Database initialized successfully.")

async def save_device_credentials(device_id: str, name: str, address: str, protocol: str, credentials: str):
    """
    Save or update Apple TV credentials in the database.
    Sets the paired status to 1 (True) upon saving.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute(
            "INSERT OR REPLACE INTO apple_tvs (device_id, name, address, protocol, credentials, paired) VALUES (?, ?, ?, ?, ?, 1)",
            (device_id, name, address, protocol, credentials)
        )
        await db.commit()
    print(f"Credentials saved for device: {name} (Protocol: {protocol})")

async def get_device_credentials(device_id: str) -> Optional[Dict]:
    """
    Retrieve stored credentials and info for a specific Apple TV by its device_id.
    Returns a dictionary of column names to values, or None if not found.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM apple_tvs WHERE device_id = ?", (device_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_all_stored_devices() -> List[Dict]:
    """
    Retrieve all Apple TV devices stored in the database.
    Returns a list of dictionaries, each representing a stored device.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM apple_tvs")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

async def delete_device(device_id: str):
    """
    Remove an Apple TV's credentials and information from the database by its device_id.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("DELETE FROM apple_tvs WHERE device_id = ?", (device_id,))
        await db.commit()
    print(f"Device {device_id} deleted from database.")