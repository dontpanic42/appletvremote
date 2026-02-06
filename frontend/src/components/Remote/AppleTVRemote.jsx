import React from 'react';
import { Power, ArrowLeft, Menu as MenuIcon, Play, Pause, Plus, Minus, Tv } from 'lucide-react';
import NowPlaying from './NowPlaying';
import Touchpad from './Touchpad';

/**
 * AppleTVRemote Component
 * 
 * The main container for the iOS-style remote control interface.
 * 
 * @param {Object} props.device - The currently connected Apple TV device info.
 * @param {Object} props.nowPlaying - Current media metadata and artwork.
 * @param {Function} props.onCommand - Function to send remote commands.
 * @param {Function} props.onDisconnect - Function to disconnect from the current device.
 * @param {Function} props.onOpenSidebar - Function to toggle the sidebar on mobile.
 */
const AppleTVRemote = ({ 
  device, 
  nowPlaying, 
  onCommand, 
  onDisconnect, 
  onOpenSidebar 
}) => {
  return (
    <div className="remote-center">
      {/* Dynamic blurred background based on current artwork */}
      {nowPlaying?.artwork && (
        <div 
          className="artwork-background" 
          style={{ backgroundImage: `url(${nowPlaying.artwork})` }}
        ></div>
      )}
      
      <div className="remote-top-bar">
        {/* Burger menu for mobile sidebar access */}
        <button className="mobile-menu-btn" onClick={onOpenSidebar}>
          <MenuIcon size={24} />
        </button>
        {/* Back button to return to device selection */}
        <button className="close-remote-btn desktop-only" onClick={onDisconnect}>
          <ArrowLeft size={20} /> <span>Back</span>
        </button>
        <div className="remote-active-name">
          {device.name}
        </div>
        {/* Power toggle with iOS-style behavior */}
        <button className="pwr-btn" onClick={() => onCommand('power_toggle')}>
          <Power size={22} />
        </button>
      </div>

      <div className="compact-ios-remote">
        {/* Metadata and Artwork header */}
        <NowPlaying metadata={nowPlaying} />

        {/* Directional navigation area */}
        <Touchpad onCommand={onCommand} />

        <div className="remote-lower-grid">
          <div className="remote-col">
            <button className="btn-round glass" onClick={() => onCommand('menu')}>
              <span className="label-text">BACK</span>
            </button>
            <button className="btn-round glass" onClick={() => onCommand('play_pause')}>
              <div className="icons-stack">
                <Play size={18} fill="currentColor" />
                <Pause size={18} fill="currentColor" />
              </div>
            </button>
          </div>
          <div className="remote-col">
            <button className="btn-round glass" onClick={() => onCommand('home')}>
              <Tv size={24} />
            </button>
            {/* Volume control pill */}
            <div className="vol-pill">
              <button className="vol-half" onClick={() => onCommand('volume_up')}>
                <Plus size={20} />
              </button>
              <button className="vol-half" onClick={() => onCommand('volume_down')}>
                <Minus size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppleTVRemote;