import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.core import atv_manager, atv_remote, now_playing
from app.db.database import delete_device
from pyatv import connect
from pyatv.const import FeatureName, FeatureState

# Session stores
connected_remotes = {} # websocket_id -> pyatv.AppleTV
# active_pairings now stores: { "handler": ..., "address": ..., "queue": [...] }
active_pairings = {}

async def handle_websocket(websocket: WebSocket):
    """
    Core entry point for all WebSocket connections.
    """
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
    """
    Parse incoming JSON messages and route them to the appropriate handler functions.
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
    except Exception as e:
        print(f"WS Process Error: {e}")

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
    """
    Initiate a pairing sequence. If no specific protocol is requested,
    it identifies all available unpaired services and starts a chained pairing flow.
    """
    address = data.get("address")
    device = atv_manager.discovered_devices_cache.get(address)
    if not device:
        await websocket.send_json({"type": "error", "message": "Device not found in cache."})
        return

    # Determine what to pair
    requested_proto = data.get("protocol")
    if requested_proto:
        queue = [requested_proto]
    else:
        # Get all services that aren't paired yet
        res = await atv_manager.get_formatted_discovery_results()
        device_info = next((d for d in res if d['address'] == address), None)
        queue = device_info['unpaired_services'] if device_info else []
        if not queue: # Fallback to generic best if list is empty
            queue = [p.name for p in [atv_manager._select_best_pairing_protocol(device)] if p]

    if not queue:
        await websocket.send_json({"type": "error", "message": "No unpaired services found."})
        return

    await _start_next_in_pairing_queue(websocket, ws_id, address, queue)

async def _start_next_in_pairing_queue(websocket, ws_id, address, queue):
    """Helper to start the next pairing handler in the queue."""
    protocol_to_pair = queue.pop(0)
    try:
        handler = await atv_manager.start_pairing_session(address, protocol_to_pair)
        active_pairings[ws_id] = {
            "handler": handler,
            "address": address,
            "queue": queue,
            "current_proto": protocol_to_pair
        }
        await websocket.send_json({
            "type": "pairing_status", 
            "status": "started", 
            "message": f"Enter PIN for {protocol_to_pair}",
            "protocol": protocol_to_pair,
            "step": "next" if len(active_pairings[ws_id].get("queue", [])) >= 0 else "final"
        })
    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"Failed to start {protocol_to_pair}: {e}"})

async def _handle_pair_pin(websocket, ws_id, data):
    """
    Completes current pairing step. If more protocols are in the queue, 
    immediately starts the next pairing step.
    """
    session = active_pairings.get(ws_id)
    if not session:
        await websocket.send_json({"type": "error", "message": "No active pairing"})
        return
    
    handler = session["handler"]
    address = session["address"]
    queue = session["queue"]

    try:
        await atv_manager.finish_pairing_session(handler, data.get("pin"))
        
        if queue:
            # More protocols to pair, start next one immediately
            print(f"DEBUG: Chaining next pairing protocol from queue: {queue}")
            await _start_next_in_pairing_queue(websocket, ws_id, address, queue)
        else:
            # All done
            del active_pairings[ws_id]
            await websocket.send_json({
                "type": "pairing_status", 
                "status": "completed", 
                "address": address,
                "message": "All services paired successfully!"
            })
            await _handle_discover(websocket, ws_id, {})
            
    except Exception as e:
        await websocket.send_json({"type": "pairing_status", "status": "failed", "message": str(e)})

async def _handle_delete(websocket, ws_id, data):
    await delete_device(data.get("device_id"))
    await _handle_discover(websocket, ws_id, {})

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
