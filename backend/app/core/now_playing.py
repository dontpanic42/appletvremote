import asyncio
import base64
from pyatv.interface import PushListener, Playing
from pyatv import exceptions
from typing import Optional

class NowPlayingListener(PushListener):
    """
    Listener for 'push updates' from Apple TV.
    Triggers artwork and metadata fetching when playback state or active app changes.
    Includes a fallback polling mechanism to ensure metadata stays in sync.
    """
    def __init__(self, atv, websocket, loop):
        self.atv = atv
        self.websocket = websocket
        self.loop = loop
        self.last_artwork_id: Optional[str] = None
        self.last_artwork_data: Optional[str] = None
        self.last_title: Optional[str] = None
        self.last_app: Optional[str] = None
        self.is_running = True
        
        # Start a background sync task to catch updates that push might miss
        self.loop.create_task(self._periodic_sync())

    def playstatus_update(self, updater, playstatus: Playing) -> None:
        """Called by pyatv when playback state or metadata changes."""
        print(f"DEBUG: Push update received: {playstatus.title} ({playstatus.device_state.name})")
        self.loop.create_task(self._update_now_playing(playstatus))

    def playstatus_error(self, updater, exception: Exception) -> None:
        """Called when an error occurs during push updates."""
        print(f"DEBUG: Push update error: {exception}")

    async def stop(self):
        """Stop the listener and background tasks."""
        self.is_running = False

    async def initial_fetch(self):
        """Perform an initial fetch of playback state immediately after connecting."""
        try:
            print("DEBUG: Performing initial metadata sync...")
            playstatus = await asyncio.wait_for(self.atv.metadata.playing(), timeout=5.0)
            await self._update_now_playing(playstatus)
        except Exception as e:
            print(f"DEBUG: Initial fetch failed: {e}")

    async def _periodic_sync(self):
        """Fallback polling to ensure metadata is updated even if push updates fail."""
        while self.is_running:
            await asyncio.sleep(10) # Poll every 10 seconds as a safety net
            try:
                if self.atv:
                    playstatus = await self.atv.metadata.playing()
                    # Only trigger update if something meaningful changed
                    if playstatus.title != self.last_title or playstatus.device_state.name.lower() != self.last_device_state:
                        print("DEBUG: Periodic sync detected change, updating...")
                        await self._update_now_playing(playstatus)
            except:
                pass

    async def _update_now_playing(self, playstatus: Playing):
        """Fetch artwork safely and send full status to frontend."""
        try:
            current_artwork_id = None
            current_app = None
            self.last_device_state = playstatus.device_state.name.lower()
            
            # 1. Resolve current App
            try:
                app_info = self.atv.metadata.app
                current_app = app_info.name if app_info else None
            except:
                pass
            
            # 2. Resolve Artwork ID
            try:
                current_artwork_id = self.atv.metadata.artwork_id
            except:
                pass
            
            # 3. Determine if we need to fetch NEW artwork
            # We fetch if: App changed, Title changed, or Artwork ID changed
            changed_app = current_app != self.last_app
            changed_title = playstatus.title != self.last_title
            changed_art_id = current_artwork_id != self.last_artwork_id
            
            if changed_app or changed_title or changed_art_id:
                print(f"DEBUG: Metadata change detected. Fetching artwork... (App: {current_app}, Title: {playstatus.title})")
                try:
                    artwork = await asyncio.wait_for(self.atv.metadata.artwork(), timeout=3.0)
                    if artwork:
                        b64_artwork = base64.b64encode(artwork.bytes).decode('utf-8')
                        self.last_artwork_data = f"data:{artwork.mimetype};base64,{b64_artwork}"
                    else:
                        self.last_artwork_data = None
                except Exception as e:
                    print(f"DEBUG: Artwork fetch failed: {e}")
                    # On failure, we clear it if the app/title changed to avoid showing stale art
                    if changed_app or changed_title:
                        self.last_artwork_data = None
                
                self.last_artwork_id = current_artwork_id
                self.last_title = playstatus.title
                self.last_app = current_app

            # 4. Fallback title logic for display
            display_title = playstatus.title
            display_artist = playstatus.artist or playstatus.album
            
            if not display_title:
                if current_app:
                    display_title = f"Watching {current_app}"
                    display_artist = "Apple TV"
                else:
                    display_title = "Not Playing"
                    display_artist = "Apple TV"

            # 5. Send to frontend
            await self.websocket.send_json({
                "type": "now_playing",
                "title": display_title,
                "artist": display_artist or "Apple TV",
                "album": playstatus.album,
                "artwork": self.last_artwork_data, # Use the cached artwork data
                "has_artwork": self.last_artwork_data is not None,
                "device_state": self.last_device_state,
                "app": current_app
            })
        except Exception as e:
            print(f"DEBUG: Error in _update_now_playing: {e}")