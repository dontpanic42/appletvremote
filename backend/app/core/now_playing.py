import asyncio
import base64
from pyatv.interface import PushListener, Playing
from pyatv import exceptions
from typing import Optional

class NowPlayingListener(PushListener):
    """
    Listener for 'push updates' from Apple TV.
    Triggers artwork and metadata fetching when playback state changes.
    """
    def __init__(self, atv, websocket, loop):
        self.atv = atv
        self.websocket = websocket
        self.loop = loop
        self.last_artwork_id: Optional[str] = None
        self.last_title: Optional[str] = None

    def playstatus_update(self, updater, playstatus: Playing) -> None:
        """Called by pyatv when playback state or metadata changes."""
        print(f"DEBUG: playstatus_update: {playstatus.title} ({playstatus.device_state.name})")
        self.loop.create_task(self._update_now_playing(playstatus))

    def playstatus_error(self, updater, exception: Exception) -> None:
        """Called when an error occurs during push updates."""
        print(f"DEBUG: Push update error: {exception}")

    async def initial_fetch(self):
        """Perform an initial fetch of playback state immediately after connecting."""
        try:
            print("DEBUG: initial_fetch starting...")
            playstatus = await asyncio.wait_for(self.atv.metadata.playing(), timeout=5.0)
            await self._update_now_playing(playstatus)
        except Exception as e:
            print(f"DEBUG: Initial fetch failed: {e}")

    async def _update_now_playing(self, playstatus: Playing):
        """Fetch artwork safely and send full status to frontend."""
        try:
            artwork_data = None
            current_artwork_id = None
            
            # Safely get artwork ID
            try:
                current_artwork_id = self.atv.metadata.artwork_id
            except Exception:
                pass
            
            # Determine if we should attempt to fetch artwork
            should_fetch = (current_artwork_id != self.last_artwork_id) or \
                           (current_artwork_id is None and playstatus.title != self.last_title)

            if should_fetch and playstatus.title:
                try:
                    artwork = await asyncio.wait_for(self.atv.metadata.artwork(), timeout=3.0)
                    if artwork:
                        b64_artwork = base64.b64encode(artwork.bytes).decode('utf-8')
                        artwork_data = f"data:{artwork.mimetype};base64,{b64_artwork}"
                except Exception:
                    pass
                
                self.last_artwork_id = current_artwork_id
                self.last_title = playstatus.title

            # Fallback title if None
            display_title = playstatus.title
            if not display_title:
                try:
                    active_app = self.atv.metadata.app
                    if active_app:
                        display_title = f"Watching {active_app.name}"
                except:
                    pass
            
            if not display_title:
                display_title = "Not Playing"

            print(f"DEBUG: Sending now_playing to frontend: {display_title}")
            await self.websocket.send_json({
                "type": "now_playing",
                "title": display_title,
                "artist": playstatus.artist or playstatus.album or "Apple TV",
                "album": playstatus.album,
                "artwork": artwork_data,
                "has_artwork": artwork_data is not None,
                "device_state": playstatus.device_state.name.lower()
            })
        except Exception as e:
            print(f"DEBUG: Error in _update_now_playing: {e}")