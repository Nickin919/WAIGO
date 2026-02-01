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
      // Don't redirect when the failing request was to login (wrong credentials)
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        // Session expired or token invalid - clear auth and redirect to login
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ============================================================================
// Public API (no auth required - for guest / FREE users)
// ============================================================================

export const publicApi = {
  getCatalogs: () => api.get('/public/catalogs'),
  searchParts: (q: string, params?: { category?: string; limit?: number }) =>
    api.get('/public/parts/search', { params: { q, ...params } }),
  crossReference: (manufacturer: string, partNumber: string) =>
    api.post('/public/cross-reference', { manufacturer, partNumber }),
  crossReferenceBulk: (items: Array<{ manufacturer: string; partNumber: string; quantity?: number; description?: string }>) =>
    api.post('/public/cross-reference/bulk', { items }),
};

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
  create: (name: string, description?: string) =>
    api.post('/catalogs', { name, description }),
  update: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.patch(`/catalogs/${id}`, data),
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
  getByCategory: (categoryId: string) => api.get(`/parts/category/${categoryId}`),
  getById: (id: string) => api.get(`/parts/${id}`),
  getByNumber: (partNumber: string, catalogId: string) =>
    api.get(`/parts/number/${partNumber}`, { params: { catalogId } }),
  lookupBulk: (catalogId: string, partNumbers: string[]) =>
    api.post('/parts/lookup-bulk', { catalogId, partNumbers }),
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
  getAll: () => api.get('/quotes'),
  getById: (id: string) => api.get(`/quotes/${id}`),
  create: (data: any) => api.post('/quotes', data),
  update: (id: string, data: any) => api.patch(`/quotes/${id}`, data),
  delete: (id: string) => api.delete(`/quotes/${id}`),
  downloadCSV: (id: string) => api.get(`/quotes/${id}/download-csv`, { responseType: 'blob' }),
  generatePDF: (id: string) => api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }),
};

// ============================================================================
// Assignments API (ADMIN/RSM/DISTRIBUTOR)
// ============================================================================

export const assignmentsApi = {
  getTree: () => api.get('/assignments/tree'),
  getUsers: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get('/assignments/users', { params }),
  getMyAssignments: () => api.get('/assignments/me'),
  assignCatalogs: (data: { userId?: string; userIds?: string[]; catalogIds: string[]; primaryCatalogId?: string }) =>
    api.post('/assignments/catalogs', data),
  assignContracts: (data: { userId?: string; userIds?: string[]; contractIds: string[] }) =>
    api.post('/assignments/contracts', data),
};

// ============================================================================
// Price Contracts API
// ============================================================================

export const priceContractApi = {
  list: () => api.get('/price-contracts'),
  getById: (id: string) => api.get(`/price-contracts/${id}`),
  create: (data: { name: string; description?: string; validFrom?: string; validTo?: string }) =>
    api.post('/price-contracts', data),
  update: (id: string, data: { name?: string; description?: string; validFrom?: string; validTo?: string }) =>
    api.patch(`/price-contracts/${id}`, data),
  delete: (id: string) => api.delete(`/price-contracts/${id}`),
  addItems: (contractId: string, items: Array<{ partId?: string; seriesOrGroup?: string; costPrice: number; suggestedSellPrice?: number; discountPercent?: number; minQuantity?: number }>) =>
    api.post(`/price-contracts/${contractId}/items`, { items }),
  updateMyContractItems: (contractId: string, items: Array<{ id: string; suggestedSellPrice: number | null }>) =>
    api.patch(`/my/contracts/${contractId}/items`, { items }),
};

// ============================================================================
// Customer API
// ============================================================================

export const customerApi = {
  getAll: (params?: { search?: string }) => api.get('/customers', { params }),
  create: (data: { name: string; company?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string }) =>
    api.post('/customers', data),
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
// User Management API (DISTRIBUTOR, RSM, ADMIN)
// ============================================================================

export const userManagementApi = {
  getUsers: (params?: { role?: string; search?: string; assignedOnly?: boolean }) =>
    api.get('/user-management', { params }),
  getHierarchy: (userId?: string) =>
    api.get(userId ? `/user-management/hierarchy/${userId}` : '/user-management/hierarchy'),
  getActivity: () => api.get('/user-management/activity'),
  assignToDistributor: (data: { userId: string; distributorId: string }) =>
    api.post('/user-management/assign-to-distributor', data),
  assignDistributorToRsm: (data: { distributorId: string; rsmId: string }) =>
    api.post('/user-management/assign-distributor-to-rsm', data),
  updateUserRole: (userId: string, role: string) =>
    api.patch(`/user-management/${userId}/role`, { role }),
};

// ============================================================================
// Team API
// ============================================================================

export const teamApi = {
  getAll: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/teams', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMember: (data: { teamId: string; userId: string }) =>
    api.post('/teams/members', data),
  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
};

// ============================================================================
// Pricing Contracts API (backend: /cost-tables)
// ============================================================================

export const costTableApi = {
  getAll: () => api.get('/cost-tables'),
  getById: (id: string) => api.get(`/cost-tables/${id}`),
  create: (data: { name: string; description?: string; userId?: string; turnkeyTeamId?: string }) =>
    api.post('/cost-tables', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/cost-tables/${id}`, data),
  delete: (id: string) => api.delete(`/cost-tables/${id}`),
  uploadCsv: (formData: FormData) =>
    api.post('/cost-tables/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadCsv: (id: string) =>
    api.get(`/cost-tables/${id}/download`, { responseType: 'blob' }),
};

// ============================================================================
// Sales Dashboard API (RSM / Admin)
// ============================================================================

export const salesApi = {
  getSummary: (rsmId?: string) =>
    api.get('/sales/summary', rsmId ? { params: { rsmId } } : {}),
  getRsms: () => api.get('/sales/rsms'),
  upload: (formData: FormData) =>
    api.post('/sales/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
