import { useSync } from '../../contexts/SyncContext';
import { Wifi, WifiOff, RefreshCw, Layers, CheckCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

/**
 * SyncStatusPill - Global Floating Connectivity Indicator
 * Final Premium Polish: Improved visibility, integrated spacing, and smoother animations.
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
      className={`glass-status-pill ${isOnline ? 'online animate-glow-pulse-safe' : 'offline animate-glow-pulse-warn'} ${floating ? 'floating' : ''}`}
      onClick={handleManualSync}
      title={isOnline ? 'System Online • Click to Refresh Sync' : 'Offline Mode • Data Saved Locally'}
    >
      <div className={`status-orb ${isOnline ? 'online' : 'offline'}`} />
      
      <div className="pill-body">
        {syncStatus.isSyncing ? (
          <RefreshCw size={12} className="spinning" />
        ) : isOnline ? (
          <Wifi size={12} />
        ) : (
          <WifiOff size={12} />
        )}
        
        <span className="pill-text">
          {syncStatus.isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {syncStatus.pending > 0 && (
        <div className="sync-count">
          <Layers size={9} />
          {syncStatus.pending}
        </div>
      )}

      {syncStatus.lastSync && isOnline && !syncStatus.isSyncing && syncStatus.pending === 0 && (
          <div className="status-ok">
             <CheckCircle size={10} />
          </div>
      )}

      <style jsx>{`
        .glass-status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          background: rgba(44, 24, 16, 0.85); /* Darker for better contrast on light theme */
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 99px;
          color: white;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          user-select: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          animation: slide-in-top 0.6s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-status-pill.floating {
          position: fixed;
          top: 18px;
          right: 20px;
          z-index: 10000;
        }

        .glass-status-pill:hover {
          background: rgba(44, 24, 16, 1);
          transform: translateY(-2px) scale(1.02);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .pill-body {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pill-text {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .status-orb {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          position: relative;
        }

        .status-orb.online { background: #4CAF50; box-shadow: 0 0 10px #4CAF50; }
        .status-orb.offline { background: #F5A623; box-shadow: 0 0 10px #F5A623; }

        .sync-count {
          background: #D4763C;
          color: white;
          font-size: 9px;
          font-weight: 900;
          padding: 1px 6px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          gap: 3px;
          box-shadow: 0 2px 8px rgba(212, 118, 60, 0.4);
        }

        .status-ok {
          color: #4CAF50;
          display: flex;
          align-items: center;
          opacity: 0.8;
        }

        @keyframes slide-in-top {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes spinning {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spinning {
          animation: spinning 1s linear infinite;
        }

        @media (max-width: 768px) {
          .glass-status-pill.floating {
             top: 8px;
             right: 8px;
          }
          .pill-text { display: none; }
        }
      `}</style>
    </div>
  );
}
