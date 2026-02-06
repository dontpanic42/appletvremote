import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Generates the correct WebSocket URL based on the current environment.
 * Uses localhost:8000 for development and the current host for production.
 */
const getWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  // Vite dev server typically runs on 5173, while backend is on 8000
  return window.location.port === '5173'
    ? `${protocol}//localhost:8000/ws` 
    : `${protocol}//${host}/ws`;
};

const WS_URL = getWsUrl();
const RECONNECT_DELAY = 3000;

/**
 * useAppleTV Hook
 * 
 * Custom hook that encapsulates all logic for Apple TV interaction:
 * - WebSocket lifecycle and auto-reconnection.
 * - Device discovery and pairing state.
 * - Application management (launching, favorites).
 * - Now Playing metadata updates.
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

  // Keep refs in sync with state to prevent stale closures in the WebSocket loop
  useEffect(() => {
    discoveryResultsRef.current = discoveryResults;
  }, [discoveryResults]);

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  /**
   * Initializes the WebSocket connection and defines event handlers.
   */
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    console.log('Connecting to WebSocket:', WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsScanning(true);
      // Hydrate state from backend
      ws.send(JSON.stringify({ command: 'get_paired' }));
      ws.send(JSON.stringify({ command: 'discover' }));
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'discovery_results':
          setDiscoveryResults(data.devices);
          setIsInitialLoad(false);
          setIsScanning(false);
          // If current device goes offline, kick back to selection
          const active = connectedDeviceRef.current;
          if (active && !data.devices.find(d => d.device_id === active.device_id)?.online) {
            setConnectedDevice(null);
            setNowPlaying(null);
          }
          break;

        case 'status':
          if (data.message.startsWith('Connected to')) {
            const name = data.message.split('Connected to ')[1];
            const device = discoveryResultsRef.current.find(d => d.name === name);
            if (device) {
              setConnectedDevice(device);
              ws.send(JSON.stringify({ command: 'get_apps', device_id: device.device_id }));
            }
            setConnectingAddress(null);
          } else if (data.message === 'Disconnected from Apple TV.') {
            setConnectedDevice(null);
            setNowPlaying(null);
          }
          break;

        case 'now_playing':
          setNowPlaying(data);
          break;

        case 'app_list':
          setApps({ all_apps: data.all_apps, favorites: data.favorites });
          break;

        case 'pairing_status':
          if (data.status === 'started') {
            setIsPairing(false);
            setPairingPin('');
            setPairingError(null);
            setPairingMessage(data.message);
          } else if (data.status === 'completed') {
            setIsPairing(false);
            setPairingDeviceAddress(null);
            setPairingPin('');
            if (data.address) {
              setDiscoveryResults(prev => prev.map(d => 
                d.address === data.address ? { ...d, paired: true } : d
              ));
            }
          } else if (data.status === 'failed') {
            setIsPairing(false);
            setPairingError(data.message);
          }
          break;

        case 'error':
          setConnectingAddress(null);
          setIsScanning(false);
          if (isPairing) {
            setIsPairing(false);
            setPairingError(data.message);
          }
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setConnectedDevice(null);
      setDiscoveryResults([]);
      setIsScanning(false);
      setNowPlaying(null);
      setApps({ all_apps: [], favorites: [] });
      // Queue reconnection
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  /**
   * Dispatches a command to the backend.
   */
  const sendMessage = (message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleConnect = (address) => {
    setConnectingAddress(address);
    sendMessage({ command: 'connect', address });
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
    sendMessage({ command: 'pair_start', address, protocol });
  };

  const handleSubmitPin = () => {
    if (pairingDeviceAddress && pairingPin) {
      setIsPairing(true);
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
      sendMessage({ command: 'delete_device', device_id });
    }
  };

  const handleRescan = () => {
    setIsScanning(true);
    sendMessage({ command: 'discover' });
  };

  const sendRemoteCommand = (cmd) => {
    if (connectedDevice) sendMessage({ command: cmd });
  };

  const launchApp = (bundle_id) => {
    sendMessage({ command: 'launch_app', bundle_id });
  };

  const toggleFavorite = (bundle_id, name, is_favorite, icon_url = null) => {
    sendMessage({ 
      command: 'toggle_favorite', 
      bundle_id, name, is_favorite, icon_url,
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
    isConnected, isScanning, discoveryResults, isInitialLoad,
    connectedDevice, connectingAddress, pairingDeviceAddress,
    pairingPin, setPairingPin, isPairing, pairingError,
    pairingMessage, nowPlaying, apps,
    handleConnect, handleDisconnect, handleStartPairing,
    handleSubmitPin, handleCancelPairing, handleDeleteDevice,
    handleRescan, sendRemoteCommand, launchApp, toggleFavorite, refreshApps
  };
};