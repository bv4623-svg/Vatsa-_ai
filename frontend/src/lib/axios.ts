// lib/axios.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the same token used by the auth flows to every browser request.
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('access_token');
      const stored = localStorage.getItem('user');
      let userToken: string | undefined;
      if (stored) {
        try {
          const user = JSON.parse(stored) as { token?: unknown };
          userToken = typeof user.token === 'string' ? user.token : undefined;
        } catch {
          userToken = undefined;
        }
      }
      const token = accessToken || userToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🚫 Response interceptor – handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { api as apiClient };