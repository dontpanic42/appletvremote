from fastapi import FastAPI, WebSocket
from app.db.database import init_db
from app.api.websocket import handle_websocket

app = FastAPI(title="Apple TV Remote API")

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await handle_websocket(websocket)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
