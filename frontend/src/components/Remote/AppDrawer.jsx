import React, { useState } from 'react';
import { X, Star, Play, Search, LayoutGrid, RefreshCw } from 'lucide-react';

/**
 * AppDrawer Component
 * 
 * A sliding panel that allows users to view all launchable apps,
 * search through them, and manage a list of favorites for quick access.
 */
const AppDrawer = ({ 
  isOpen, 
  onClose, 
  apps, 
  onLaunch, 
  onToggleFavorite,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredApps = apps.all_apps.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className={`app-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="app-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="header-title">
            <LayoutGrid size={24} color="#007aff" />
            <h2>Applications</h2>
          </div>
          <div className="drawer-header-actions">
            <button className={`icon-btn-minimal ${isRefreshing ? 'spin' : ''}`} onClick={handleRefresh} title="Refresh App List">
              <RefreshCw size={20} />
            </button>
            <button className="icon-btn-minimal" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="drawer-search">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search apps..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="drawer-content">
          {/* Favorites Section */}
          {apps.favorites.length > 0 && !search && (
            <section className="drawer-section">
              <h3>Favorites</h3>
              <div className="app-grid">
                {apps.favorites.map(app => (
                  <div key={app.bundle_id} className="app-item favorite" onClick={() => onLaunch(app.bundle_id)}>
                    <div className="app-icon-mini">
                      {app.icon_url ? (
                        <img src={app.icon_url} alt={app.name} className="icon-img" />
                      ) : (
                        app.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="app-name">{app.name}</span>
                    <button 
                      className="fav-btn active" 
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(app.bundle_id, app.name, false); }}
                    >
                      <Star size={16} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All Apps Section */}
          <section className="drawer-section">
            <h3>{search ? 'Search Results' : 'All Apps'}</h3>
            <div className="app-list-vertical">
              {filteredApps.length > 0 ? filteredApps.map(app => (
                <div key={app.bundle_id} className="app-list-item" onClick={() => onLaunch(app.bundle_id)}>
                  <div className="app-icon-rect">
                    {app.icon_url ? (
                      <img src={app.icon_url} alt={app.name} className="icon-img" />
                    ) : (
                      app.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="app-info-main">
                    <span className="app-name-large">{app.name}</span>
                    <span className="app-id-small">{app.bundle_id}</span>
                  </div>
                  <div className="app-item-actions">
                    <button 
                      className={`fav-btn ${app.is_favorite ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(app.bundle_id, app.name, !app.is_favorite, app.icon_url); }}
                    >
                      <Star size={20} fill={app.is_favorite ? "currentColor" : "none"} />
                    </button>
                    <div className="launch-indicator">
                        <Play size={16} fill="currentColor" />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="drawer-empty">
                  {apps.all_apps.length === 0 ? (
                    <div className="empty-notice">
                        <p>No apps found.</p>
                        <p className="hint">Ensure MRP or Companion protocol is paired for app launching.</p>
                    </div>
                  ) : (
                    <p>No apps found matching "{search}"</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AppDrawer;
