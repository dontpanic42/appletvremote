import React from 'react';
import { Trash2, Activity } from 'lucide-react';

/**
 * DeviceItem Component
 * 
 * Represents a single Apple TV entry in the sidebar list.
 * Handles connection initiation and deletion.
 * 
 * @param {Object} props.device - Device information from discovery.
 * @param {boolean} props.isActive - Whether this device is currently being controlled.
 * @param {boolean} props.isConnecting - Whether a connection is currently being established.
 * @param {Function} props.onConnect - Callback to initiate connection.
 * @param {Function} props.onDelete - Callback to delete device credentials.
 * @param {Function} props.onPairMetadata - Callback to start pairing for metadata services.
 */
const DeviceItem = ({ 
  device, 
  isActive, 
  isConnecting, 
  onConnect, 
  onDelete, 
  onPairMetadata 
}) => {
  // Determine color and animation of the status indicator
  const statusClass = isConnecting || device.online === null ? 'loading' : (device.online ? 'online' : 'offline');

  return (
    <div className={`sidebar-device-item-container ${isActive ? 'active' : ''}`}>
      <div 
        className={`sidebar-device-item ${device.online ? 'online' : 'offline'}`}
        onClick={() => (device.online || device.paired) && onConnect(device.address)}
      >
        <div className={`device-status-dot ${statusClass}`}></div>
        <div className="item-info">
          <span className="device-name">{device.name}</span>
          {/* Display tags for each paired protocol (e.g. Companion, MRP) */}
          {device.paired_protocols && device.paired_protocols.length > 0 && (
            <div className="protocol-tags">
              {device.paired_protocols.map(p => (
                <span key={p} className="proto-tag">{p}</span>
              ))}
            </div>
          )}
        </div>
        <button className="delete-mini" onClick={(e) => { e.stopPropagation(); onDelete(device.device_id); }}>
          <Trash2 size={14} />
        </button>
      </div>
      
      {/* Alert shown if device is paired but missing metadata-specific protocols */}
      {device.online && device.unpaired_services?.length > 0 && (
        <div className="unpaired-notice">
          <Activity size={12} />
          <span>Missing Metadata</span>
          <button className="pair-link small" onClick={() => onPairMetadata(device.address, device.unpaired_services[0])}>
            Pair Now
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceItem;