import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.core import atv_manager, atv_remote
from app.db.database import delete_device
from pyatv import connect

# Session stores
connected_remotes = {} # websocket_id -> pyatv.AppleTV
active_pairings = {}   # websocket_id -> pyatv.PairingHandler

async def handle_websocket(websocket: WebSocket):
    """
    Core entry point for all WebSocket connections.
    Manages the connection lifecycle, message dispatching, and cleanup on disconnect.
    """
    await websocket.accept()
    ws_id = str(websocket.client)
    print(f"Client connected: {ws_id}")
    
    try:
        while True:
            raw_msg = await websocket.receive_text()
            await _process_message(websocket, ws_id, raw_msg)
    except WebSocketDisconnect:
        await _cleanup_session(ws_id)
    except Exception as e:
        print(f"WS Error: {e}")
        await _cleanup_session(ws_id)

async def _process_message(websocket, ws_id, raw_msg):
    """
    Parse incoming JSON messages and route them to the appropriate handler functions.
    Handles both system commands (discovery, pairing) and remote control actions.
    """
    try:
        data = json.loads(raw_msg)
        command = data.get("command")
        
        handlers = {
            "discover": _handle_discover,
            "get_paired": _handle_get_paired,
            "connect": _handle_connect,
            "disconnect": _handle_disconnect,
            "pair_start": _handle_pair_start,
            "pair_pin": _handle_pair_pin,
            "delete_device": _handle_delete,
        }
        
        if command in handlers:
            await handlers[command](websocket, ws_id, data)
        else:
            await _handle_remote_cmd(websocket, ws_id, command)
            
    except json.JSONDecodeError:
        await websocket.send_json({"type": "error", "message": "Invalid JSON"})

async def _handle_discover(websocket, ws_id, data):
    devices = await atv_manager.get_formatted_discovery_results()
    await websocket.send_json({"type": "discovery_results", "devices": devices})

async def _handle_get_paired(websocket, ws_id, data):
    devices = await atv_manager.get_paired_devices_initial()
    await websocket.send_json({"type": "discovery_results", "devices": devices})

async def _handle_connect(websocket, ws_id, data):
    """
    Handle connection requests to a specific Apple TV.
    Assumes credentials have already been applied to the cached device object.
    """
    address = data.get("address")
    device = atv_manager.discovered_devices_cache.get(address)
    if not device:
        await websocket.send_json({"type": "error", "message": "Device not found. Scan first."})
        return
    
    try:
        atv = await connect(device, loop=asyncio.get_event_loop())
        connected_remotes[ws_id] = atv
        await websocket.send_json({"type": "status", "message": f"Connected to {device.name}"})
    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"Connect failed: {e}"})

async def _handle_disconnect(websocket, ws_id, data):
    await _cleanup_session(ws_id)
    await websocket.send_json({"type": "status", "message": "Disconnected from Apple TV."})

async def _handle_pair_start(websocket, ws_id, data):
    """
    Initiate the pairing flow for a new device.
    Stores the pairing handler in the active_pairings session store.
    """
    try:
        handler = await atv_manager.start_pairing_session(data.get("address"))
        active_pairings[ws_id] = handler
        await websocket.send_json({"type": "pairing_status", "status": "started", "message": "Enter PIN"})
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})

async def _handle_pair_pin(websocket, ws_id, data):
    """
    Process the submitted PIN to complete pairing.
    On success, updates the client with the new device list and cleared pairing state.
    """
    handler = active_pairings.get(ws_id)
    if not handler:
        await websocket.send_json({"type": "error", "message": "No active pairing"})
        return
    
    try:
        dev_id, name, addr = await atv_manager.finish_pairing_session(handler, data.get("pin"))
        del active_pairings[ws_id]
        await websocket.send_json({"type": "pairing_status", "status": "completed", "address": addr})
        await _handle_discover(websocket, ws_id, {})
    except Exception as e:
        await websocket.send_json({"type": "pairing_status", "status": "failed", "message": str(e)})

async def _handle_delete(websocket, ws_id, data):
    await delete_device(data.get("device_id"))
    await _handle_discover(websocket, ws_id, {})

async def _handle_remote_cmd(websocket, ws_id, command):
    """
    Execute a remote control action on the currently connected device.
    Handles volume commands asynchronously to prevent UI blocking.
    """
    atv = connected_remotes.get(ws_id)
    if not atv:
        await websocket.send_json({"type": "error", "message": "Not connected"})
        return
    
    if command in ["volume_up", "volume_down"]:
        asyncio.create_task(atv_remote.perform_remote_command(atv, command))
    else:
        success, msg = await atv_remote.perform_remote_command(atv, command)
        if not success:
            await websocket.send_json({"type": "error", "message": msg})

async def _cleanup_session(ws_id):
    """
    Safely close any active connections or pairing handlers for a specific WebSocket session.
    Called on disconnect or explicit 'disconnect' commands.
    """
    if ws_id in connected_remotes:
        await connected_remotes[ws_id].close()
        del connected_remotes[ws_id]
    if ws_id in active_pairings:
        await active_pairings[ws_id].close()
        del active_pairings[ws_id]