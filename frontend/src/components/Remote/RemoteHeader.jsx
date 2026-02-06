import React from 'react';
import { LayoutGrid, Power, Menu as MenuIcon } from 'lucide-react';

/**
 * RemoteHeader Component
 * 
 * The top bar of the remote control, containing navigation, app drawer, and power actions.
 */
const RemoteHeader = ({ 
  deviceName, 
  onOpenDrawer, 
  onPowerToggle,
  onToggleSidebar
}) => {
  return (
    <div className="remote-top-bar">
      {/* Left side actions */}
      <div className="remote-header-left">
        {/* Burger menu for device selection */}
        <button 
          className="sidebar-toggle-btn" 
          onClick={onToggleSidebar} 
          title="Select Device"
        >
          <MenuIcon size={24} />
        </button>

        <button 
          className="icon-btn-minimal" 
          onClick={onOpenDrawer} 
          title="Applications"
        >
          <LayoutGrid size={22} />
        </button>
      </div>
      
      {/* Centered device name */}
      <div className="remote-active-name">
        {deviceName}
      </div>
      
      <div className="remote-header-right">
        {/* Right side actions */}
        <button 
          className="pwr-btn" 
          onClick={onPowerToggle} 
          title="Power Toggle"
        >
          <Power size={22} />
        </button>
      </div>
    </div>
  );
};

export default RemoteHeader;