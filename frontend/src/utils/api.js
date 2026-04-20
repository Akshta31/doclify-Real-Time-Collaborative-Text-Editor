import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('doclify_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('doclify_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updatePassword: (data) => api.put('/auth/update-password', data),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const docAPI = {
  list: (params) => api.get('/documents', { params }),
  get: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),

  share: (id, data) => api.post(`/documents/${id}/share`, data),
  removeCollaborator: (id, userId) => api.delete(`/documents/${id}/collaborators/${userId}`),
  generateShareLink: (id) => api.post(`/documents/${id}/share-link`),
  getShared: (token) => api.get(`/documents/shared/${token}`),

  getVersions: (id) => api.get(`/documents/${id}/versions`),
  restoreVersion: (id, versionId) => api.post(`/documents/${id}/restore/${versionId}`),

  addComment: (id, data) => api.post(`/documents/${id}/comments`, data),
  deleteComment: (id, commentId) => api.delete(`/documents/${id}/comments/${commentId}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const userAPI = {
  search: (q) => api.get('/users/search', { params: { q } }),
  getById: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
};

export default api;
