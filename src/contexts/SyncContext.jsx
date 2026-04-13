import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { idb } from '../utils/idb';
import { api } from '../utils/api';

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, lastSync: null, isSyncing: false });

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const queue = await idb.getAll('sync_queue');
    setSyncStatus(prev => ({ ...prev, pending: queue.length }));
  }, []);

  // background poll for counts
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // --- CONNECTIVITY HEARTBEAT (Every 2 mins) ---
  useEffect(() => {
    const sendHeartbeat = async () => {
       const user = JSON.parse(localStorage.getItem('fel_currentUser'));
       if (!user || !user.branchId || !navigator.onLine) return;
       try {
          await api.post(`/branches/${user.branchId}/heartbeat`);
       } catch (err) {}
    };

    if (isOnline) {
        sendHeartbeat();
        const hInterval = setInterval(sendHeartbeat, 30000); // 30 seconds
        return () => clearInterval(hInterval);
    }
  }, [isOnline]);

  // The Sync Engine
  const processSyncQueue = useCallback(async () => {
    if (!navigator.onLine || syncStatus.isSyncing) return;
    
    const queue = await idb.getAll('sync_queue');
    if (queue.length === 0) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    console.log(`[Sync] Processing ${queue.length} items...`);

    // Sort by timestamp to preserve order of operations
    const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

    for (const item of sortedQueue) {
      try {
        console.log(`[Sync] Syncing ${item.method} ${item.path}...`);
        
        let finalBody = item.body;

        // --- Advanced Merging Logic for Pre-orders ---
        if (item.path.startsWith('/preorders') && item.method === 'PUT') {
          try {
            const serverVersion = await api.get(item.path);
            if (serverVersion && serverVersion.updatedAt > item.originalUpdatedAt) {
              console.log(`[Sync] Conflict detected for ${item.path}. Merging...`);
              // Merge: Only apply fields that were changed in the offline session
              // We assume 'item.body' contains the fields the user wanted to set
              finalBody = { ...serverVersion, ...item.body };
            }
          } catch (e) {
             // If server version fetch fails, we just try to push anyway
          }
        }

        await api.callRaw(item.path, {
          method: item.method,
          body: JSON.stringify(finalBody),
          headers: { 'X-Sync-Offline': 'true' }
        });

        // Remove from queue after success
        await idb.delete('sync_queue', item.id);
      } catch (e) {
        console.error(`[Sync] Failed to sync item ${item.id}:`, e);
        
        // --- SAFETY BYPASS: Don't let broken data block the whole pipe ---
        const errorMsg = e.message || '';
        const isFatalDataError = errorMsg.includes('400') || errorMsg.includes('404') || errorMsg.includes('403');
        
        if (isFatalDataError) {
          console.warn(`[Sync] Fatal data error detected for ${item.id}. Skipping to unblock queue...`, e);
          await idb.delete('sync_queue', item.id); // Remove "bad" item to unblock the rest
          continue; // Move to next item
        }

        // Connectivity/Server issues: stop and retry later
        break; 
      }
    }

    setSyncStatus(prev => ({ 
      ...prev, 
      isSyncing: false, 
      lastSync: new Date().toISOString() 
    }));
    refreshPendingCount();
  }, [syncStatus.isSyncing, refreshPendingCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) processSyncQueue();
  }, [isOnline, processSyncQueue]);

  return (
    <SyncContext.Provider value={{
      isOnline,
      syncStatus,
      processSyncQueue,
      refreshPendingCount
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
