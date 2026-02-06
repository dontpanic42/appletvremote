import React from 'react';
import { LayoutGrid } from 'lucide-react';

/**
 * FavoritesSidebar Component
 * 
 * A vertical sidebar containing favorite applications for quick launching.
 * 
 * @param {Array} props.favorites - List of favorite apps.
 * @param {Function} props.onLaunchApp - Callback to launch an app.
 * @param {Function} props.onOpenDrawer - Callback to open the full app drawer.
 */
const FavoritesSidebar = ({ favorites, onLaunchApp, onOpenDrawer }) => {
  if (favorites.length === 0) return null;

  return (
    <div className="remote-favorites-sidebar desktop-only">
      <div className="fav-sidebar-list">
        {favorites.map(app => (
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
        
        {/* "More" button to trigger the full app drawer */}
        <button className="fav-sidebar-item more" onClick={onOpenDrawer}>
          <div className="fav-app-icon">
            <LayoutGrid size={18} />
          </div>
          <span className="fav-app-name">More</span>
        </button>
      </div>
    </div>
  );
};

export default FavoritesSidebar;
