import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PairingForm Component
 * 
 * Displays the PIN entry input and action buttons during the pairing process.
 * Also handles the loading state while the backend is verifying the PIN.
 * 
 * @param {string} props.pin - The current PIN value.
 * @param {Function} props.onPinChange - Function to update the PIN state.
 * @param {Function} props.onSubmit - Function to submit the pairing request.
 * @param {Function} props.onCancel - Function to abort the pairing process.
 * @param {boolean} props.isPairing - Loading flag for active pairing.
 * @param {string} props.error - Error message from failed pairing.
 * @param {string} props.message - Instruction message (e.g. "Enter PIN for MRP").
 */
const PairingForm = ({ 
  pin, 
  onPinChange, 
  onSubmit, 
  onCancel, 
  isPairing, 
  error, 
  message 
}) => {
  return (
    <div className="sidebar-pairing-form">
      {isPairing ? (
        <div className="pairing-loading">
          <RefreshCw size={24} className="spin" />
          <p>Pairing...</p>
        </div>
      ) : (
        <>
          <p className="pairing-step-msg">{message}</p>
          <input 
            type="text" 
            value={pin} 
            maxLength={4}
            onChange={(e) => onPinChange(e.target.value)} 
            placeholder="PIN" 
            autoFocus
          />
          {error && <p className="pairing-error-text">{error}</p>}
          <div className="pairing-btns">
            <button className="ok-btn" onClick={onSubmit} disabled={!pin}>Pair</button>
            <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
};

export default PairingForm;