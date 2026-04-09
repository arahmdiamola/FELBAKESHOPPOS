const API_URL = '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = JSON.parse(localStorage.getItem('fel_currentUser'));
    if (user) {
      headers['X-User-Id'] = user.id;
      headers['X-User-Role'] = user.role;
      // If user has a branch id (i.e. not systemic admin), attach it
      if (user.branchId) {
        headers['X-Branch-Id'] = user.branchId;
      }
      
      // Multi-branch overarching toggle for system admins
      const activeBranch = localStorage.getItem('fel_active_branch');
      if (user.role === 'system_admin') {
        if (activeBranch && activeBranch !== 'all') {
          headers['X-Branch-Id'] = activeBranch;
        }
      }
    }
  } catch (e) {
    // Ignore prefix errors
  }
  return headers;
}

const apiCall = async (path, options = {}) => {
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
    const errorMsg = data?.error || data?.message || (typeof data === 'string' ? data : 'An unexpected error occurred');
    throw new Error(errorMsg);
  }
  return data;
};

export const api = {
  get: (path) => apiCall(path),
  post: (path, body) => apiCall(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiCall(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => apiCall(path, { method: 'DELETE' })
};
