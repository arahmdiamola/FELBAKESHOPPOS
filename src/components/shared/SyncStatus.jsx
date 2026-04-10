import { useSync } from '../../contexts/SyncContext';
import { Wifi, WifiOff, RefreshCw, Layers } from 'lucide-react';

/**
 * SyncStatus - Sidebar Edition
 * Transformed into an elegant pill-style indicator as requested by the user.
 * Consolidates all connectivity info into the sidebar with high visibility.
 */
export default function SyncStatus({ mini = false }) {
  const { isOnline, syncStatus, processSyncQueue } = useSync();

  if (mini) {
    return (
      <div 
        className={`status-pill-mini ${isOnline ? 'online' : 'offline'}`} 
        title={isOnline ? 'Online' : 'Offline Mode'}
      >
        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      </div>
    );
  }

  return (
    <div className={`status-pill-container ${isOnline ? 'online' : 'offline'}`}>
      <div className="status-pill-main" onClick={isOnline && syncStatus.pending > 0 ? processSyncQueue : undefined}>
        <div className="status-pill-indicator">
          <div className="status-pill-orb" />
          {syncStatus.isSyncing ? (
            <RefreshCw size={12} className="spinning" />
          ) : isOnline ? (
            <Wifi size={12} />
          ) : (
            <WifiOff size={12} />
          )}
        </div>
        
        <div className="status-pill-content">
          <span className="status-pill-label">
            {syncStatus.isSyncing ? 'Syncing...' : isOnline ? 'System Online' : 'Offline Mode'}
          </span>
          {syncStatus.pending > 0 && (
            <span className="status-pill-meta">
              {syncStatus.pending} pending
            </span>
          )}
        </div>

        {isOnline && syncStatus.pending > 0 && !syncStatus.isSyncing && (
           <div className="status-pill-action">
              <RefreshCw size={10} />
           </div>
        )}
      </div>

      <style jsx>{`
        .status-pill-container {
          padding: 0 12px;
          margin-bottom: 12px;
        }

        .status-pill-main {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 99px;
          color: var(--text-sidebar);
          transition: all 0.3s ease;
          cursor: default;
        }

        .status-pill-main:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .status-pill-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
        }

        .status-pill-orb {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4CAF50;
          box-shadow: 0 0 10px #4CAF50;
        }

        .offline .status-pill-orb {
          background: #F5A623;
          box-shadow: 0 0 10px #F5A623;
        }

        .status-pill-content {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .status-pill-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: white;
        }

        .status-pill-meta {
          font-size: 9px;
          opacity: 0.6;
          font-weight: 700;
        }

        .status-pill-action {
          opacity: 0.5;
          animation: bounce 1s infinite alternate;
        }

        .status-pill-mini {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          color: #4CAF50;
        }

        .status-pill-mini.offline {
          color: #F5A623;
        }

        @keyframes spinning {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spinning {
          animation: spinning 1.2s linear infinite;
        }

        @keyframes bounce {
           to { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
