import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws';
const RECONNECT_DELAY = 3000;

/**
 * useAppleTV Hook
 * 
 * Custom hook that encapsulates all logic for:
 * 1. Persistent WebSocket communication with the backend.
 * 2. Device discovery and state management.
 * 3. Chained pairing workflow orchestration.
 * 4. Automatic reconnection logic.
 * 5. Remote control command dispatching.
 */
export const useAppleTV = () => {
  const [ws, setWs] = useState(null);
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

  const discoveryResultsRef = useRef([]);
  const reconnectTimeoutRef = useRef(null);
  const connectedDeviceRef = useRef(null);

  // Sync refs with state to avoid stale closure issues in the WebSocket message loop
  useEffect(() => {
    discoveryResultsRef.current = discoveryResults;
  }, [discoveryResults]);

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  /**
   * Establishes the WebSocket connection and defines message handling logic.
   * Includes automatic reconnection on close.
   */
  const connectWebSocket = useCallback(() => {
    console.log('Connecting to WebSocket...');
    const newWs = new WebSocket(WS_URL);

    newWs.onopen = () => {
      console.log('WebSocket connection established');
      setWs(newWs);
      setIsConnected(true);
      setIsScanning(true);
      // Immediately fetch paired devices from DB and start a fresh network scan
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
        
        // If our current device goes offline, return to selection screen
        const activeDevice = connectedDeviceRef.current;
        if (activeDevice) {
            const current = data.devices.find(d => d.device_id === activeDevice.device_id);
            if (current && !current.online) {
                setConnectedDevice(null);
                setNowPlaying(null);
            }
        }
      } else if (data.type === 'status') {
        // Handle successful connection feedback
        if (data.message.startsWith('Connected to')) {
            const deviceName = data.message.split('Connected to ')[1];
            const device = discoveryResultsRef.current.find(d => d.name === deviceName);
            if (device) setConnectedDevice(device);
            setConnectingAddress(null);
        } else if (data.message === 'Disconnected from Apple TV.') {
            setConnectedDevice(null);
            setNowPlaying(null);
        }
      } else if (data.type === 'now_playing') {
          // Push update for metadata and artwork
          setNowPlaying(data);
      } else if (data.type === 'error') {
          setConnectingAddress(null);
          setIsScanning(false);
          if (isPairing) {
              setIsPairing(false);
              setPairingError(data.message);
          }
      } else if (data.type === 'pairing_status') {
          // Chained pairing logic
          if (data.status === 'started') {
              setIsPairing(false); 
              setPairingPin(''); // Reset for next potential protocol step
              setPairingError(null);
              setPairingMessage(data.message);
          } else if (data.status === 'completed') {
              setIsPairing(false);
              setPairingDeviceAddress(null);
              setPairingPin('');
              setPairingError(null);
              // Optimistically update device list before re-scan
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
      
      // Auto-reconnect after delay
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
    };

    newWs.onerror = (error) => {
      console.error('WebSocket error:', error);
      newWs.close();
    };
  }, []); // Logic remains stable regardless of device state

  // Initial connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  /**
   * Helper to send JSON messages over WebSocket.
   */
  const sendMessage = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  /**
   * Request backend to connect to a specific IP address.
   */
  const handleConnect = (address) => {
    setConnectingAddress(address);
    sendMessage({ command: 'connect', address: address });
  };

  /**
   * Request backend to terminate current device session.
   */
  const handleDisconnect = () => {
    sendMessage({ command: 'disconnect' });
    setConnectedDevice(null);
  };

  /**
   * Initiate the pairing flow for a device and/or protocol.
   */
  const handleStartPairing = (address, protocol = null) => {
    setPairingDeviceAddress(address);
    setPairingError(null);
    setIsPairing(false);
    setPairingMessage('Starting...');
    sendMessage({ command: 'pair_start', address: address, protocol: protocol });
  };

  /**
   * Submit the entered PIN code to the backend.
   */
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

  /**
   * Request deletion of device credentials from backend database.
   */
  const handleDeleteDevice = (device_id) => {
    if (window.confirm('Delete these credentials?')) {
        if (connectedDevice?.device_id === device_id) {
            setConnectedDevice(null);
            setNowPlaying(null);
        }
        // Optimistic UI update
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
    handleConnect,
    handleDisconnect,
    handleStartPairing,
    handleSubmitPin,
    handleCancelPairing,
    handleDeleteDevice,
    handleRescan,
    sendRemoteCommand
  };
};