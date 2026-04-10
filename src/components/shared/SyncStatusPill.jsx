import { useSync } from '../../contexts/SyncContext';
import { Wifi, WifiOff, RefreshCw, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

/**
 * SyncStatusPill - Global Floating Connectivity Indicator
 * Features:
 * - Glassmorphism design
 * - Fixed position (Top Right)
 * - Pulse glow animations for status
 * - Interactive manual sync
 */
export default function SyncStatusPill({ floating = true }) {
  const { isOnline, syncStatus, processSyncQueue } = useSync();
  const { addToast } = useToast();

  const handleManualSync = async (e) => {
    e.stopPropagation();
    if (!isOnline) {
      addToast('Cannot sync while offline', 'warning');
      return;
    }
    if (syncStatus.isSyncing) return;
    
    addToast('Syncing data...', 'info');
    await processSyncQueue();
  };

  return (
    <div 
      className={`glass-pill ${isOnline ? 'online animate-glow-pulse-safe' : 'offline animate-glow-pulse-warn'} ${floating ? 'floating' : ''}`}
      onClick={handleManualSync}
      title={isOnline ? 'System Online (Click to Refresh Sync)' : 'Offline Mode (Data Saved Locally)'}
    >
      <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
      
      <div className="pill-content">
        {syncStatus.isSyncing ? (
          <RefreshCw size={14} className="spinning" />
        ) : isOnline ? (
          <Wifi size={14} />
        ) : (
          <WifiOff size={14} />
        )}
        
        <span className="pill-label">
          {syncStatus.isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {syncStatus.pending > 0 && (
        <div className="pending-badge">
          <Layers size={10} />
          <span>{syncStatus.pending}</span>
        </div>
      )}

      {syncStatus.lastSync && isOnline && !syncStatus.isSyncing && syncStatus.pending === 0 && (
          <div className="status-tip">
             <CheckCircle size={10} color="#86efac" />
          </div>
      )}

      <style jsx>{`
        .glass-pill.floating {
          position: fixed;
          top: 20px;
          right: 24px;
          z-index: 9999;
          transform: translateZ(0);
        }

        .pill-content {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pill-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 800;
        }

        .pending-badge {
          background: #D4763C;
          color: white;
          padding: 2px 8px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 900;
          box-shadow: 0 4px 10px rgba(212, 118, 60, 0.4);
          animation: badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .status-tip {
            display: flex;
            align-items: center;
            opacity: 0.8;
        }

        @keyframes badge-pop {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }

        @media (max-width: 768px) {
          .glass-pill.floating {
            top: 10px;
            right: 10px;
            padding: 4px 10px;
          }
          .pill-label { display: none; }
        }
      `}</style>
    </div>
  );
}
