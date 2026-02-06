import asyncio
from pyatv import scan, connect, pair, exceptions
from pyatv.const import Protocol
from typing import List, Dict, Optional
from app.db.database import get_all_stored_devices, get_device_credentials, save_device_credentials

# Global cache for discovered devices (address -> AppleTVDevice)
discovered_devices_cache = {}

async def scan_network() -> List:
    """Perform a network scan for Apple TVs."""
    return await scan(loop=asyncio.get_event_loop(), timeout=5)

async def get_formatted_discovery_results() -> List[Dict]:
    """
    Perform a network scan and merge the results with devices stored in the database.
    Identifies online/offline status and applies stored credentials to online devices.
    Returns a list of formatted dictionaries for frontend consumption.
    """
    online_devices = await scan_network()
    stored_devices = await get_all_stored_devices()
    stored_map = {d['device_id']: d for d in stored_devices}
    
    discovered_devices_cache.clear()
    results = []
    processed_ids = set()

    # Process online devices
    for device in online_devices:
        res = _process_online_device(device, stored_map)
        results.append(res)
        processed_ids.add(res['device_id'])
        discovered_devices_cache[res['address']] = device

    # Add offline stored devices
    for dev_id, stored in stored_map.items():
        if dev_id not in processed_ids:
            results.append(_format_offline_device(stored))

    return results

def _process_online_device(device, stored_map: Dict) -> Dict:
    """
    Internal helper to process a single discovered online device.
    Checks against stored identifiers and applies credentials if a match is found.
    """
    is_paired = False
    matching_stored = None
    for identifier in device.all_identifiers:
        if identifier in stored_map:
            is_paired = True
            matching_stored = stored_map[identifier]
            break
    
    if is_paired and matching_stored['credentials']:
        _apply_credentials(device, matching_stored)

    return {
        "name": device.name,
        "address": str(device.address),
        "device_id": matching_stored['device_id'] if matching_stored else device.identifier,
        "services": [s.protocol.name for s in device.services],
        "paired": is_paired,
        "online": True
    }

def _apply_credentials(device, stored_info: Dict):
    """
    Internal helper to apply stored credentials to a pyatv device configuration.
    """
    try:
        proto_enum = next(p for p in Protocol if p.name == stored_info['protocol'])
        device.set_credentials(proto_enum, stored_info['credentials'])
    except Exception as e:
        print(f"Failed to apply credentials for {device.name}: {e}")

def _format_offline_device(stored: Dict) -> Dict:
    """
    Internal helper to format a stored device that was not found during the network scan.
    """
    return {
        "name": stored['name'],
        "address": stored['address'],
        "device_id": stored['device_id'],
        "services": [],
        "paired": True,
        "online": False
    }

async def get_paired_devices_initial() -> List[Dict]:
    """
    Retrieve all stored devices from the database for immediate display.
    Status is set to None (loading) as discovery hasn't verified them yet.
    """
    stored = await get_all_stored_devices()
    return [{
        "name": d['name'], "address": d['address'], "device_id": d['device_id'],
        "services": [], "paired": True, "online": None
    } for d in stored]

async def start_pairing_session(address: str):
    """
    Begin a pyatv pairing session for a device at the given IP address.
    Requires the device to have been recently discovered and cached.
    """
    device = discovered_devices_cache.get(address)
    if not device:
        raise ValueError(f"Device at {address} not found. Scan first.")
    
    protocol = _select_pairing_protocol(device)
    if not protocol:
        raise ValueError(f"No pairing protocol available for {device.name}")
    
    handler = await pair(device, protocol, asyncio.get_event_loop())
    await handler.begin()
    return handler

def _select_pairing_protocol(device) -> Optional[Protocol]:
    """
    Internal helper to select the best available protocol for pairing.
    Prioritizes MRP, then Companion, then DMAP.
    """
    for proto in [Protocol.MRP, Protocol.Companion, Protocol.DMAP]:
        if device.get_service(proto):
            return proto
    return None

async def finish_pairing_session(handler, pin: str):
    """
    Submit the PIN code to complete an active pairing session.
    Saves the resulting credentials to the database upon success.
    """
    handler.pin(pin)
    await handler.finish()
    
    credentials = handler.service.credentials
    protocol = handler.service.protocol.name
    device_id = handler.service.identifier
    
    # Try to find name/address from cache
    name, addr = "Unknown", "Unknown"
    for device in discovered_devices_cache.values():
        if device.identifier == device_id or any(s.identifier == device_id for s in device.services):
            name, addr = device.name, str(device.address)
            break
            
    await save_device_credentials(device_id, name, addr, protocol, credentials)
    return device_id, name, addr