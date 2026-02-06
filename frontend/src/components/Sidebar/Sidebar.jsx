import React from 'react';
import { Smartphone, RefreshCw, X } from 'lucide-react';
import SidebarSection from './SidebarSection';
import DeviceItem from './DeviceItem';
import PairingForm from './PairingForm';

/**
 * Sidebar Component
 * 
 * Manages the layout of device lists and pairing flows in the left-hand panel.
 * 
 * @param {Array} props.pairedDevices - List of already paired devices.
 * @param {Array} props.unpairedDevices - List of new devices discovered on the network.
 * @param {Object} props.connectedDevice - The device currently being controlled.
 * @param {string} props.connectingAddress - IP of device currently connecting.
 * @param {string} props.pairingDeviceAddress - IP of device currently being paired.
 * @param {string} props.pairingPin - Current PIN input value.
 * @param {Function} props.setPairingPin - Updates the PIN state.
 * @param {boolean} props.isPairing - Loading flag for pairing.
 * @param {string} props.pairingError - Error from failed pairing.
 * @param {string} props.pairingMessage - Instruction for current pairing step.
 * @param {boolean} props.isScanning - Loading flag for active scan.
 * @param {boolean} props.isInitialLoad - Flag for the first-time loading state.
 * @param {boolean} props.isConnected - Backend WebSocket connection status.
 * @param {string} props.expandedSection - Which accordion is open ('paired' or 'new').
 * @param {Function} props.onToggleSection - Toggles accordion state.
 * @param {Function} props.onConnect - Initiates device connection.
 * @param {Function} props.onStartPairing - Starts pairing flow.
 * @param {Function} props.onSubmitPin - Submits the pairing PIN.
 * @param {Function} props.onCancelPairing - Aborts pairing.
 * @param {Function} props.onDeleteDevice - Deletes saved credentials.
 * @param {Function} props.onRescan - Triggers a new network scan.
 * @param {Function} props.onCloseMobile - Closes the sidebar on mobile devices.
 */
const Sidebar = ({
  pairedDevices,
  unpairedDevices,
  connectedDevice,
  connectingAddress,
  pairingDeviceAddress,
  pairingPin,
  setPairingPin,
  isPairing,
  pairingError,
  pairingMessage,
  isScanning,
  isInitialLoad,
  isConnected,
  expandedSection,
  onToggleSection,
  onConnect,
  onStartPairing,
  onSubmitPin,
  onCancelPairing,
  onDeleteDevice,
  onRescan,
  onCloseMobile
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Smartphone size={28} color="#007aff" />
        <h2>Remote</h2>
        {/* Close button shown only when a device is being controlled and sidebar is in overlay mode */}
        {connectedDevice && (
          <button className="sidebar-close-btn" onClick={onCloseMobile}>
            <X size={24} />
          </button>
        )}
      </div>

      <div className="sidebar-scroll-area">
        {/* Paired Devices Section */}
        <SidebarSection
          title="My Devices"
          count={pairedDevices.length}
          isExpanded={expandedSection === 'paired'}
          onToggle={() => onToggleSection('paired')}
          onRefresh={onRescan}
          isScanning={isScanning}
        >
          <div className="sidebar-device-list">
            {pairedDevices.length > 0 ? pairedDevices.map(device => (
              <React.Fragment key={device.device_id}>
                <DeviceItem
                  device={device}
                  isActive={connectedDevice?.device_id === device.device_id}
                  isConnecting={connectingAddress === device.address}
                  onConnect={onConnect}
                  onDelete={onDeleteDevice}
                  onPairMetadata={onStartPairing}
                />
                {/* Inline pairing form for existing devices (missing metadata) */}
                {device.address === pairingDeviceAddress && (
                  <PairingForm
                    pin={pairingPin}
                    onPinChange={setPairingPin}
                    onSubmit={onSubmitPin}
                    onCancel={onCancelPairing}
                    isPairing={isPairing}
                    error={pairingError}
                    message={pairingMessage}
                  />
                )}
              </React.Fragment>
            )) : (
              <div className="sidebar-empty-state">
                <p>{isInitialLoad ? 'Searching...' : 'No devices paired'}</p>
              </div>
            )}
          </div>
        </SidebarSection>

        {/* New Devices Section */}
        <SidebarSection
          title="New Devices"
          count={unpairedDevices.length}
          isExpanded={expandedSection === 'new'}
          onToggle={() => onToggleSection('new')}
        >
          <div className="sidebar-device-list">
            {unpairedDevices.length > 0 ? unpairedDevices.map(device => (
              <React.Fragment key={device.address}>
                <div key={device.address} className="sidebar-device-item new">
                  <div className="item-info">
                    <span className="device-name">{device.name}</span>
                    {device.address !== pairingDeviceAddress && (
                      <button className="pair-link" onClick={() => onStartPairing(device.address)}>
                        Pair Now
                      </button>
                    )}
                  </div>
                </div>
                {/* Inline pairing form for new devices */}
                {device.address === pairingDeviceAddress && (
                  <PairingForm
                    pin={pairingPin}
                    onPinChange={setPairingPin}
                    onSubmit={onSubmitPin}
                    onCancel={onCancelPairing}
                    isPairing={isPairing}
                    error={pairingError}
                    message={pairingMessage}
                  />
                )}
              </React.Fragment>
            )) : (
              <div className="sidebar-empty-state">
                <p>No new devices found</p>
              </div>
            )}
          </div>
        </SidebarSection>
      </div>

      <div className="sidebar-footer">
        {/* Main action button for discovery */}
        <button 
          className={`rescan-btn ${isScanning ? 'scanning' : ''}`} 
          onClick={onRescan}
          disabled={!isConnected || isScanning}
        >
          <RefreshCw size={16} className={isScanning ? 'spin' : ''} />
          <span>{isScanning ? 'Scanning...' : 'Rescan Network'}</span>
        </button>
        
        <div className="backend-status">
          <span className={`status-dot-footer ${isConnected ? 'online' : 'offline'}`}></span>
          {isConnected ? 'System Ready' : 'Connecting...'}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
