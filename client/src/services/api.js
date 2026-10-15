// Centralized API client for CollabCode
const BASE_URL = '';

export function getAuthToken() {
  return localStorage.getItem('collabcode_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('collabcode_token', token);
  } else {
    localStorage.removeItem('collabcode_token');
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('collabcode_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('collabcode_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('collabcode_user');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (login, password) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password })
  }),
  register: (username, email, password) => request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password })
  }),
  getMe: () => request('/api/auth/me'),
  getDemoAccounts: () => request('/api/auth/demo-accounts'),

  // Projects
  getProjects: () => request('/api/projects'),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject: (data) => request('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProject: (id, data) => request(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteProject: (id) => request(`/api/projects/${id}`, {
    method: 'DELETE'
  }),
  forkProject: (id) => request(`/api/projects/${id}/fork`, {
    method: 'POST'
  }),

  // Coding Sessions
  getSessions: () => request('/api/sessions'),
  getSession: (code) => request(`/api/sessions/${code}`),
  createSession: (data) => request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  inviteToSession: (code, email) => request(`/api/sessions/${code}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  getMyInvites: () => request('/api/sessions/invites/my-invites'),
  acceptInvite: (id) => request(`/api/sessions/invites/${id}/accept`, {
    method: 'PUT'
  }),
  declineInvite: (id) => request(`/api/sessions/invites/${id}/decline`, {
    method: 'PUT'
  }),
  revokeInvite: (code, id) => request(`/api/sessions/${code}/invites/${id}`, {
    method: 'DELETE'
  }),
  saveSessionProject: (code, data) => request(`/api/sessions/${code}/save-project`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  toggleSessionLock: (code) => request(`/api/sessions/${code}/toggle-lock`, {
    method: 'PUT'
  }),
  endSession: (code) => request(`/api/sessions/${code}/end`, {
    method: 'PUT'
  }),

  // Admin
  getAdminStats: () => request('/api/admin/stats'),
  getAdminUsers: () => request('/api/admin/users'),
  createAdminUser: (data) => request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateUserRole: (id, role) => request(`/api/admin/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  }),
  updateUserStatus: (id, status) => request(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, {
    method: 'DELETE'
  }),
  getAdminSessions: () => request('/api/admin/sessions'),
  terminateSession: (id) => request(`/api/admin/sessions/${id}/terminate`, {
    method: 'POST'
  }),
  deleteAdminSession: (id) => request(`/api/admin/sessions/${id}`, {
    method: 'DELETE'
  })
};
