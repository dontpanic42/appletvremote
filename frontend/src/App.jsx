import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  Power, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Plus, 
  Minus, 
  RefreshCw, 
  ArrowLeft, 
  Trash2,
  Circle,
  Smartphone,
  ChevronRight as ChevronRightIcon,
  Search
} from 'lucide-react';
import './App.css';

const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectingAddress, setConnectingAddress] = useState(null);
  const [pairingDeviceAddress, setPairingDeviceAddress] = useState(null);
  const [pairingPin, setPairingPin] = useState('');
  const [isPairing, setIsPairing] = useState(false); // New state for pairing loading
  const [pairingError, setPairingError] = useState(null); // New state for pairing errors
  const [expandedSection, setExpandedSection] = useState('paired'); // 'paired' or 'new'

  const discoveryResultsRef = useRef([]);

  const pairedDevices = discoveryResults.filter(d => d.paired);
  const unpairedDevices = discoveryResults.filter(d => !d.paired);

  // Automatically switch expanded section based on data availability
  useEffect(() => {
    if (!isInitialLoad) {
        if (pairedDevices.length > 0 && expandedSection === null) {
            setExpandedSection('paired');
        } else if (pairedDevices.length === 0 && unpairedDevices.length > 0 && expandedSection === null) {
            setExpandedSection('new');
        }
    }
  }, [isInitialLoad, pairedDevices.length]);

  useEffect(() => {
    discoveryResultsRef.current = discoveryResults;
  }, [discoveryResults]);

  useEffect(() => {
    const newWs = new WebSocket(WS_URL);

    newWs.onopen = () => {
      setWs(newWs);
      setIsConnected(true);
      setIsScanning(true);
      newWs.send(JSON.stringify({ command: 'get_paired' }));
      newWs.send(JSON.stringify({ command: 'discover' }));
    };

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'discovery_results') {
        setDiscoveryResults(data.devices);
        setIsInitialLoad(false);
        setIsScanning(false);
        
        if (connectedDevice) {
            const current = data.devices.find(d => d.device_id === connectedDevice.device_id);
            if (current && !current.online) {
                setConnectedDevice(null);
            }
        }
      } else if (data.type === 'status') {
        if (data.message.startsWith('Connected to')) {
            const deviceName = data.message.split('Connected to ')[1];
            const device = discoveryResultsRef.current.find(d => d.name === deviceName);
            if (device) setConnectedDevice(device);
            setConnectingAddress(null);
        } else if (data.message === 'Disconnected from Apple TV.') {
            setConnectedDevice(null);
        }
      } else if (data.type === 'error') {
          setConnectingAddress(null);
          setIsScanning(false);
          if (isPairing) {
              setIsPairing(false);
              setPairingError(data.message);
          }
      } else if (data.type === 'pairing_status') {
          if (data.status === 'completed') {
              setIsPairing(false);
              setPairingDeviceAddress(null);
              setPairingPin('');
              setPairingError(null);
          } else if (data.status === 'failed') {
              setIsPairing(false);
              setPairingError(data.message);
          }
      }
    };

    newWs.onclose = () => {
      setIsConnected(false);
      setConnectedDevice(null);
      setDiscoveryResults([]);
      setIsScanning(false);
    };

    return () => newWs.close();
  }, []);

  const sendMessage = (message) => {
    if (ws && isConnected) ws.send(JSON.stringify(message));
  };

  const handleConnect = (address) => {
    setConnectingAddress(address);
    sendMessage({ command: 'connect', address: address });
  };

  const handleDisconnect = () => {
    sendMessage({ command: 'disconnect' });
    setConnectedDevice(null);
  };

  const handleStartPairing = (address) => {
    setPairingDeviceAddress(address);
    setPairingError(null);
    setIsPairing(false);
    sendMessage({ command: 'pair_start', address: address });
  };

  const handleSubmitPin = () => {
    if (pairingDeviceAddress && pairingPin) {
      setIsPairing(true);
      setPairingError(null);
      sendMessage({ command: 'pair_pin', pin: pairingPin });
    }
  };

  const handleDeleteDevice = (device_id) => {
    if (window.confirm('Delete these credentials?')) {
        // If we are currently controlling this device, disconnect first
        if (connectedDevice?.device_id === device_id) {
            setConnectedDevice(null);
        }
        // Optimistically remove from UI immediately
        setDiscoveryResults(prev => prev.filter(d => d.device_id !== device_id));
        sendMessage({ command: 'delete_device', device_id: device_id });
    }
  }

  const handleRescan = () => {
    setIsScanning(true);
    setExpandedSection('new');
    sendMessage({ command: 'discover' });
  };

  const sendRemoteCommand = (commandType) => {
    if (connectedDevice) sendMessage({ command: commandType });
  };

  return (
    <div className="App sidebar-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Smartphone size={28} color="#007aff" />
          <h2>Remote</h2>
        </div>

        <div className="sidebar-scroll-area">
          <section className={`sidebar-section accordion ${expandedSection === 'paired' ? 'expanded' : ''}`}>
            <div className="section-title" onClick={() => setExpandedSection(expandedSection === 'paired' ? null : 'paired')}>
              <div className="title-left">
                <ChevronRightIcon size={16} className="accordion-chevron" />
                <h3>My Devices</h3>
              </div>
              <div className="title-right">
                <span className="count-badge">{pairedDevices.length}</span>
              </div>
            </div>
            
            <div className="sidebar-content">
                <div className="sidebar-device-list">
                {pairedDevices.length > 0 ? pairedDevices.map(device => (
                    <div 
                    key={device.device_id} 
                    className={`sidebar-device-item ${device.online ? 'online' : 'offline'} ${connectedDevice?.device_id === device.device_id ? 'active' : ''}`}
                    onClick={() => device.online && handleConnect(device.address)}
                    >
                    <div className={`device-status-dot ${connectingAddress === device.address || device.online === null ? 'loading' : (device.online ? 'online' : 'offline')}`}></div>
                    <div className="item-info">
                        <span className="device-name">{device.name}</span>
                        <span className="device-addr">{device.address}</span>
                    </div>
                    <button className="delete-mini" onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.device_id); }}>
                        <Trash2 size={14} />
                    </button>
                    </div>
                )) : (
                    <div className="sidebar-empty-state">
                        <p>{isInitialLoad ? 'Searching...' : 'No devices paired'}</p>
                    </div>
                )}
                </div>
            </div>
          </section>

          <section className={`sidebar-section accordion ${expandedSection === 'new' ? 'expanded' : ''}`}>
            <div className="section-title" onClick={() => setExpandedSection(expandedSection === 'new' ? null : 'new')}>
              <div className="title-left">
                <ChevronRightIcon size={16} className="accordion-chevron" />
                <h3>New Devices</h3>
              </div>
              <div className="title-right">
                <span className="count-badge">{unpairedDevices.length}</span>
              </div>
            </div>
            <div className="sidebar-content">
                <div className="sidebar-device-list">
                    {unpairedDevices.length > 0 ? unpairedDevices.map(device => (
                    <div key={device.address} className="sidebar-device-item new">
                        <div className="item-info">
                        <span className="device-name">{device.name}</span>
                        {device.address === pairingDeviceAddress ? (
                            <div className="sidebar-pairing-form">
                            {isPairing ? (
                                <div className="pairing-loading">
                                    <RefreshCw size={24} className="spin" />
                                    <p>Pairing with {device.name}...</p>
                                </div>
                            ) : (
                                <>
                                    <input 
                                        type="text" value={pairingPin} maxLength={4}
                                        onChange={(e) => setPairingPin(e.target.value)} 
                                        placeholder="PIN" autoFocus
                                        disabled={isPairing}
                                    />
                                    {pairingError && <p className="pairing-error-text">{pairingError}</p>}
                                    <div className="pairing-btns">
                                        <button className="ok-btn" onClick={handleSubmitPin} disabled={!pairingPin}>Pair</button>
                                        <button className="cancel-btn" onClick={() => { setPairingDeviceAddress(null); setPairingPin(''); setPairingError(null); }}>Cancel</button>
                                    </div>
                                </>
                            )}
                            </div>
                        ) : (
                            <button className="pair-link" onClick={() => handleStartPairing(device.address)}>Pair Now</button>
                        )}
                        </div>
                    </div>
                    )) : (
                        <div className="sidebar-empty-state">
                            <p>No new devices found</p>
                        </div>
                    )}
                </div>
            </div>
          </section>
        </div>

        <div className="sidebar-footer">
          <button 
            className={`rescan-btn ${isScanning ? 'scanning' : ''}`} 
            onClick={handleRescan}
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

      <main className="main-viewer">
        {connectedDevice ? (
          <div className="remote-center">
            <div className="remote-top-bar">
                <button className="close-remote-btn" onClick={handleDisconnect}>
                  <ArrowLeft size={20} /> <span>Back</span>
                </button>
                <div className="remote-active-name">
                    {connectedDevice.name}
                </div>
                <button className="pwr-btn" onClick={() => sendRemoteCommand('power_off')}>
                  <Power size={22} />
                </button>
            </div>

            <div className="compact-ios-remote">
                <div className="touchpad-area-modern">
                    <div className="touchpad-grid">
                        <button className="nav-tap up" onClick={() => sendRemoteCommand('up')}><ChevronUp size={40} /></button>
                        <button className="nav-tap left" onClick={() => sendRemoteCommand('left')}><ChevronLeft size={40} /></button>
                        <button className="nav-tap center" onClick={() => sendRemoteCommand('select')}><Circle size={24} fill="currentColor" /></button>
                        <button className="nav-tap right" onClick={() => sendRemoteCommand('right')}><ChevronRight size={40} /></button>
                        <button className="nav-tap down" onClick={() => sendRemoteCommand('down')}><ChevronDown size={40} /></button>
                    </div>
                </div>

                <div className="remote-lower-grid">
                    <div className="remote-col">
                        <button className="btn-round glass" onClick={() => sendRemoteCommand('menu')}>
                          <span className="label-text">BACK</span>
                        </button>
                        <button className="btn-round glass" onClick={() => sendRemoteCommand('play_pause')}>
                          <div className="icons-stack"><Play size={18} fill="currentColor" /><Pause size={18} fill="currentColor" /></div>
                        </button>
                    </div>
                    <div className="remote-col">
                        <button className="btn-round glass" onClick={() => sendRemoteCommand('home')}>
                          <Tv size={24} />
                        </button>
                        <div className="vol-pill">
                            <button className="vol-half" onClick={() => sendRemoteCommand('volume_up')}><Plus size={20} /></button>
                            <button className="vol-half" onClick={() => sendRemoteCommand('volume_down')}><Minus size={20} /></button>
                        </div>
                    </div>
                </div>
            </div>
          </div>
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
