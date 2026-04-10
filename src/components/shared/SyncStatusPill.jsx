import { useSync } from '../../contexts/SyncContext';
import { Wifi, WifiOff, RefreshCw, Smartphone } from 'lucide-react';

/**
 * SyncStatusPill - The "Nicest" indicator for connectivity.
 * Placed in the top right, featuring glassmorphism and subtle animations.
 */
export default function SyncStatusPill() {
  const { isOnline, syncStatus } = useSync();

  return (
    <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
      <div className="flex items-center gap-2">
        {syncStatus.isSyncing ? (
          <RefreshCw size={14} className="spinning" />
        ) : isOnline ? (
          <Wifi size={14} />
        ) : (
          <WifiOff size={14} />
        )}
        <span className="pill-text">
          {syncStatus.isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline Mode'}
        </span>
      </div>
      
      {syncStatus.pending > 0 && (
        <div className="pending-badge" title={`${syncStatus.pending} items waiting to sync`}>
          {syncStatus.pending}
        </div>
      )}

      <style jsx>{`
        .pill-text {
          white-space: nowrap;
        }
        
        .pending-badge {
          background: var(--accent);
          color: white;
          font-size: 8px;
          height: 16px;
          min-width: 16px;
          padding: 0 4px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
          font-weight: 800;
          box-shadow: 0 2px 5px rgba(212, 118, 60, 0.4);
          animation: badge-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes badge-pop {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
