import { useState } from 'react';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export function useSafetyShield() {
  const { addToast } = useToast();
  const [lastBackupTime, setLastBackupTime] = useState(localStorage.getItem('fel_last_backup') || null);

  const triggerBackupDownload = async (prefix = 'manual') => {
    try {
      // For Terminal Snapshots vs Full Backups
      // Currently, both use /backup-full but we can distinguish them in the name
      const data = await api.get('/backup-full');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `fel-pos-${prefix}-${timestamp}.json`;
      
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      const now = new Date().toISOString();
      setLastBackupTime(now);
      localStorage.setItem('fel_last_backup', now);
      
      // Log the safety action
      try {
        await api.post('/logs', { action: 'SYSTEM_BACKUP', details: { type: prefix } });
      } catch (err) {
        console.warn('Failed to log backup action', err);
      }
      
      return true;
    } catch (e) {
      addToast('Backup failed: ' + e.message, 'error');
      return false;
    }
  };

  return {
    lastBackupTime,
    triggerBackupDownload
  };
}
