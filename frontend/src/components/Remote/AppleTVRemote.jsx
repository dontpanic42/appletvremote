import React, { useState } from 'react';
import { Play, Pause, Plus, Minus, Tv } from 'lucide-react';
import NowPlaying from './NowPlaying';
import Touchpad from './Touchpad';
import AppDrawer from './AppDrawer';
import FavoritesSidebar from './FavoritesSidebar';
import RemoteHeader from './RemoteHeader';

/**
 * AppleTVRemote Component
 * 
 * The main container for the iOS-style remote control interface.
 */
const AppleTVRemote = ({ 
  device, 
  nowPlaying, 
  apps,
  onCommand, 
  onToggleSidebar,
  onLaunchApp,
  onToggleFavorite,
  onRefreshApps
}) => {
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);

  return (
    <div className="remote-viewer-wrapper">
      {/* Background artwork sitting firmly behind the scrolling content */}
      {nowPlaying?.artwork && (
        <div 
          className="artwork-background" 
          style={{ backgroundImage: `url(${nowPlaying.artwork})` }}
        ></div>
      )}
      
      {/* Scrollable content area */}
      <div className="remote-scroll-viewport">
        <div className="remote-layout-horizontal">
            {/* Main Remote Body */}
            <div className="remote-main-column">
                <RemoteHeader 
                    deviceName={device.name}
                    onToggleSidebar={onToggleSidebar}
                    onOpenDrawer={() => setIsAppDrawerOpen(true)}
                    onPowerToggle={() => onCommand('power_toggle')}
                />

                <div className="compact-ios-remote">
                    <NowPlaying metadata={nowPlaying} />

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

            {/* Favorite Apps Sidebar */}
            <FavoritesSidebar 
                favorites={apps.favorites}
                onLaunchApp={onLaunchApp}
                onOpenDrawer={() => setIsAppDrawerOpen(true)}
            />
        </div>
      </div>

      {/* Applications Drawer Panel */}
      <AppDrawer 
        isOpen={isAppDrawerOpen}
        onClose={() => setIsAppDrawerOpen(false)}
        apps={apps}
        onLaunch={(bid) => {
            onLaunchApp(bid);
            setIsAppDrawerOpen(false);
        }}
        onToggleFavorite={onToggleFavorite}
        onRefresh={onRefreshApps}
      />
    </div>
  );
};

export default AppleTVRemote;