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

export const api = {
  get: async (path) => {
    const res = await fetch(`${API_URL}${path}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  post: async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  put: async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  del: async (path) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};
