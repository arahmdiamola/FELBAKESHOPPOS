import { idb } from './idb';

const API_URL = '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = JSON.parse(localStorage.getItem('fel_currentUser'));
    if (user) {
      headers['X-User-Id'] = user.id;
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
        if (['/products', '/users', '/preorders', '/transactions'].includes(path.split('?')[0])) {
          try {
            const user = JSON.parse(localStorage.getItem('fel_currentUser'));
            const activeBranch = localStorage.getItem('fel_active_branch');
            
            let targetBranchId = user?.branchId;
            if (user?.role === 'system_admin' && activeBranch && activeBranch !== 'all') {
              targetBranchId = activeBranch;
            }

            if (targetBranchId && targetBranchId !== 'all') {
               cached = cached.filter(item => item.branchId === targetBranchId);
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
      
      // 1. STANDARD OPTIMISTIC UPDATE: Map simple entities (Users, Customers, etc.)
      const segments = cleanPath.split('/');
      const storeName = ENDPOINT_MAP['/' + segments[1]];
      if (storeName && body && body.id) {
        if (method === 'DELETE') await idb.delete(storeName, body.id);
        else await idb.put(storeName, body);
      }

      // 2. ADVANCED OFFLINE SIDE EFFECTS (Hardened Logic)
      
      // CASE: Inventory Deduction
      if (cleanPath === '/products/inventory' && body?.direction === 'deduct' && Array.isArray(body?.items)) {
        for (const item of body.items) {
          try {
            const product = await idb.get('cache_products', item.productId);
            if (product) {
              product.stock = Math.max(0, (product.stock || 0) - (item.quantity || 0));
              await idb.put('cache_products', product);
              console.log(`[Offline Inventory] Deducted ${item.quantity} from ${product.name}`);
            }
          } catch (e) { console.error('[Offline Inventory Error]', e); }
        }
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
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers }
  });
  
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
      errorMessage = `Server Error: Received HTML instead of JSON at ${path}. Preview: "${preview}..." (Check if Backend is running on port 3001)`;
    }
    throw new Error(errorMessage);
  }

  // UPDATE CACHE: If it was a GET request for a key entity, update our mirror
  if (method === 'GET' && res.ok) {
    const storeName = ENDPOINT_MAP[path.split('?')[0]];
    if (storeName && Array.isArray(data)) {
      idb.putAll(storeName, data).catch(console.error);
    }
  }

  return data;
};

export const api = {
  get: (path) => apiCall(path),
  post: (path, body) => apiCall(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiCall(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => apiCall(path, { method: 'DELETE' }),
  callRaw: (path, options) => apiCall(path, { ...options, skipInterceptor: true }) // Helper for sync engine
};
