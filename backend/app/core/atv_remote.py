from pyatv.const import PowerState
from typing import Tuple

async def perform_remote_command(atv, cmd: str) -> Tuple[bool, str]:
    """
    Execute a specific remote control command on an active Apple TV connection.
    Supports standard navigation, playback, volume, and power management.
    Returns a tuple of (success_boolean, status_message).
    """
    try:
        if cmd == "power_toggle":
            return await _handle_power_toggle(atv)
        
        # Mapping command strings to pyatv methods
        handlers = {
            "play": lambda: atv.remote_control.play(),
            "pause": lambda: atv.remote_control.pause(),
            "play_pause": lambda: atv.remote_control.play_pause(),
            "menu": lambda: atv.remote_control.menu(),
            "home": lambda: atv.remote_control.home(),
            "up": lambda: atv.remote_control.up(),
            "down": lambda: atv.remote_control.down(),
            "left": lambda: atv.remote_control.left(),
            "right": lambda: atv.remote_control.right(),
            "select": lambda: atv.remote_control.select(),
            "control_center": lambda: atv.remote_control.control_center(),
            "volume_up": lambda: atv.audio.volume_up() if atv.audio else _raise_no_audio(),
            "volume_down": lambda: atv.audio.volume_down() if atv.audio else _raise_no_audio(),
            "power_on": lambda: atv.power.turn_on() if atv.power else _raise_no_power(),
            "power_off": lambda: atv.power.turn_off() if atv.power else _raise_no_power(),
        }
        
        if cmd in handlers:
            await handlers[cmd]()
            return True, f"Command {cmd} executed."
        
        return False, f"Unknown command: {cmd}"
    except Exception as e:
        return False, str(e)

async def _handle_power_toggle(atv) -> Tuple[bool, str]:
    """
    Internal helper to handle intuitive power toggling.
    If the device is on, it opens the Control Center (standard iOS remote behavior).
    If the device is off, it sends a turn_on command.
    """
    if not atv.power:
        return False, "Power control not available."
    
    if atv.power.power_state == PowerState.On:
        try:
            await atv.remote_control.control_center()
        except:
            await atv.power.turn_off()
    else:
        await atv.power.turn_on()
    return True, "Power toggle command sent."

def _raise_no_audio():
    raise ValueError("Audio control not available.")

def _raise_no_power():
    raise ValueError("Power control not available.")