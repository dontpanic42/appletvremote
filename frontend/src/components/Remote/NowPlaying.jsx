import React from 'react';
import { Music } from 'lucide-react';
import ScrollingText from '../Shared/ScrollingText';

/**
 * NowPlaying Component
 * 
 * Displays the current media metadata including artwork, title, and artist.
 * Utilizes ScrollingText for long titles and artists.
 * 
 * @param {Object} props.metadata - The now playing information from the backend.
 */
const NowPlaying = ({ metadata }) => {
  return (
    <div className="now-playing-section">
      <div className="artwork-container">
        {metadata?.artwork ? (
          <img src={metadata.artwork} alt="Artwork" className="artwork-img" />
        ) : (
          <div className="artwork-placeholder">
            <Music size={32} color="#444" />
          </div>
        )}
      </div>
      <div className="metadata-container">
        {/* Render scrolling track title */}
        <ScrollingText text={metadata?.title || 'Not Playing'} className="track-title" />
        {/* Render scrolling artist or album name as fallback */}
        <ScrollingText text={metadata?.artist || metadata?.album || 'Apple TV'} className="track-artist" />
      </div>
    </div>
  );
};

export default NowPlaying;