from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pyatv import scan, connect, exceptions, pair # Added pair
from pyatv.const import Protocol
import asyncio
import json
from database import init_db, save_device_credentials, get_device_credentials, get_all_stored_devices, delete_device

app = FastAPI()

# Store discovered devices (address -> pyatv.conf.AppleTVDevice)
discovered_devices = {}
# Store connected Apple TV instances (websocket_id -> pyatv.AppleTV)
connected_atv_remotes = {}
# Store active pairing instances (websocket_id -> pyatv.protocols.mrp.pairing.MrpPairingHandler)
active_pairings = {}

@app.on_event("startup")
async def startup_event():
    await init_db()

async def discover_apple_tvs():
    """Discover Apple TVs on the network and merge with stored devices."""
    print("Starting Apple TV discovery...")
    
    # 1. Get current scan results (online devices)
    online_devices = await scan(loop=asyncio.get_event_loop(), timeout=5) 
    
    # 2. Get all stored devices from DB
    stored_devices = await get_all_stored_devices()
    stored_devices_map = {d['device_id']: d for d in stored_devices}

    # Clear previously discovered devices cache
    discovered_devices.clear()
    
    formatted_results = []
    processed_ids = set()

    # Handle online devices
    for device in online_devices:
        # Check if any of the device's identifiers match a stored device_id
        is_paired = False
        matching_stored_info = None
        for identifier in device.all_identifiers:
            if identifier in stored_devices_map:
                is_paired = True
                matching_stored_info = stored_devices_map[identifier]
                break
        
        device_id = (matching_stored_info['device_id'] if matching_stored_info else device.identifier)
        processed_ids.add(device_id)
        
        # If paired, apply credentials to the device configuration
        if is_paired and matching_stored_info['credentials'] and matching_stored_info['protocol']:
            proto_name = matching_stored_info['protocol']
            try:
                # Find the protocol enum from name
                proto_enum = next(p for p in Protocol if p.name == proto_name)
                device.set_credentials(proto_enum, matching_stored_info['credentials'])
                print(f"Applied stored {proto_name} credentials to {device.name}")
            except (StopIteration, Exception) as e:
                print(f"Failed to apply credentials for {device.name}: {e}")

        device_services = [s.protocol.name for s in device.services]
        print(f"Online device found: {device.name} at {device.address}, services: {device_services}, paired: {is_paired}")
        
        # Store in cache for connection/pairing
        discovered_devices[str(device.address)] = device
        
        formatted_results.append({
            "name": device.name, 
            "address": str(device.address), 
            "device_id": device_id,
            "services": device_services,
            "paired": is_paired,
            "online": True
        })

    # Handle stored devices that are offline
    for device_id, stored_info in stored_devices_map.items():
        if device_id not in processed_ids:
            print(f"Offline stored device: {stored_info['name']} ({device_id})")
            formatted_results.append({
                "name": stored_info['name'],
                "address": stored_info['address'],
                "device_id": device_id,
                "services": [], # Services unknown while offline
                "paired": True,
                "online": False
            })

    print(f"Discovery finished. Total devices: {len(formatted_results)} ({len(online_devices)} online, {len(formatted_results) - len(online_devices)} offline).")
    return formatted_results

async def perform_command(atv_instance, command_type):
    """Performs a remote control command on the Apple TV."""
    if not atv_instance:
        return False, "Not connected to an Apple TV."

    try:
        if command_type == "play":
            await atv_instance.remote_control.play()
        elif command_type == "pause":
            await atv_instance.remote_control.pause()
        elif command_type == "play_pause":
            await atv_instance.remote_control.play_pause()
        elif command_type == "menu":
            await atv_instance.remote_control.menu()
        elif command_type == "up":
            await atv_instance.remote_control.up()
        elif command_type == "down":
            await atv_instance.remote_control.down()
        elif command_type == "left":
            await atv_instance.remote_control.left()
        elif command_type == "right":
            await atv_instance.remote_control.right()
        elif command_type == "select":
            await atv_instance.remote_control.select()
        elif command_type == "home":
            await atv_instance.remote_control.home()
        elif command_type == "power_on":
            if atv_instance.power:
                await atv_instance.power.turn_on()
            else:
                return False, "Power control not available for this device."
        elif command_type == "power_off":
            if atv_instance.power:
                await atv_instance.power.turn_off()
            else:
                return False, "Power control not available for this device."
        elif command_type == "volume_up":
            if atv_instance.audio:
                await atv_instance.audio.volume_up()
            else:
                return False, "Volume control not available for this device."
        elif command_type == "volume_down":
            if atv_instance.audio:
                await atv_instance.audio.volume_down()
            else:
                return False, "Volume control not available for this device."
        else:
            return False, f"Unknown command: {command_type}"
        return True, f"Command '{command_type}' sent successfully."
    except Exception as e:
        return False, f"Error sending command '{command_type}': {e}"


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_id = str(websocket.client) 
    print(f"WebSocket client connected: {websocket_id}")

    if websocket_id in connected_atv_remotes:
        await connected_atv_remotes[websocket_id].close()
        del connected_atv_remotes[websocket_id]

    try:
        while True:
            message = await websocket.receive_text()
            print(f"Received message from {websocket_id}: {message}")
            try:
                data = json.loads(message)
                command = data.get("command")
                
                if command == "discover":
                    devices = await discover_apple_tvs()
                    await websocket.send_json({"type": "discovery_results", "devices": devices})
                
                elif command == "get_paired":
                    stored_devices = await get_all_stored_devices()
                    formatted_stored = [{
                        "name": d['name'],
                        "address": d['address'],
                        "device_id": d['device_id'],
                        "services": [],
                        "paired": True,
                        "online": None # None indicates status is unknown/verifying
                    } for d in stored_devices]
                    await websocket.send_json({"type": "discovery_results", "devices": formatted_stored})
                
                elif command == "connect":
                    address = data.get("address")
                    if not address:
                        await websocket.send_json({"type": "error", "message": "Address is missing for connect command."})
                        continue
                    
                    device = discovered_devices.get(address)
                    if not device:
                        await websocket.send_json({"type": "error", "message": f"Device at address {address} not found. Please run discovery first."})
                        continue

                    print(f"Attempting to connect to {device.name} at {device.address}")

                    try:
                        # Credentials have already been applied during discovery
                        atv = await connect(device, loop=asyncio.get_event_loop())
                        connected_atv_remotes[websocket_id] = atv
                        await websocket.send_json({"type": "status", "message": f"Connected to {device.name}"})
                        print(f"Successfully connected to {device.name}")
                    except exceptions.NoServiceError as e:
                        await websocket.send_json({"type": "error", "message": f"No supported service found for {device.name}: {e}. Try pairing."})
                    except exceptions.AuthenticationError:
                        await websocket.send_json({"type": "error", "message": f"Authentication failed for {device.name}. Credentials might be invalid or pairing required."})
                    except Exception as e:
                        await websocket.send_json({"type": "error", "message": f"Failed to connect to {device.name}: {e}"})
                
                elif command == "disconnect":
                    if websocket_id in connected_atv_remotes:
                        atv_instance = connected_atv_remotes[websocket_id]
                        await atv_instance.close()
                        del connected_atv_remotes[websocket_id]
                        await websocket.send_json({"type": "status", "message": "Disconnected from Apple TV."})
                        print(f"Disconnected {websocket_id} from Apple TV.")
                    else:
                        await websocket.send_json({"type": "error", "message": "Not currently connected to an Apple TV."})
                
                elif command == "pair_start":
                    address = data.get("address")
                    if not address:
                        await websocket.send_json({"type": "error", "message": "Address is missing for pair_start command."})
                        continue
                    
                    device_to_pair = discovered_devices.get(address)
                    if not device_to_pair:
                        await websocket.send_json({"type": "error", "message": f"Device at address {address} not found for pairing."})
                        return

                    if websocket_id in active_pairings:
                        try:
                            await active_pairings[websocket_id].close()
                        except AttributeError: 
                            pass
                        del active_pairings[websocket_id]

                    print(f"Starting pairing process for {device_to_pair.name} at {device_to_pair.address}")

                    # Determine which protocol to use for pairing
                    pairing_protocol = None
                    if device_to_pair.get_service(Protocol.MRP):
                        pairing_protocol = Protocol.MRP
                    elif device_to_pair.get_service(Protocol.Companion):
                        pairing_protocol = Protocol.Companion
                    elif device_to_pair.get_service(Protocol.DMAP): # Check for DMAP as well
                        pairing_protocol = Protocol.DMAP
                    
                    if not pairing_protocol:
                        await websocket.send_json({"type": "error", "message": f"No suitable pairing protocol found for {device_to_pair.name}. Available services: {[s.protocol.name for s in device_to_pair.services]}."})
                        return

                    try:
                        # Use the high-level pyatv.pair function with the selected protocol
                        handler = await pair(device_to_pair, pairing_protocol, asyncio.get_event_loop())
                        await handler.begin() # Start the pairing procedure
                        active_pairings[websocket_id] = handler
                        await websocket.send_json({"type": "pairing_status", "status": "started", "message": f"Pairing started for {device_to_pair.name} using {pairing_protocol.name}. Enter PIN displayed on Apple TV."})
                    except Exception as e:
                        print(f"Error starting pairing: {e}")
                        await websocket.send_json({"type": "error", "message": f"Failed to start pairing: {e}"})

                elif command == "pair_pin":
                    pin = data.get("pin")
                    if not pin:
                        await websocket.send_json({"type": "error", "message": "PIN is missing for pair_pin command."})
                        continue
                    
                    handler = active_pairings.get(websocket_id)
                    if not handler:
                        await websocket.send_json({"type": "error", "message": "No active pairing session. Start pairing first."})
                        return
                    
                    try:
                        handler.pin(pin) 
                        await handler.finish() 
                        
                        credentials = handler.service.credentials
                        protocol = handler.service.protocol.name # Get protocol name
                        device_id = handler.service.identifier
                        device_name = "Unknown"
                        device_address = "Unknown"
                        
                        # Find the original device_to_pair from discovered_devices to get its name and address
                        for addr, dev in discovered_devices.items():
                            if dev.identifier == device_id or any(s.identifier == device_id for s in dev.services):
                                device_name = dev.name
                                device_address = addr
                                break
                        
                        await save_device_credentials(device_id, device_name, device_address, protocol, credentials)
                        await handler.close() 
                        del active_pairings[websocket_id]
                        await websocket.send_json({
                            "type": "pairing_status", 
                            "status": "completed", 
                            "message": f"Pairing successful for {device_name}! Credentials saved.",
                            "address": device_address
                        })
                        # Re-run discovery to update paired status on frontend
                        devices = await discover_apple_tvs()
                        await websocket.send_json({"type": "discovery_results", "devices": devices})
                        
                    except exceptions.PairingError as e:
                        await websocket.send_json({
                            "type": "pairing_status", 
                            "status": "failed", 
                            "message": f"Pairing failed: {e}. Please try again.",
                            "address": device_to_pair.address
                        })
                        try:
                            await handler.close()
                        except AttributeError:
                            pass
                        del active_pairings[websocket_id]
                    except Exception as e:
                        print(f"Error during PIN submission: {e}")
                        await websocket.send_json({"type": "error", "message": f"Error during PIN submission: {e}"})
                        try:
                            await handler.close()
                        except AttributeError:
                            pass
                        del active_pairings[websocket_id]
                
                elif command == "delete_device":
                    device_id_to_delete = data.get("device_id")
                    if not device_id_to_delete:
                        await websocket.send_json({"type": "error", "message": "Device ID is missing for delete_device command."})
                        continue
                    await delete_device(device_id_to_delete)
                    await websocket.send_json({"type": "status", "message": f"Device {device_id_to_delete} deleted from database."})
                    devices = await discover_apple_tvs()
                    await websocket.send_json({"type": "discovery_results", "devices": devices})


                elif command in ["play", "pause", "play_pause", "menu", "up", "down", "left", "right", "select", "home", "volume_up", "volume_down", "power_on", "power_off"]:
                    if websocket_id in connected_atv_remotes:
                        atv_instance = connected_atv_remotes[websocket_id]
                        
                        if command in ["volume_up", "volume_down"]:
                            # Run volume commands in background to avoid UI lag
                            # as they can take a while to be acknowledged by the device
                            async def run_volume_in_bg(cmd):
                                success, result_message = await perform_command(atv_instance, cmd)
                                try:
                                    await websocket.send_json({
                                        "type": "command_status", 
                                        "command": cmd, 
                                        "status": "success" if success else "error", 
                                        "message": result_message
                                    })
                                except:
                                    pass # WebSocket might be closed
                            
                            asyncio.create_task(run_volume_in_bg(command))
                        else:
                            success, result_message = await perform_command(atv_instance, command)
                            if success:
                                await websocket.send_json({"type": "command_status", "command": command, "status": "success", "message": result_message})
                            else:
                                await websocket.send_json({"type": "command_status", "command": command, "status": "error", "message": result_message})
                    else:
                        await websocket.send_json({"type": "error", "message": "Not connected to an Apple TV. Please connect first."})
                
                else:
                    await websocket.send_json({"type": "error", "message": f"Unknown command: {command}"})
            
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
            except Exception as e:
                print(f"Error processing message: {e}")
                await websocket.send_json({"type": "error", "message": f"Server error: {e}"})

    except WebSocketDisconnect:
        print(f"WebSocket client disconnected: {websocket_id}")
        if websocket_id in connected_atv_remotes:
            atv_instance = connected_atv_remotes[websocket_id]
            await atv_instance.close()
            del connected_atv_remotes[websocket_id]
            print(f"Cleaned up Apple TV connection for {websocket_id}.")
        if websocket_id in active_pairings:
            try: # Handler might not have a close() method if it failed early
                await active_pairings[websocket_id].close()
            except AttributeError:
                pass
            del active_pairings[websocket_id]
            print(f"Cleaned up active pairing for {websocket_id}.")
    except Exception as e:
        print(f"Unexpected error in websocket_endpoint for {websocket_id}: {e}")