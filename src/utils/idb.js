const DB_NAME = 'fel_pos_db';
const DB_VERSION = 4;

/**
 * Lightweight IndexedDB wrapper for Offline-First Bakery POS
 */
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Sync Queue: Stores local changes to be pushed to the server
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }

      // Mirrors for Master Data: Local copies of server data
      if (!db.objectStoreNames.contains('cache_products')) {
        db.createObjectStore('cache_products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_categories')) {
        db.createObjectStore('cache_categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_branches')) {
        db.createObjectStore('cache_branches', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_customers')) {
        db.createObjectStore('cache_customers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_preorders')) {
        db.createObjectStore('cache_preorders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_users')) {
        db.createObjectStore('cache_users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_transactions')) {
        db.createObjectStore('cache_transactions', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getStore = async (storeName, mode = 'readonly') => {
  const db = await initDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

export const idb = {
  // --- General CRUD ---
  put: async (storeName, data) => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  putAll: async (storeName, items) => {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    items.forEach(item => store.put(item));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  get: async (storeName, id) => {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getAll: async (storeName) => {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  delete: async (storeName, id) => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  clear: async (storeName) => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
