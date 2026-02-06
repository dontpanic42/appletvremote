import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Circle } from 'lucide-react';

/**
 * Touchpad Component
 * 
 * Provides a circular navigation interface with directional buttons and 
 * a central selection button.
 * 
 * @param {Function} props.onCommand - Callback function to send a command to the backend.
 */
const Touchpad = ({ onCommand }) => {
  return (
    <div className="touchpad-area-modern">
      <div className="touchpad-grid">
        {/* Navigation buttons mapped to Apple TV direction commands */}
        <button className="nav-tap up" onClick={() => onCommand('up')}>
          <ChevronUp size={40} />
        </button>
        <button className="nav-tap left" onClick={() => onCommand('left')}>
          <ChevronLeft size={40} />
        </button>
        <button className="nav-tap center" onClick={() => onCommand('select')}>
          <Circle size={24} fill="currentColor" />
        </button>
        <button className="nav-tap right" onClick={() => onCommand('right')}>
          <ChevronRight size={40} />
        </button>
        <button className="nav-tap down" onClick={() => onCommand('down')}>
          <ChevronDown size={40} />
        </button>
      </div>
    </div>
  );
};

export default Touchpad;