import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.core import atv_manager, atv_remote, now_playing
from app.db.database import delete_device
from pyatv import connect
from pyatv.const import FeatureName, FeatureState

# Session stores
connected_remotes = {} # websocket_id -> pyatv.AppleTV
active_pairings = {}   # websocket_id -> pyatv.PairingHandler

async def handle_websocket(websocket: WebSocket):
    await websocket.accept()
    ws_id = str(websocket.client)
    try:
        while True:
            raw_msg = await websocket.receive_text()
            await _process_message(websocket, ws_id, raw_msg)
    except WebSocketDisconnect:
        await _cleanup_session(ws_id)
    except Exception as e:
        await _cleanup_session(ws_id)

async def _process_message(websocket, ws_id, raw_msg):
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
            "get_apps": _handle_get_apps,
            "launch_app": _handle_launch_app,
            "toggle_favorite": _handle_toggle_favorite,
        }
        
        if command in handlers:
            await handlers[command](websocket, ws_id, data)
        else:
            await _handle_remote_cmd(websocket, ws_id, command)
    except Exception as e:
        print(f"WS Process Error in {command if 'command' in locals() else 'unknown'}: {e}")

async def _handle_discover(websocket, ws_id, data):
    devices = await atv_manager.get_formatted_discovery_results()
    await websocket.send_json({"type": "discovery_results", "devices": devices})

async def _handle_get_paired(websocket, ws_id, data):
    devices = await atv_manager.get_paired_devices_initial()
    await websocket.send_json({"type": "discovery_results", "devices": devices})

async def _handle_connect(websocket, ws_id, data):
    address = data.get("address")
    device = atv_manager.discovered_devices_cache.get(address)
    if not device:
        await websocket.send_json({"type": "error", "message": "Scan first."})
        return
    
    try:
        atv = await connect(device, loop=asyncio.get_event_loop())
        connected_remotes[ws_id] = atv
        listener = now_playing.NowPlayingListener(atv, websocket, asyncio.get_event_loop())
        atv.push_updater.listener = listener
        atv.push_updater.start()
        asyncio.create_task(listener.initial_fetch())
        await websocket.send_json({"type": "status", "message": f"Connected to {device.name}"})
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})

async def _handle_disconnect(websocket, ws_id, data):
    await _cleanup_session(ws_id)
    await websocket.send_json({"type": "status", "message": "Disconnected from Apple TV."})

async def _handle_pair_start(websocket, ws_id, data):
    try:
        handler = await atv_manager.start_pairing_session(data.get("address"), data.get("protocol"))
        active_pairings[ws_id] = {"handler": handler, "address": data.get("address"), "queue": []}
        await websocket.send_json({"type": "pairing_status", "status": "started", "message": "Enter PIN"})
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})

async def _handle_pair_pin(websocket, ws_id, data):
    session = active_pairings.get(ws_id)
    if not session: return
    try:
        await atv_manager.finish_pairing_session(session["handler"], data.get("pin"))
        del active_pairings[ws_id]
        await websocket.send_json({"type": "pairing_status", "status": "completed", "address": session["address"]})
        await _handle_discover(websocket, ws_id, {})
    except Exception as e:
        await websocket.send_json({"type": "pairing_status", "status": "failed", "message": str(e)})

async def _handle_delete(websocket, ws_id, data):
    await delete_device(data.get("device_id"))
    await _handle_discover(websocket, ws_id, {})

async def _handle_get_apps(websocket, ws_id, data):
    atv = connected_remotes.get(ws_id)
    if not atv: return
    # Try multiple sources for device_id
    device_id = data.get("device_id") or atv.identifier or getattr(atv.config, 'identifier', None)
    if not device_id:
        print("DEBUG: No device_id found for get_apps")
        return
    app_data = await atv_remote.get_app_list(atv, device_id)
    await websocket.send_json({"type": "app_list", **app_data})

async def _handle_launch_app(websocket, ws_id, data):
    atv = connected_remotes.get(ws_id)
    if not atv: return
    success, msg = await atv_remote.launch_app(atv, data.get("bundle_id"))
    if success:
        # Give the TV a moment to switch apps, then force a metadata update
        await asyncio.sleep(1.5)
        try:
            playstatus = await atv.metadata.playing()
            # Find the listener in our connected_remotes or through push_updater
            if atv.push_updater and hasattr(atv.push_updater, 'listener'):
                await atv.push_updater.listener._update_now_playing(playstatus)
        except:
            pass
    else:
        await websocket.send_json({"type": "error", "message": msg})

async def _handle_toggle_favorite(websocket, ws_id, data):
    atv = connected_remotes.get(ws_id)
    # Use fallback chain for device_id
    device_id = data.get("device_id") or (atv.identifier if atv else None) or (getattr(atv.config, 'identifier', None) if atv else None)
    
    bundle_id = data.get("bundle_id")
    name = data.get("name")
    is_favorite = data.get("is_favorite")
    icon_url = data.get("icon_url")

    if not device_id:
        print("DEBUG: Failed to toggle favorite - Device ID not resolved.")
        return

    await atv_remote.toggle_favorite_app(
        device_id, 
        bundle_id, 
        name, 
        is_favorite,
        icon_url
    )
    
    # Refresh app list using the resolved device_id
    if atv:
        refresh_data = {"device_id": device_id}
        await _handle_get_apps(websocket, ws_id, refresh_data)

async def _handle_remote_cmd(websocket, ws_id, command):
    atv = connected_remotes.get(ws_id)
    if not atv: return
    if command in ["volume_up", "volume_down"]:
        asyncio.create_task(atv_remote.perform_remote_command(atv, command))
    else:
        success, msg = await atv_remote.perform_remote_command(atv, command)
        if not success: await websocket.send_json({"type": "error", "message": msg})

async def _cleanup_session(ws_id):
    if ws_id in connected_remotes:
        atv = connected_remotes[ws_id]
        if atv.push_updater: atv.push_updater.stop()
        await atv.close()
        del connected_remotes[ws_id]
    if ws_id in active_pairings:
        session = active_pairings[ws_id]
        if hasattr(session["handler"], "close"):
            await session["handler"].close()
        del active_pairings[ws_id]
