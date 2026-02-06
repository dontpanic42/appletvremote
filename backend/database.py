import aiosqlite
import json

DATABASE_URL = "atv_remote.db"

async def init_db():
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
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute(
            "INSERT OR REPLACE INTO apple_tvs (device_id, name, address, protocol, credentials, paired) VALUES (?, ?, ?, ?, ?, 1)",
            (device_id, name, address, protocol, credentials)
        )
        await db.commit()
    print(f"Credentials saved for device: {name} (Protocol: {protocol})")

async def get_device_credentials(device_id: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row # To access columns by name
        cursor = await db.execute("SELECT * FROM apple_tvs WHERE device_id = ?", (device_id,))
        row = await cursor.fetchone()
        if row:
            # Convert row to a dict
            return dict(row)
        return None

async def get_all_stored_devices():
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM apple_tvs")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

async def delete_device(device_id: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("DELETE FROM apple_tvs WHERE device_id = ?", (device_id,))
        await db.commit()
    print(f"Device {device_id} deleted from database.")

