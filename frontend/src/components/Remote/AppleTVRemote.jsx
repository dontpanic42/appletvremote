import React, { useState } from 'react';
import { Power, ArrowLeft, Menu as MenuIcon, Play, Pause, Plus, Minus, Tv, LayoutGrid } from 'lucide-react';
import NowPlaying from './NowPlaying';
import Touchpad from './Touchpad';
import AppDrawer from './AppDrawer';

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
  onDisconnect, 
  onOpenSidebar,
  onLaunchApp,
  onToggleFavorite,
  onRefreshApps
}) => {
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);

  return (
    <div className="remote-viewer-wrapper">
      {/* Background artwork sits in the non-scrolling wrapper */}
      {nowPlaying?.artwork && (
        <div 
          className="artwork-background" 
          style={{ backgroundImage: `url(${nowPlaying.artwork})` }}
        ></div>
      )}
      
      {/* Scrollable content container */}
      <div className="remote-scroll-viewport">
        <div className="remote-layout-horizontal">
            {/* Main Remote Core */}
            <div className="remote-main-column">
                <div className="remote-top-bar">
                    <button className="mobile-menu-btn" onClick={onOpenSidebar}>
                        <MenuIcon size={24} />
                    </button>
                    <button className="close-remote-btn desktop-only" onClick={onDisconnect}>
                        <ArrowLeft size={20} /> <span>Back</span>
                    </button>
                    <div className="remote-active-name">
                        {device.name}
                    </div>
                    <div className="remote-header-actions">
                        <button className="icon-btn-minimal" onClick={() => setIsAppDrawerOpen(true)} title="Applications">
                            <LayoutGrid size={22} />
                        </button>
                        <button className="pwr-btn" onClick={() => onCommand('power_toggle')} title="Power Toggle">
                            <Power size={22} />
                        </button>
                    </div>
                </div>

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

            {/* Favorite Apps Sidebar (Vertical) */}
            {apps.favorites.length > 0 && (
                <div className="remote-favorites-sidebar desktop-only">
                    <div className="fav-sidebar-list">
                        {apps.favorites.map(app => (
                            <button 
                                key={app.bundle_id} 
                                className="fav-sidebar-item" 
                                onClick={() => onLaunchApp(app.bundle_id)}
                                title={app.name}
                            >
                                <div className="fav-app-icon">
                                    {app.icon_url ? (
                                        <img src={app.icon_url} alt={app.name} className="icon-img" />
                                    ) : (
                                        app.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="fav-app-name">{app.name}</span>
                            </button>
                        ))}
                        <button className="fav-sidebar-item more" onClick={() => setIsAppDrawerOpen(true)}>
                            <div className="fav-app-icon">
                                <LayoutGrid size={18} />
                            </div>
                            <span className="fav-app-name">More</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

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