import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import './PullToRefresh.css';

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullState, setPullState] = useState('idle'); // idle, pulling, releasing, refreshing
  
  const containerRef = useRef(null);
  const startY = useRef(0);
  const PULL_THRESHOLD = 80;
  const MAX_PULL = 150;

  const handleTouchStart = (e) => {
    // Only trigger if we are at the top of the scrollable container
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startY.current = e.touches[0].pageY;
      setPullState('idle');
    } else {
      startY.current = null;
    }
  };

  const handleTouchMove = (e) => {
    if (startY.current === null || isRefreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Prevent default browser behavior (native pull-to-refresh) if we are handled
      // But we use overscroll-behavior in CSS usually. 
      // For custom feel, we limit the pull distance
      const elasticDiff = Math.pow(diff, 0.8); // Elastic feel
      const distance = Math.min(elasticDiff, MAX_PULL);
      
      setPullDistance(distance);
      setPullState(distance > PULL_THRESHOLD ? 'releasing' : 'pulling');
      
      // If we are pulling down, prevent the scroll which might try to happen
      if (diff > 10) {
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (startY.current === null || isRefreshing) return;

    if (pullDistance > PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullState('refreshing');
      setPullDistance(PULL_THRESHOLD);

      try {
        if (onRefresh) await onRefresh();
      } finally {
        // Smooth snap back
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setPullState('idle');
        }, 500);
      }
    } else {
      setPullDistance(0);
      setPullState('idle');
    }
    
    startY.current = null;
  };

  return (
    <div 
      ref={containerRef} 
      className={`ptr-container ${isRefreshing ? 'ptr-refreshing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overflowY: 'auto', height: '100%', position: 'relative' }}
    >
      <div 
        className="ptr-indicator" 
        style={{ 
          transform: `translateY(${pullDistance - 50}px)`,
          opacity: pullDistance > 20 ? 1 : 0,
          transition: pullState === 'idle' ? 'all 0.3s ease' : 'none'
        }}
      >
        <div className={`ptr-icon-wrapper ${pullState === 'refreshing' ? 'spinning' : ''}`}>
           <RefreshCw 
             size={24} 
             style={{ 
               transform: `rotate(${pullDistance * 2}deg)`,
               color: pullState === 'releasing' ? 'var(--success)' : 'var(--accent)'
             }} 
           />
        </div>
        <span className="ptr-label">
          {pullState === 'pulling' && 'Pull to refresh...'}
          {pullState === 'releasing' && 'Release to refresh...'}
          {pullState === 'refreshing' && 'Updating Bakery...'}
        </span>
      </div>
      <div 
        className="ptr-content"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: pullState === 'idle' ? 'transform 0.3s ease' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
}
