const DB_NAME = 'fel_pos_db';
const DB_VERSION = 5;

/**
 * Robust Singleton IndexedDB Wrapper for Offline-First Bakery POS
 * Prevents race conditions and ensures smooth version upgrades.
 */
let dbPromise = null;

export const initDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log(`[IDB] Upgrading to Version ${DB_VERSION}...`);
      
      const stores = [
        { name: 'sync_queue', options: { keyPath: 'id', autoIncrement: true } },
        { name: 'cache_products', options: { keyPath: 'id' } },
        { name: 'cache_categories', options: { keyPath: 'id' } },
        { name: 'cache_branches', options: { keyPath: 'id' } },
        { name: 'cache_customers', options: { keyPath: 'id' } },
        { name: 'cache_preorders', options: { keyPath: 'id' } },
        { name: 'cache_users', options: { keyPath: 'id' } },
        { name: 'cache_transactions', options: { keyPath: 'id' } },
        { name: 'cache_expenses', options: { keyPath: 'id' } }
      ];

      stores.forEach(store => {
        if (!db.objectStoreNames.contains(store.name)) {
          db.createObjectStore(store.name, store.options);
          console.log(`[IDB] Created Store: ${store.name}`);
        }
      });
    };

    request.onsuccess = () => {
      const db = request.result;
      
      // Handle parallel version upgrades in other tabs
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        console.log('[IDB] Database closed due to version change. Refreshing...');
        window.location.reload();
      };

      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      console.error('[IDB] Open Error:', request.error);
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('[IDB] Upgrade blocked by other tabs. Close other tabs of this app!');
    };
  });

  return dbPromise;
};

const getStore = async (storeName, mode = 'readonly') => {
  const db = await initDB();
  try {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  } catch (err) {
    if (err.name === 'NotFoundError') {
      console.error(`[IDB] Store "${storeName}" not found. Forcing schema refresh...`);
      // Since version is already bumped, this usually means the connection is stale
      db.close();
      dbPromise = null;
      throw err;
    }
    throw err;
  }
};

export const idb = {
  // --- General CRUD ---
  put: async (storeName, data) => {
    try {
      const store = await getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IDB Put Error] ${storeName}:`, e);
      throw e;
    }
  },

  putAll: async (storeName, items) => {
    try {
      const db = await initDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error(`[IDB PutAll Error] ${storeName}:`, e);
      throw e;
    }
  },

  get: async (storeName, id) => {
    try {
      const store = await getStore(storeName);
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`[IDB Get Error] ${storeName}:`, e);
      return null;
    }
  },

  getAll: async (storeName) => {
    try {
      const store = await getStore(storeName);
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`[IDB GetAll Error] ${storeName}:`, e);
      return [];
    }
  },

  delete: async (storeName, id) => {
    try {
      const store = await getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IDB Delete Error] ${storeName}:`, e);
      throw e;
    }
  },

  clear: async (storeName) => {
    try {
      const store = await getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IDB Clear Error] ${storeName}:`, e);
      throw e;
    }
  },

  clearAllData: async () => {
    const stores = [
      'sync_queue', 'cache_products', 'cache_categories', 
      'cache_branches', 'cache_customers', 'cache_preorders', 
      'cache_users', 'cache_transactions', 'cache_expenses'
    ];
    for (const storeName of stores) {
      try {
        await idb.clear(storeName);
      } catch (e) {
        console.warn(`[IDB] Could not clear ${storeName}`, e);
      }
    }
  }
};
