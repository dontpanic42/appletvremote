import React, { useState, useEffect } from 'react';
import { useAppleTV } from './hooks/useAppleTV';
import Sidebar from './components/Sidebar/Sidebar';
import AppleTVRemote from './components/Remote/AppleTVRemote';
import { Smartphone, Menu as MenuIcon } from 'lucide-react';
import './App.css';

/**
 * App Component
 * 
 * Top-level component responsible for layout orchestration and cross-component logic.
 * Manages sidebar visibility (especially for mobile) and section expansion.
 */
function App() {
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
    refreshApps
  } = useAppleTV();

  const [expandedSection, setExpandedSection] = useState('paired');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const pairedDevices = discoveryResults.filter(d => d.paired);
  const unpairedDevices = discoveryResults.filter(d => !d.paired);

  // Sync expanded section with data
  useEffect(() => {
    if (!isInitialLoad) {
      if (pairedDevices.length > 0 && expandedSection === null) {
        setExpandedSection('paired');
      } else if (pairedDevices.length === 0 && unpairedDevices.length > 0 && expandedSection === null) {
        setExpandedSection('new');
      }
    }
  }, [isInitialLoad, pairedDevices.length]);

  // Sidebar is permanently open when NO device is connected
  const effectiveSidebarOpen = !connectedDevice || isSidebarOpen;

  const handleToggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className={`App sidebar-layout ${connectedDevice ? 'connected' : 'disconnected'} ${effectiveSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Overlay for desktop/mobile when in "overlay" mode (connected) */}
      {connectedDevice && isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      
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
        onConnect={(addr) => {
            handleConnect(addr);
            setIsSidebarOpen(false);
        }}
        onDisconnect={handleDisconnect}
        onStartPairing={handleStartPairing}
        onSubmitPin={handleSubmitPin}
        onCancelPairing={handleCancelPairing}
        onDeleteDevice={handleDeleteDevice}
        onRescan={handleRescan}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <main className="main-viewer">
        {connectedDevice ? (
          <AppleTVRemote
            device={connectedDevice}
            nowPlaying={nowPlaying}
            apps={apps}
            onCommand={sendRemoteCommand}
            onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
            onLaunchApp={launchApp}
            onToggleFavorite={toggleFavorite}
            onRefreshApps={refreshApps}
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