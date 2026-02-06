import aiohttp
import asyncio
from pyatv.const import PowerState
from typing import Tuple, List, Dict, Optional
from app.db.database import save_favourite_app, remove_favourite_app, get_favourite_apps

# Semaphore to prevent hitting Apple's API too hard at once
itunes_semaphore = asyncio.Semaphore(5)

async def perform_remote_command(atv, cmd: str) -> Tuple[bool, str]:
    """Execute a specific remote control command."""
    try:
        if cmd == "power_toggle":
            return await _handle_power_toggle(atv)
        
        handlers = {
            "play_pause": lambda: atv.remote_control.play_pause(),
            "menu": lambda: atv.remote_control.menu(),
            "home": lambda: atv.remote_control.home(),
            "up": lambda: atv.remote_control.up(),
            "down": lambda: atv.remote_control.down(),
            "left": lambda: atv.remote_control.left(),
            "right": lambda: atv.remote_control.right(),
            "select": lambda: atv.remote_control.select(),
            "volume_up": lambda: atv.audio.volume_up(),
            "volume_down": lambda: atv.audio.volume_down(),
        }
        
        if cmd in handlers:
            await handlers[cmd]()
            return True, f"Command {cmd} executed."
        return False, f"Unknown command: {cmd}"
    except Exception as e:
        return False, str(e)

async def launch_app(atv, bundle_id: str) -> Tuple[bool, str]:
    """Launch an application."""
    try:
        if not atv.apps: return False, "Not supported."
        await atv.apps.launch_app(bundle_id)
        return True, f"Launched {bundle_id}"
    except Exception as e:
        return False, str(e)

async def _fetch_itunes_icon(bundle_id: str, app_name: str) -> Optional[str]:
    """
    Robust icon lookup using iTunes API.
    Tries bundle ID lookup first, then falls back to name search.
    Handles inconsistent content-types from Apple API.
    """
    async with itunes_semaphore:
        try:
            async with aiohttp.ClientSession() as session:
                # 1. Try lookup by Bundle ID
                url = f"https://itunes.apple.com/lookup?bundleId={bundle_id}&entity=tvSoftware"
                async with session.get(url, timeout=3) as resp:
                    if resp.status == 200:
                        # Use content_type=None because Apple often returns text/javascript
                        data = await resp.json(content_type=None)
                        if data.get('resultCount', 0) > 0:
                            return data['results'][0].get('artworkUrl100')

                # 2. Fallback: Search by name
                search_url = f"https://itunes.apple.com/search?term={app_name}&entity=tvSoftware&limit=1"
                async with session.get(search_url, timeout=3) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        if data.get('resultCount', 0) > 0:
                            return data['results'][0].get('artworkUrl100')
        except Exception as e:
            # Silently fail for system apps that don't exist in the store
            pass
    return None

async def get_app_list(atv, device_id: str) -> Dict:
    """Fetch apps and icons with improved lookup logic."""
    try:
        all_apps = await atv.apps.app_list() if atv.apps else []
        
        favorites = await get_favourite_apps(device_id)
        fav_map = {f['bundle_id']: f for f in favorites}
        
        # Concurrently fetch icons
        tasks = [_fetch_itunes_icon(app.identifier, app.name) for app in all_apps]
        icons = await asyncio.gather(*tasks)
        
        formatted_apps = []
        app_icon_map = {} # bundle_id -> icon_url
        for app, icon in zip(all_apps, icons):
            app_icon_map[app.identifier] = icon
            formatted_apps.append({
                "name": app.name,
                "bundle_id": app.identifier,
                "icon_url": icon,
                "is_favorite": app.identifier in fav_map
            })
        
        # Hydrate favorites with icons if missing from DB record
        for fav in favorites:
            if not fav.get('icon_url') and fav['bundle_id'] in app_icon_map:
                fav['icon_url'] = app_icon_map[fav['bundle_id']]
            
        return {
            "all_apps": sorted(formatted_apps, key=lambda x: x['name']),
            "favorites": favorites
        }
    except Exception as e:
        print(f"Error fetching app list: {e}")
        return {"all_apps": [], "favorites": []}

async def toggle_favorite_app(device_id: str, bundle_id: str, name: str, is_favorite: bool, icon_url: Optional[str] = None):
    """Update favorite status in DB."""
    if is_favorite:
        if not icon_url:
            icon_url = await _fetch_itunes_icon(bundle_id, name)
        await save_favourite_app(device_id, bundle_id, name, icon_url)
    else:
        await remove_favourite_app(device_id, bundle_id)

async def _handle_power_toggle(atv) -> Tuple[bool, str]:
    if not atv.power: return False, "No power control."
    if atv.power.power_state == PowerState.On:
        try: await atv.remote_control.control_center()
        except: await atv.power.turn_off()
    else:
        await atv.power.turn_on()
    return True, "Power toggle sent."