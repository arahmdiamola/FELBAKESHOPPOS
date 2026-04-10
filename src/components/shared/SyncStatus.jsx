import { useSync } from '../../contexts/SyncContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SyncStatus({ mini = false }) {
  const { isOnline, syncStatus, processSyncQueue } = useSync();

  if (mini) {
    return (
      <div className={`sync-status-mini ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'}>
        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      </div>
    );
  }

  return (
    <div className="sync-status-card">
      <div className="flex items-center gap-3">
        <div className={`sync-icon ${isOnline ? 'online' : 'offline'} ${syncStatus.isSyncing ? 'spinning' : ''}`}>
          {syncStatus.isSyncing ? (
            <RefreshCw size={18} />
          ) : isOnline ? (
            <Wifi size={18} />
          ) : (
            <WifiOff size={18} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider opacity-60">System Status</span>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
          </div>
          <div className="text-sm font-bold">
            {isOnline ? (syncStatus.isSyncing ? 'Synchronizing...' : 'Online') : 'Offline Mode'}
          </div>
          {syncStatus.pending > 0 && (
            <div className="text-xs text-amber-600 font-bold mt-1">
              {syncStatus.pending} tasks pending sync
            </div>
          )}
          {isOnline && syncStatus.pending > 0 && !syncStatus.isSyncing && (
            <button className="btn-link mt-1" onClick={processSyncQueue}>Sync Now</button>
          )}
        </div>
      </div>

      <style jsx>{`
        .sync-status-card {
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-md);
          margin: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .sync-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
        }
        .sync-icon.online { color: #4CAF50; }
        .sync-icon.offline { color: #FF9800; }
        
        .spinning {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-dot.online { background: #4CAF50; box-shadow: 0 0 8px #4CAF50; }
        .status-dot.offline { background: #FF9800; }

        .btn-link {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 11px;
          font-weight: 800;
          padding: 0;
          cursor: pointer;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
