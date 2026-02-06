import React, { useState, useEffect } from 'react';
import { useAppleTV } from './hooks/useAppleTV';
import Sidebar from './components/Sidebar/Sidebar';
import AppleTVRemote from './components/Remote/AppleTVRemote';
import { Smartphone } from 'lucide-react';
import './App.css';

/**
 * App Component
 * 
 * Top-level component responsible for layout orchestration and cross-component logic.
 * Manages sidebar visibility (especially for mobile) and section expansion.
 */
function App() {
  // Extract state and handlers from our custom domain hook
  const {
    isConnected,
    isScanning,
    discoveryResults,
    isInitialLoad,
    connectedDevice,
    connectingAddress,
    pairingDeviceAddress,
    pairingPin,
    setPairingPin,
    isPairing,
    pairingError,
    pairingMessage,
    nowPlaying,
    apps,
    settings,
    handleConnect,
    handleDisconnect,
    handleStartPairing,
    handleSubmitPin,
    handleCancelPairing,
    handleDeleteDevice,
    handleRescan,
    sendRemoteCommand,
    launchApp,
    toggleFavorite,
    updateSetting
  } = useAppleTV();

  const [expandedSection, setExpandedSection] = useState('paired');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Group devices for cleaner rendering
  const pairedDevices = discoveryResults.filter(d => d.paired);
  const unpairedDevices = discoveryResults.filter(d => !d.paired);

  /**
   * Effect: Sync expanded section with data availability.
   * Auto-expands "My Devices" if they exist, otherwise "New Devices".
   */
  useEffect(() => {
    if (!isInitialLoad) {
      if (pairedDevices.length > 0 && expandedSection === null) {
        setExpandedSection('paired');
      } else if (pairedDevices.length === 0 && unpairedDevices.length > 0 && expandedSection === null) {
        setExpandedSection('new');
      }
    }
  }, [isInitialLoad, pairedDevices.length]);

  /**
   * Effect: Mobile Sidebar Management.
   * Auto-closes the sidebar when a device connection is established.
   */
  useEffect(() => {
    if (connectedDevice) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [connectedDevice]);

  // Handler for toggling sidebar sections (accordions)
  const handleToggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  // Handler for manual refresh that also ensures the "New Devices" list is shown
  const onRescanClick = () => {
    handleRescan();
    setExpandedSection('new');
  };

  return (
    <div className={`App sidebar-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Semi-transparent overlay shown on mobile when sidebar is open over the remote */}
      {isSidebarOpen && connectedDevice && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      
      {/* Navigation and Discovery Panel */}
      <Sidebar
        pairedDevices={pairedDevices}
        unpairedDevices={unpairedDevices}
        connectedDevice={connectedDevice}
        connectingAddress={connectingAddress}
        pairingDeviceAddress={pairingDeviceAddress}
        pairingPin={pairingPin}
        setPairingPin={setPairingPin}
        isPairing={isPairing}
        pairingError={pairingError}
        pairingMessage={pairingMessage}
        isScanning={isScanning}
        isInitialLoad={isInitialLoad}
        isConnected={isConnected}
        expandedSection={expandedSection}
        onToggleSection={handleToggleSection}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onStartPairing={handleStartPairing}
        onSubmitPin={handleSubmitPin}
        onCancelPairing={handleCancelPairing}
        onDeleteDevice={handleDeleteDevice}
        onRescan={onRescanClick}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Main remote control viewer or empty state placeholder */}
      <main className="main-viewer">
        {connectedDevice ? (
          <AppleTVRemote
            device={connectedDevice}
            nowPlaying={nowPlaying}
            apps={apps}
            settings={settings}
            onCommand={sendRemoteCommand}
            onDisconnect={handleDisconnect}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            onLaunchApp={launchApp}
            onToggleFavorite={toggleFavorite}
            onUpdateSetting={updateSetting}
          />
        ) : (
          <div className="no-device-placeholder">
            <Smartphone size={64} opacity={0.2} />
            <h2>Select an Apple TV</h2>
            <p>Choose a paired device from the sidebar to begin controlling your media.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
