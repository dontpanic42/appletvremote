import React from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';

/**
 * SidebarSection Component
 * 
 * A reusable accordion section for the sidebar.
 * 
 * @param {string} props.title - The display title of the section.
 * @param {number} props.count - The number of items in this section.
 * @param {boolean} props.isExpanded - Whether the accordion is currently open.
 * @param {Function} props.onToggle - Toggles the accordion expansion.
 * @param {Function} props.onRefresh - (Optional) Triggers a network re-scan.
 * @param {boolean} props.isScanning - Loading flag for active scanning.
 */
const SidebarSection = ({ 
  title, 
  count, 
  isExpanded, 
  onToggle, 
  onRefresh, 
  isScanning,
  children 
}) => {
  return (
    <section className={`sidebar-section accordion ${isExpanded ? 'expanded' : ''}`}>
      <div className="section-title" onClick={onToggle}>
        <div className="title-left">
          <ChevronRight size={16} className="accordion-chevron" />
          <h3>{title}</h3>
        </div>
        <div className="title-right">
          <span className="count-badge">{count}</span>
          {/* Only show refresh button if onRefresh callback is provided */}
          {onRefresh && (
            <button className="refresh-btn" onClick={(e) => { e.stopPropagation(); onRefresh(); }}>
              <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            </button>
          )}
        </div>
      </div>
      
      <div className="sidebar-content">
        {children}
      </div>
    </section>
  );
};

export default SidebarSection;