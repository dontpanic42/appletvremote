import asyncio
from pyatv import scan, connect, pair, exceptions
from pyatv.const import Protocol
from typing import List, Dict, Optional
from app.db.database import get_all_stored_devices, save_device_credentials, get_all_credentials_for_device

# Global cache for discovered devices (address -> AppleTVDevice)
discovered_devices_cache = {}

async def scan_network() -> List:
    """Perform a network scan for Apple TVs."""
    return await scan(loop=asyncio.get_event_loop(), timeout=5)

async def get_formatted_discovery_results() -> List[Dict]:
    """
    Perform a network scan and merge the results with devices stored in the database.
    Correctly groups multiple paired protocols into a single device entry based on address and name.
    """
    online_devices = await scan_network()
    stored_all = await get_all_stored_devices()
    
    # Group stored credentials by address + name (our best heuristic for 'same device')
    stored_groups = {}
    for entry in stored_all:
        key = f"{entry['address']}_{entry['name']}"
        if key not in stored_groups:
            stored_groups[key] = {
                'name': entry['name'], 
                'address': entry['address'], 
                'creds': [],
                'ids': set()
            }
        stored_groups[key]['creds'].append(entry)
        stored_groups[key]['ids'].add(entry['device_id'])
    
    discovered_devices_cache.clear()
    results = []
    processed_keys = set()

    # Handle online devices
    for device in online_devices:
        # Find matching stored group by checking identifiers
        matching_key = None
        for key, info in stored_groups.items():
            if not info['ids'].isdisjoint(device.all_identifiers):
                matching_key = key
                break
        
        # If no identifier match, fallback to address match
        if not matching_key:
            addr_key = f"{device.address}_{device.name}"
            if addr_key in stored_groups:
                matching_key = addr_key

        res = _process_online_device(device, stored_groups.get(matching_key) if matching_key else None)
        results.append(res)
        if matching_key:
            processed_keys.add(matching_key)
        discovered_devices_cache[res['address']] = device

    # Add offline stored devices
    for key, info in stored_groups.items():
        if key not in processed_keys:
            results.append(_format_offline_device(info))

    return results

def _process_online_device(device, stored_info: Optional[Dict]) -> Dict:
    paired_protocols = []
    
    if stored_info:
        for entry in stored_info['creds']:
            _apply_single_credential(device, entry)
            if entry['protocol'] not in paired_protocols:
                paired_protocols.append(entry['protocol'])

    available_services = [s.protocol.name for s in device.services]
    unpaired_services = [s for s in ['MRP', 'AirPlay', 'Companion'] 
                        if s in available_services and s not in paired_protocols]

    return {
        "name": device.name,
        "address": str(device.address),
        "device_id": device.identifier,
        "services": available_services,
        "paired_protocols": paired_protocols,
        "unpaired_services": unpaired_services,
        "paired": len(paired_protocols) > 0,
        "online": True
    }

def _apply_single_credential(device, entry: Dict):
    try:
        proto_enum = next(p for p in Protocol if p.name == entry['protocol'])
        device.set_credentials(proto_enum, entry['credentials'])
    except Exception as e:
        print(f"Failed to apply {entry['protocol']} for {device.name}: {e}")

def _format_offline_device(info: Dict) -> Dict:
    return {
        "name": info['name'], 
        "address": info['address'], 
        "device_id": list(info['ids'])[0] if info['ids'] else "unknown",
        "services": [], 
        "paired_protocols": [c['protocol'] for c in info['creds']], 
        "unpaired_services": [],
        "paired": True, 
        "online": False
    }

async def get_paired_devices_initial() -> List[Dict]:
    """Retrieve paired devices grouped by address and name for immediate display."""
    stored_all = await get_all_stored_devices()
    devices = {}
    for d in stored_all:
        key = f"{d['address']}_{d['name']}"
        if key not in devices:
            devices[key] = {
                "name": d['name'], "address": d['address'], "device_id": d['device_id'],
                "services": [], "paired": True, "online": None, "paired_protocols": []
            }
        if d['protocol'] not in devices[key]['paired_protocols']:
            devices[key]['paired_protocols'].append(d['protocol'])
    return list(devices.values())

async def start_pairing_session(address: str, protocol_name: Optional[str] = None):
    device = discovered_devices_cache.get(address)
    if not device:
        raise ValueError("Scan first.")
    
    if protocol_name:
        protocol = next(p for p in Protocol if p.name == protocol_name)
    else:
        protocol = _select_best_pairing_protocol(device)
        
    if not protocol:
        raise ValueError(f"No service available for pairing on {device.name}")
    
    handler = await pair(device, protocol, asyncio.get_event_loop())
    await handler.begin()
    return handler

def _select_best_pairing_protocol(device) -> Optional[Protocol]:
    for proto in [Protocol.MRP, Protocol.Companion, Protocol.AirPlay]:
        if device.get_service(proto):
            return proto
    return None

async def finish_pairing_session(handler, pin: str):
    handler.pin(pin)
    await handler.finish()
    
    credentials = handler.service.credentials
    protocol = handler.service.protocol.name
    device_id = handler.service.identifier
    
    name, addr = "Unknown", "Unknown"
    for device in discovered_devices_cache.values():
        if device.identifier == device_id or any(s.identifier == device_id for s in device.services):
            name, addr = device.name, str(device.address)
            break
            
    await save_device_credentials(device_id, protocol, name, addr, credentials)
    return device_id, name, addr