import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    api.post('/auth/register', data),
  
  getCurrentUser: () =>
    api.get('/auth/me'),
  
  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    api.patch('/auth/me', data),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/change-password', { currentPassword, newPassword }),
};

// ============================================================================
// Catalog API
// ============================================================================

export const catalogApi = {
  getAll: () => api.get('/catalogs'),
  getById: (id: string) => api.get(`/catalogs/${id}`),
  getStats: (id: string) => api.get(`/catalogs/${id}/stats`),
};

// ============================================================================
// Category API
// ============================================================================

export const categoryApi = {
  getByCatalog: (catalogId: string, params?: { includeChildren?: boolean; parentId?: string }) =>
    api.get(`/categories/catalog/${catalogId}`, { params }),
  
  getById: (id: string) =>
    api.get(`/categories/${id}`),
  
  getChildren: (id: string) =>
    api.get(`/categories/${id}/children`),
  
  getBreadcrumb: (id: string) =>
    api.get(`/categories/${id}/breadcrumb`),
};

// ============================================================================
// Part API
// ============================================================================

export const partApi = {
  getByCatalog: (catalogId: string, params?: { search?: string; limit?: number; offset?: number }) =>
    api.get(`/parts/catalog/${catalogId}`, { params }),
  
  getByCategory: (categoryId: string) =>
    api.get(`/parts/category/${categoryId}`),
  
  getById: (id: string) =>
    api.get(`/parts/${id}`),
  
  getByNumber: (partNumber: string, catalogId: string) =>
    api.get(`/parts/number/${partNumber}`, { params: { catalogId } }),
};

// ============================================================================
// Video API
// ============================================================================

export const videoApi = {
  getByPart: (partId: string, params?: { level?: number }) =>
    api.get(`/videos/part/${partId}`, { params }),
  
  getById: (id: string) =>
    api.get(`/videos/${id}`),
  
  trackView: (id: string) =>
    api.post(`/videos/${id}/view`),
  
  upload: (data: FormData) =>
    api.post('/videos/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Admin
  getPending: () =>
    api.get('/videos/pending/all'),
  
  approve: (id: string) =>
    api.patch(`/videos/${id}/approve`),
  
  reject: (id: string) =>
    api.patch(`/videos/${id}/reject`),
};

// ============================================================================
// Comment API
// ============================================================================

export const commentApi = {
  getByVideo: (videoId: string) =>
    api.get(`/comments/video/${videoId}`),
  
  create: (data: { videoId: string; content: string; parentId?: string; imageUrl?: string }) =>
    api.post('/comments', data),
  
  update: (id: string, content: string) =>
    api.patch(`/comments/${id}`, { content }),
  
  delete: (id: string) =>
    api.delete(`/comments/${id}`),
  
  like: (id: string) =>
    api.post(`/comments/${id}/like`),
};

// ============================================================================
// Project API
// ============================================================================

export const projectApi = {
  getAll: () =>
    api.get('/projects'),
  
  getById: (id: string) =>
    api.get(`/projects/${id}`),
  
  create: (data: { name: string; description?: string }) =>
    api.post('/projects', data),
  
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/projects/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/projects/${id}`),
  
  addItem: (id: string, item: any) =>
    api.post(`/projects/${id}/items`, item),
  
  uploadBOM: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post(`/projects/${id}/upload-bom`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  suggestUpgrades: (id: string) =>
    api.get(`/projects/${id}/suggest-upgrades`),
  
  createRevision: (id: string, changeSummary: string) =>
    api.post(`/projects/${id}/create-revision`, { changeSummary }),
  
  getRevisions: (id: string) =>
    api.get(`/projects/${id}/revisions`),
};

// ============================================================================
// Quote API
// ============================================================================

export const quoteApi = {
  getAll: () =>
    api.get('/quotes'),
  
  getById: (id: string) =>
    api.get(`/quotes/${id}`),
  
  create: (data: any) =>
    api.post('/quotes', data),
  
  uploadCSV: (file: File) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post('/quotes/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  downloadCSV: (id: string) =>
    api.get(`/quotes/${id}/download-csv`, { responseType: 'blob' }),
  
  generatePDF: (id: string) =>
    api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }),
};

// ============================================================================
// Notification API
// ============================================================================

export const notificationApi = {
  getAll: (unreadOnly?: boolean) =>
    api.get('/notifications', { params: { unreadOnly } }),
  
  markAsRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),
  
  markAllAsRead: () =>
    api.patch('/notifications/read-all'),
  
  delete: (id: string) =>
    api.delete(`/notifications/${id}`),
};

// ============================================================================
// Admin API
// ============================================================================

export const adminApi = {
  getDashboardStats: () =>
    api.get('/admin/dashboard'),
  
  getUsers: () =>
    api.get('/admin/users'),
  
  updateUser: (id: string, data: any) =>
    api.patch(`/admin/users/${id}`, data),
  
  deleteUser: (id: string) =>
    api.delete(`/admin/users/${id}`),
  
  bulkApproveVideos: (videoIds: string[]) =>
    api.post('/admin/bulk-approve-videos', { videoIds }),
};
