import React, { useState, useEffect, useRef } from 'react';

/**
 * ScrollingText Component
 * 
 * Implements an iOS-style marquee effect. If the provided text is wider than its 
 * container, it will scroll horizontally after a brief delay.
 * 
 * @param {string} props.text - The text to display.
 * @param {string} props.className - Additional CSS classes for styling.
 */
const ScrollingText = ({ text, className }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [scrollDist, setScrollDist] = useState(0);

  // Measure text and container widths to determine if scrolling is necessary
  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;
      
      if (textWidth > containerWidth) {
        setShouldScroll(true);
        // Calculate total distance to scroll, adding buffer for smooth reset
        setScrollDist(textWidth - containerWidth);
      } else {
        setShouldScroll(false);
      }
    }
  }, [text]);

  // Dynamic CSS variables for the marquee animation
  const animationStyle = shouldScroll ? {
    '--scroll-x': `-${scrollDist + 40}px`,
    '--duration': `${(scrollDist + 40) / 25}s` // Dynamic duration based on length
  } : {};

  return (
    <div ref={containerRef} className={`scrolling-text-container ${className}`}>
      <span 
        ref={textRef} 
        className={`scrolling-text-content ${shouldScroll ? 'animate' : ''}`}
        style={animationStyle}
      >
        {text}
      </span>
    </div>
  );
};

export default ScrollingText;