import React from 'react';

export default function AlertCard({ alert, isExpanded, onToggleExpand, onAnalyze, onDispatch }) {
  const { title, message, timestamp, riskLevel } = alert;

  // Helper to map risk levels to styles when expanded
  const getExpandedStyle = (level) => {
    switch (level) {
      case 'red':
        return {
          container: 'bg-error-container/10 border-l-4 border-error p-4 rounded-r',
          badge: 'bg-error text-on-error',
          badgeText: 'RED RISK',
          btnColor: 'bg-error text-on-error hover:opacity-90'
        };
      case 'amber':
        return {
          container: 'bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r',
          badge: 'bg-amber-500 text-black',
          badgeText: 'AMBER RISK',
          btnColor: 'bg-amber-500 text-black hover:opacity-90'
        };
      case 'green':
      default:
        return {
          container: 'bg-primary-container/10 border-l-4 border-primary p-4 rounded-r',
          badge: 'bg-primary text-on-primary',
          badgeText: 'GREEN RISK',
          btnColor: 'bg-primary text-on-primary hover:opacity-90'
        };
    }
  };

  // Helper to get indicator icons for collapsed view
  const getCollapsedIcon = (level) => {
    switch (level) {
      case 'red':
        return <span className="material-symbols-outlined text-error text-sm risk-pulse">warning</span>;
      case 'amber':
        return <span className="material-symbols-outlined text-amber-500 text-sm">info</span>;
      case 'green':
      default:
        return <span className="material-symbols-outlined text-primary text-sm">sensors</span>;
    }
  };

  if (isExpanded) {
    const styles = getExpandedStyle(riskLevel);
    return (
      <div className={`${styles.container} transition-all duration-300 relative`}>
        {/* Toggle Collapse Button on header click */}
        <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={onToggleExpand}>
          <div>
            <span className={`${styles.badge} font-label-caps text-[10px] px-1.5 py-0.5 rounded`}>
              {styles.badgeText}
            </span>
            <h4 className="font-body-md font-bold mt-2 text-on-surface flex items-center gap-1.5">
              {title}
              <span className="material-symbols-outlined text-xs opacity-50">expand_less</span>
            </h4>
          </div>
          <span className="font-data-table text-[10px] opacity-60 text-on-surface-variant">{timestamp}</span>
        </div>
        
        <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">{message}</p>
        
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onDispatch(alert); }}
            className={`${styles.btnColor} font-label-caps text-[11px] py-2 rounded transition-all flex items-center justify-center active:scale-95`}
          >
            <span className="material-symbols-outlined text-sm mr-1">security</span> DISPATCH FORCE
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyze(alert); }}
            className="bg-surface-container-high border border-outline-variant text-on-surface font-label-caps text-[11px] py-2 rounded hover:bg-surface-bright transition-all flex items-center justify-center active:scale-95"
          >
            <span className="material-symbols-outlined text-sm mr-1">analytics</span> ANALYZE
          </button>
        </div>
      </div>
    );
  }

  // Collapsed View
  return (
    <div 
      onClick={onToggleExpand}
      className="bg-surface-container-low border border-outline-variant p-3 rounded group cursor-pointer hover:border-primary transition-all flex justify-between items-center"
    >
      <div className="flex items-center space-x-3 min-w-0">
        {getCollapsedIcon(riskLevel)}
        <span className="font-body-md font-medium text-sm text-on-surface truncate group-hover:text-primary transition-colors">
          {title}
        </span>
        <span className="material-symbols-outlined text-xs opacity-30 group-hover:opacity-100 transition-opacity">expand_more</span>
      </div>
      <span className="font-data-table text-[10px] opacity-60 text-on-surface-variant whitespace-nowrap">{timestamp}</span>
    </div>
  );
}
