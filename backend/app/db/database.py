import aiosqlite
from typing import List, Optional, Dict

DATABASE_URL = "atv_remote.db"

async def init_db():
    """
    Initialize the SQLite database with a multi-pairing schema.
    Primary key is now (device_id, protocol) to allow multiple credentials per device.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
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
        await db.commit()
    print("Database initialized successfully.")

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
