import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    // Get token from auth store (which syncs with localStorage)
    const token = useAuthStore.getState().accessToken || 
                  (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for 401 handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear auth and redirect to login
            if (typeof window !== 'undefined') {
                useAuthStore.getState().logout();
                window.location.href = '/auth/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
