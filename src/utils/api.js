import { idb } from './idb';

const API_URL = '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = JSON.parse(localStorage.getItem('fel_currentUser'));
    if (user) {
      headers['X-User-Id'] = user.id;
      headers['X-User-Name'] = user.name || 'Unknown';
      headers['X-User-Role'] = user.role;
      if (user.branchId) headers['X-Branch-Id'] = user.branchId;
      const activeBranch = localStorage.getItem('fel_active_branch');
      if (user.role === 'system_admin' && activeBranch && activeBranch !== 'all') {
        headers['X-Branch-Id'] = activeBranch;
      }
    }
  } catch (e) {}
  return headers;
}

// Map endpoints to IDB cache stores
const ENDPOINT_MAP = {
  '/products': 'cache_products',
  '/categories': 'cache_categories',
  '/branches': 'cache_branches',
  '/customers': 'cache_customers',
  '/preorders': 'cache_preorders',
  '/users': 'cache_users',
  '/transactions': 'cache_transactions',
  '/expenses': 'cache_expenses',
};

const apiCall = async (path, options = {}) => {
  const method = options.method || 'GET';
  const isOnline = navigator.onLine;

  if (!isOnline) {
    console.warn(`[Offline] Intercepting ${method} ${path}`);
    
    // --- GET Requests: Serve from cache with branch filtering ---
    if (method === 'GET') {
      const storeName = ENDPOINT_MAP[path.split('?')[0]];
      if (storeName) {
        let cached = await idb.getAll(storeName);
        
        // Apply branch-specific filtering if applicable
        if (['/products', '/users', '/preorders', '/transactions', '/expenses'].includes(path.split('?')[0])) {
          try {
            const user = JSON.parse(localStorage.getItem('fel_currentUser'));
            const activeBranch = localStorage.getItem('fel_active_branch');
            
            let targetBranchId = user?.branchId;
            if (user?.role === 'system_admin' && activeBranch && activeBranch !== 'all') {
              targetBranchId = activeBranch;
            }

            if (targetBranchId && targetBranchId !== 'all') {
               const tid = String(targetBranchId);
               cached = cached.filter(item => String(item.branchId) === tid);
            }
          } catch (e) {
            console.error('[Offline Filter Error]', e);
          }
        }
        
        if (cached && cached.length) return cached;
        // Return empty array instead of throwing if it's a valid list endpoint
        if (['/products', '/users', '/preorders', '/transactions', '/categories', '/customers', '/branches'].includes(path.split('?')[0])) {
          return [];
        }
      }
      throw new Error('OFFLINE_CACHE_EMPTY');
    }

    // --- Write Requests: Add to Sync Queue + Optimistic Updates ---
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      const body = options.body ? JSON.parse(options.body) : null;
      const cleanPath = path.split('?')[0];

      // 0. AUTO-INJECT BRANCH ID: Ensure data belongs to current branch for offline filtering
      try {
        const user = JSON.parse(localStorage.getItem('fel_currentUser'));
        const activeBranch = localStorage.getItem('fel_active_branch');
        
        // Priority: selected active branch -> user's assigned branch
        let targetBranchId = (activeBranch && activeBranch !== 'all') ? activeBranch : user?.branchId;
        
        if (targetBranchId && body && !body.branchId && typeof body === 'object') {
          body.branchId = String(targetBranchId);
        }
      } catch (e) {}

      // 1. STANDARD OPTIMISTIC UPDATE: Map simple entities (Users, Customers, Pre-orders, etc.)
      const segments = cleanPath.split('/');
      const storeName = ENDPOINT_MAP['/' + segments[1]];
      if (storeName && body) {
        let updateData = { ...body };
        const pathId = segments[2];

        // Ensure we have an ID for the IndexedDB operation (from body or path)
        if (!updateData.id && pathId) updateData.id = pathId;

        if (updateData.id) {
          if (method === 'DELETE') {
            await idb.delete(storeName, updateData.id);
          } else if (method === 'PUT') {
            // Merge update into existing record to prevent data loss
            const existing = await idb.get(storeName, updateData.id);
            await idb.put(storeName, { ...(existing || {}), ...updateData });
          } else {
            // POST: Standard put
            await idb.put(storeName, updateData);
          }
        }
      }

      // 2. ADVANCED OFFLINE SIDE EFFECTS (Hardened Logic)
      
      // CASE: Inventory Adjustment (Bulk POST)
      if (cleanPath === '/products/inventory' && body?.direction && Array.isArray(body?.items)) {
        for (const item of body.items) {
          try {
            const product = await idb.get('cache_products', item.productId);
            if (product) {
              const change = (item.quantity || 0);
              if (body.direction === 'deduct') {
                product.stock = Math.max(0, (product.stock || 0) - change);
              } else if (body.direction === 'restore') {
                product.stock = (product.stock || 0) + change;
              }
              await idb.put('cache_products', product);
              console.log(`[Offline Inventory] ${body.direction}: ${change} for ${product.name}`);
            }
          } catch (e) { console.error('[Offline Inventory Error]', e); }
        }
      }

      // CASE: Manual Stock Adjustment (Single PUT)
      if (cleanPath.startsWith('/products/') && cleanPath.endsWith('/adjust') && body?.quantity) {
        try {
          const productId = segments[2];
          const product = await idb.get('cache_products', productId);
          if (product) {
            product.stock = (product.stock || 0) + (body.quantity || 0);
            await idb.put('cache_products', product);
            console.log(`[Offline Adjust] Adjusted ${body.quantity} for ${product.name}`);
          }
        } catch (e) { console.error('[Offline Adjust Error]', e); }
      }

      // CASE: Transaction Record (for Dashboard/Reports)
      if (cleanPath === '/transactions' && method === 'POST' && body) {
         try {
           await idb.put('cache_transactions', body);
         } catch (e) { console.error('[Offline Transaction Cache Error]', e); }
      }

      // 3. QUEUE FOR SYNC
      await idb.put('sync_queue', {
        id: crypto.randomUUID(),
        method,
        path,
        body,
        timestamp: Date.now(),
        originalUpdatedAt: body?.updatedAt || null
      });

      console.log(`[Offline] Successfully queued ${method} ${path}`);
      return { success: true, offline: true, message: 'Saved to local vault. Will sync when online.' };
    }
  }

  // --- ONLINE: Normal Fetch ---
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...getHeaders(), ...options.headers }
    });
  } catch (netErr) {
    if (netErr.message === 'Failed to fetch') {
      console.error(`[Network Critical] Failed to fetch ${path}. The server may be down or the connection was interrupted.`);
      throw new Error(`Network Error: Cannot reach server at ${path}. Please check your connection and ensure the backend is running.`);
    }
    throw netErr;
  }
  
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let errorMessage = `Error ${res.status} at ${path}`;
    if (data?.error || data?.message) {
      errorMessage = data.error || data.message;
    } else if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
      const preview = data.substring(0, 100).replace(/[\n\r]/g, ' ');
      errorMessage = `Server Error: Received HTML instead of JSON at ${path}. This usually means the API route is missing or the backend crashed. Preview: "${preview}..." (Check if port 3001 is running)`;
    }
    throw new Error(errorMessage);
  }

  // UPDATE CACHE: If it was a GET request for a key entity, update our mirror
  if (method === 'GET' && res.ok) {
    const storeName = ENDPOINT_MAP[path.split('?')[0]];
    if (storeName && Array.isArray(data)) {
      idb.putAll(storeName, data).catch(err => {
        console.warn(`[Cache Update Ignored] Failed to mirror ${path} to local storage. This is safe to ignore during upgrades.`, err);
      });
    }
  }

  return data;
};

export const api = {
  get: (path, options) => apiCall(path, options),
  post: (path, body) => apiCall(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiCall(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => apiCall(path, { method: 'DELETE' }),
  callRaw: (path, options) => apiCall(path, { ...options, skipInterceptor: true }) // Helper for sync engine
};
