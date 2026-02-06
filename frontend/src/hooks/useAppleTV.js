import { useState, useEffect, useRef, useCallback } from 'react';

const getWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // If running in development (vite), we might need to specify the backend port
  // If running in production (served by FastAPI), host will already be correct
  return process.env.NODE_ENV === 'development' 
    ? `${protocol}//localhost:8000/ws` 
    : `${protocol}//${host}/ws`;
};

const WS_URL = getWsUrl();
const RECONNECT_DELAY = 3000;

/**
 * useAppleTV Hook
 * 
 * Manages the WebSocket connection and state for Apple TV interactions.
 */
export const useAppleTV = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectingAddress, setConnectingAddress] = useState(null);
  const [pairingDeviceAddress, setPairingDeviceAddress] = useState(null);
  const [pairingPin, setPairingPin] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingError, setPairingError] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [pairingMessage, setPairingMessage] = useState('Enter PIN');
  const [apps, setApps] = useState({ all_apps: [], favorites: [] });

  const wsRef = useRef(null);
  const discoveryResultsRef = useRef([]);
  const reconnectTimeoutRef = useRef(null);
  const connectedDeviceRef = useRef(null);

  // Sync refs with state
  useEffect(() => {
    discoveryResultsRef.current = discoveryResults;
  }, [discoveryResults]);

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    console.log('Connecting to WebSocket...');
    const newWs = new WebSocket(WS_URL);
    wsRef.current = newWs;

    newWs.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
      setIsScanning(true);
      newWs.send(JSON.stringify({ command: 'get_paired' }));
      newWs.send(JSON.stringify({ command: 'discover' }));
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'discovery_results') {
        setDiscoveryResults(data.devices);
        setIsInitialLoad(false);
        setIsScanning(false);
        
        const activeDevice = connectedDeviceRef.current;
        if (activeDevice) {
            const current = data.devices.find(d => d.device_id === activeDevice.device_id);
            if (current && !current.online) {
                setConnectedDevice(null);
                setNowPlaying(null);
            }
        }
      } else if (data.type === 'status') {
        if (data.message.startsWith('Connected to')) {
            const deviceName = data.message.split('Connected to ')[1];
            // Access discovery results via ref to get the most recent data
            const device = discoveryResultsRef.current.find(d => d.name === deviceName);
            if (device) {
                setConnectedDevice(device);
                // Fetch apps immediately upon successful connection, explicitly passing device_id
                newWs.send(JSON.stringify({ 
                    command: 'get_apps',
                    device_id: device.device_id 
                }));
            }
            setConnectingAddress(null);
        } else if (data.message === 'Disconnected from Apple TV.') {
            setConnectedDevice(null);
            setNowPlaying(null);
            setApps({ all_apps: [], favorites: [] });
        }
      } else if (data.type === 'now_playing') {
          setNowPlaying(data);
      } else if (data.type === 'app_list') {
          setApps({ all_apps: data.all_apps, favorites: data.favorites });
      } else if (data.type === 'error') {
          setConnectingAddress(null);
          setIsScanning(false);
          if (isPairing) {
              setIsPairing(false);
              setPairingError(data.message);
          }
      } else if (data.type === 'pairing_status') {
          if (data.status === 'started') {
              setIsPairing(false); 
              setPairingPin(''); 
              setPairingError(null);
              setPairingMessage(data.message);
          } else if (data.status === 'completed') {
              setIsPairing(false);
              setPairingDeviceAddress(null);
              setPairingPin('');
              setPairingError(null);
              if (data.address) {
                  setDiscoveryResults(prev => prev.map(d => 
                      d.address === data.address ? { ...d, paired: true } : d
                  ));
              }
          } else if (data.status === 'failed') {
              setIsPairing(false);
              setPairingError(data.message);
          }
      }
    };

    newWs.onclose = () => {
      console.log('WebSocket connection closed. Attempting to reconnect...');
      setIsConnected(false);
      setConnectedDevice(null);
      setDiscoveryResults([]);
      setIsScanning(false);
      setNowPlaying(null);
      setApps({ all_apps: [], favorites: [] });
      
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
    };

    newWs.onerror = (error) => {
      console.error('WebSocket error:', error);
      newWs.close();
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleConnect = (address) => {
    setConnectingAddress(address);
    sendMessage({ command: 'connect', address: address });
  };

  const handleDisconnect = () => {
    sendMessage({ command: 'disconnect' });
    setConnectedDevice(null);
  };

  const handleStartPairing = (address, protocol = null) => {
    setPairingDeviceAddress(address);
    setPairingError(null);
    setIsPairing(false);
    setPairingMessage('Starting...');
    sendMessage({ command: 'pair_start', address: address, protocol: protocol });
  };

  const handleSubmitPin = () => {
    if (pairingDeviceAddress && pairingPin) {
      setIsPairing(true);
      setPairingError(null);
      sendMessage({ command: 'pair_pin', pin: pairingPin });
    }
  };

  const handleCancelPairing = () => {
    setPairingDeviceAddress(null);
    setPairingPin('');
    setPairingError(null);
  };

  const handleDeleteDevice = (device_id) => {
    if (window.confirm('Delete these credentials?')) {
        if (connectedDevice?.device_id === device_id) {
            setConnectedDevice(null);
            setNowPlaying(null);
        }
        setDiscoveryResults(prev => prev.filter(d => d.device_id !== device_id));
        sendMessage({ command: 'delete_device', device_id: device_id });
    }
  };

  const handleRescan = () => {
    setIsScanning(true);
    sendMessage({ command: 'discover' });
  };

  const sendRemoteCommand = (commandType) => {
    if (connectedDevice) sendMessage({ command: commandType });
  };

  const launchApp = (bundleId) => {
    sendMessage({ command: 'launch_app', bundle_id: bundleId });
  };

  const toggleFavorite = (bundleId, name, isFavorite, iconUrl = null) => {
    sendMessage({ 
      command: 'toggle_favorite', 
      bundle_id: bundleId, 
      name: name, 
      is_favorite: isFavorite,
      icon_url: iconUrl,
      device_id: connectedDeviceRef.current?.device_id
    });
  };

  const refreshApps = () => {
    sendMessage({ 
        command: 'get_apps',
        device_id: connectedDeviceRef.current?.device_id 
    });
  };

  return {
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
  };
};
