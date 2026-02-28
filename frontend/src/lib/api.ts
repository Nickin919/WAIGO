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
  getFeatureFlags: () =>
    api.get<{ bomAnalyzer: boolean; projects: boolean }>('/public/feature-flags'),
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
  
  getMyActivity: () =>
    api.get('/auth/me/activity'),
  
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    address?: string;
    phone?: string;
    defaultTerms?: string;
    currentPassword?: string;
  }) =>
    api.patch('/auth/me', data),
  
  uploadAvatar: (formData: FormData) =>
    api.post('/auth/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  uploadLogo: (formData: FormData) =>
    api.post('/auth/me/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  
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
  /** Current user: catalogs assigned + created; average parts per catalog */
  getMySummary: () => api.get('/catalogs/my-summary'),
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
  
  getFeed: (catalogId: string) =>
    api.get('/videos/feed', { params: { catalogId } }),

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
// BOM / Workflow API (uses project API: create project then upload BOM)
// ============================================================================

export const bomApi = {
  /** Upload BOM file: creates a new project and uploads CSV to it. Returns project with id. */
  upload: async (file: File) => {
    const name = `BOM Import ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-')}`;
    const createRes = await api.post<{ id: string }>('/projects', { name });
    const projectId = (createRes.data as { id: string }).id;
    const formData = new FormData();
    formData.append('csv', file);
    await api.post(`/projects/${projectId}/upload-bom?replace=true`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const project = await api.get(`/projects/${projectId}`);
    return { data: project.data as { id: string; name?: string; items?: unknown[] } };
  },
  /** Stub: create project from BOM (e.g. from product finder). Use projectApi.create + addItem in practice. */
  createFromBom: (data: { name: string; description?: string; catalogId?: string }) =>
    api.post<{ id: string }>('/projects', data),
};

// ============================================================================
// Project API
// ============================================================================

export const projectApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get<{ projects: any[]; total: number; page: number; limit: number; totalPages: number }>('/projects', { params }),
  
  getById: (id: string) =>
    api.get(`/projects/${id}`),
  
  create: (data: { name: string; description?: string; catalogId?: string }) =>
    api.post('/projects', data),
  
  update: (id: string, data: { name?: string; description?: string; catalogId?: string | null }) =>
    api.patch(`/projects/${id}`, data),

  searchParts: (projectId: string, params: { q: string; limit?: number }) =>
    api.get(`/projects/${projectId}/parts/search`, { params: { q: params.q, limit: params.limit ?? 50 } }),
  
  delete: (id: string) =>
    api.delete(`/projects/${id}`),
  
  addItem: (id: string, item: any) =>
    api.post(`/projects/${id}/items`, item),

  updateItem: (projectId: string, itemId: string, data: { quantity?: number; panelAccessory?: string; notes?: string; partId?: string }) =>
    api.patch(`/projects/${projectId}/items/${itemId}`, data),

  deleteItem: (projectId: string, itemId: string) =>
    api.delete(`/projects/${projectId}/items/${itemId}`),

  getBOMSample: () =>
    api.get('/projects/sample-bom', { responseType: 'blob' }),

  uploadBOM: (id: string, file: File, replace: boolean) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post(`/projects/${id}/upload-bom?replace=${replace}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  submit: (id: string) =>
    api.post(`/projects/${id}/submit`),

  finalize: (id: string) =>
    api.post(`/projects/${id}/finalize`),

  suggestUpgrades: (id: string) =>
    api.get(`/projects/${id}/suggest-upgrades`),

  applyUpgrade: (projectId: string, data: { itemId: string; wagoPartId: string }) =>
    api.post(`/projects/${projectId}/apply-upgrade`, data),

  getReport: (projectId: string) =>
    api.get(`/projects/${projectId}/report`),

  getReportPdf: (projectId: string) =>
    api.get(`/projects/${projectId}/report`, { params: { format: 'pdf' }, responseType: 'blob' }),

  getReportExcel: (projectId: string) =>
    api.get(`/projects/${projectId}/report`, { params: { format: 'xlsx' }, responseType: 'blob' }),

  emailReport: (projectId: string, email: string) =>
    api.post(`/projects/${projectId}/report/email`, { email }),
  
  createRevision: (id: string, changeSummary: string) =>
    api.post(`/projects/${id}/create-revision`, { changeSummary }),
  
  getRevisions: (id: string) =>
    api.get(`/projects/${id}/revisions`),
  convertToProjectBook: (id: string) =>
    api.post(`/projects/${id}/convert-to-project-book`),
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
  sendEmail: (id: string, body?: { to?: string }) =>
    api.post<{ message: string }>(`/quotes/${id}/send`, body ?? {}),
  getSuggestedLiterature: (id: string) => api.get(`/quotes/${id}/literature/suggested`),
  getQuoteLiterature: (id: string) => api.get(`/quotes/${id}/literature`),
  attachLiterature: (id: string, literatureIds: string[]) =>
    api.post(`/quotes/${id}/literature/attach`, { literatureIds }),
};

// ============================================================================
// Literature API
// ============================================================================

export const literatureApi = {
  list: (params?: {
    type?: string;
    partId?: string;
    partNumber?: string;
    seriesName?: string;
    search?: string;
    keyword?: string;
    industryTag?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ items: any[]; total: number }>('/literature', { params }),
  getById: (id: string) => api.get(`/literature/${id}`),
  upload: (formData: FormData) =>
    api.post<{ literature: any; unresolvedParts: string[] }>('/literature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateMetadata: (id: string, data: {
    title?: string;
    description?: string;
    type?: string;
    keywords?: string[];
    industryTags?: string[];
  }) => api.patch(`/literature/${id}`, data),
  updateAssociations: (id: string, data: { partNumbers: string[]; seriesNames: string[] }) =>
    api.patch(`/literature/${id}/associations`, data),
  delete: (id: string) => api.delete(`/literature/${id}`),
  getZipMilestone: () => api.get<{ literature_zip_milestone: number }>('/literature/settings/zip-milestone'),
  updateZipMilestone: (valueBytes: number) =>
    api.put('/literature/settings/zip-milestone', { literature_zip_milestone: valueBytes }),
  exportPdf: () => api.get('/literature/export/pdf', { responseType: 'blob' }),
  exportCsv: () => api.get('/literature/export/csv', { responseType: 'blob' }),
  getSampleCsv: () => api.get('/literature/sample-csv', { responseType: 'blob' }),
  bulkUpdateAssociations: (file: File) => {
    const form = new FormData();
    form.append('csv', file);
    return api.post<{ updated: number; errors: string[] }>('/literature/bulk-update-associations', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ============================================================================
// Literature Kit API
// ============================================================================

export const literatureKitApi = {
  list: () => api.get<{ items: any[]; total: number }>('/literature-kits'),
  create: (data: { name: string; notes?: string }) => api.post<any>('/literature-kits', data),
  getById: (id: string) => api.get<any>(`/literature-kits/${id}`),
  update: (id: string, data: { name?: string; notes?: string }) => api.patch<any>(`/literature-kits/${id}`, data),
  delete: (id: string) => api.delete(`/literature-kits/${id}`),
  addItems: (id: string, literatureIds: string[]) =>
    api.post<any>(`/literature-kits/${id}/items`, { literatureIds }),
  removeItem: (id: string, litId: string) => api.delete(`/literature-kits/${id}/items/${litId}`),
  getZipUrl: (id: string) => `${api.defaults.baseURL}/literature-kits/${id}/zip`,
  getSlipUrl: (id: string) => `${api.defaults.baseURL}/literature-kits/${id}/slip`,
  downloadZip: (id: string) => api.get(`/literature-kits/${id}/zip`, { responseType: 'blob' }),
  downloadSlip: (id: string) => api.get(`/literature-kits/${id}/slip`, { responseType: 'blob' }),
};

// ============================================================================
// Assignments API (ADMIN/RSM/DISTRIBUTOR)
// ============================================================================

export const assignmentsApi = {
  getTree: () => api.get('/assignments/tree'),
  getUsers: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get('/assignments/users', { params }),
  getAssignmentUser: (userId: string) => api.get(`/assignments/users/${userId}`),
  getMyAssignments: () => api.get('/assignments/me'),
  setPrimaryProjectBook: (catalogId: string) => api.patch('/assignments/me/primary', { catalogId }),
  assignCatalogs: (data: { userId?: string; userIds?: string[]; catalogIds: string[]; primaryCatalogId?: string }) =>
    api.post('/assignments/catalogs', data),
  assignContracts: (data: { userId?: string; userIds?: string[]; contractIds: string[] }) =>
    api.post('/assignments/contracts', data),
};

// ============================================================================
// Price Contracts API
// ============================================================================

export const priceContractApi = {
  list: (params?: { view?: string }) => api.get('/price-contracts', { params }),
  getById: (id: string) => api.get(`/price-contracts/${id}`),
  create: (data: { name: string; description?: string; quoteNumber?: string; validFrom?: string; validTo?: string }) =>
    api.post('/price-contracts', data),
  update: (id: string, data: { name?: string; description?: string; quoteNumber?: string; validFrom?: string; validTo?: string }) =>
    api.patch(`/price-contracts/${id}`, data),
  delete: (id: string) => api.delete(`/price-contracts/${id}`),
  downloadCsv: (id: string) => api.get(`/price-contracts/${id}/download-csv`, { responseType: 'blob' }),
  downloadQuoteFamily: (id: string) => api.get(`/price-contracts/${id}/download-quote-family`, { responseType: 'blob' }),
  addItems: (contractId: string, items: Array<{ partId?: string; seriesOrGroup?: string; costPrice: number; suggestedSellPrice?: number; discountPercent?: number; minQuantity?: number; moq?: string }>) =>
    api.post(`/price-contracts/${contractId}/items`, { items }),
  uploadPdf: (contractId: string, formData: FormData) =>
    api.post(`/price-contracts/${contractId}/items/upload-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  bulkSellPrice: (contractId: string, data: { itemIds: string[]; marginPercent?: number; suggestedSellPrice?: number }) =>
    api.post(`/price-contracts/${contractId}/items/bulk-sell-price`, data),
  bulkMoq: (contractId: string, data: { itemIds: string[]; moq: string }) =>
    api.post(`/price-contracts/${contractId}/items/bulk-moq`, data),
  updateMyContractItems: (contractId: string, items: Array<{ id: string; suggestedSellPrice: number | null }>) =>
    api.patch(`/my/contracts/${contractId}/items`, { items }),
  updateItem: (contractId: string, itemId: string, data: { partNumber?: string; costPrice?: number; moq?: string; minQuantity?: number; suggestedSellPrice?: number | null }) =>
    api.patch(`/price-contracts/${contractId}/items/${itemId}`, data),
  removeItem: (contractId: string, itemId: string) =>
    api.delete(`/price-contracts/${contractId}/items/${itemId}`),
};

// ============================================================================
// Customer API
// ============================================================================

export const customerApi = {
  getCompanies: () => api.get('/customers/companies'),
  getAll: (params?: { search?: string; companyName?: string }) => api.get('/customers', { params }),
  create: (data: { name: string; company?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string }) =>
    api.post('/customers', data),
  update: (id: string, data: { name?: string; company?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string }) =>
    api.patch(`/customers/${id}`, data),
  bulkCreate: (customers: Array<{ name: string; company?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string }>) =>
    api.post('/customers/bulk', { customers }),
  delete: (id: string) => api.delete(`/customers/${id}`),
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
// Accounts (Companies) API
// ============================================================================

export const accountsApi = {
  getList: () => api.get('/accounts'),
  create: (data: { name: string; type: 'DISTRIBUTOR' | 'CUSTOMER' }) =>
    api.post('/accounts', data),
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
  assignToAccount: (data: { userId?: string; userIds?: string[]; accountId: string | null }) =>
    api.post('/user-management/assign-to-account', data),
  updateUserRole: (userId: string, role: string) =>
    api.patch(`/user-management/${userId}/role`, { role }),
};

// ============================================================================
// Pricing Contracts API (backend: /cost-tables)
// ============================================================================

export const costTableApi = {
  getAll: () => api.get('/cost-tables'),
  getById: (id: string) => api.get(`/cost-tables/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/cost-tables', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/cost-tables/${id}`, data),
  delete: (id: string) => api.delete(`/cost-tables/${id}`),
  uploadCsv: (formData: FormData) =>
    api.post('/cost-tables/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPdf: (id: string, formData: FormData) =>
    api.post(`/cost-tables/${id}/upload-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadCsv: (id: string) =>
    api.get(`/cost-tables/${id}/download`, { responseType: 'blob' }),
};

// ============================================================================
// Sales Dashboard API (RSM / Admin)
// ============================================================================

export const salesApi = {
  /** year: optional – number to filter one year, or omit for "All years" (combined) */
  getSummary: (rsmId?: string, year?: number | 'all') => {
    const params: { rsmId?: string; year?: string } = {};
    if (rsmId) params.rsmId = rsmId;
    if (year != null && year !== 'all') params.year = String(year);
    return api.get('/sales/summary', { params });
  },
  getRsms: () => api.get('/sales/rsms'),
  upload: (formData: FormData) =>
    api.post('/sales/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  /** Clear data by month (year + month) or entire year (year only). Admin can pass rsmId in params. */
  clearByPeriod: (params: { year: number; month?: number; rsmId?: string }) =>
    api.delete('/sales/by-period', { params }),
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

  // BOM Data Management
  getCrossReferencesSample: () =>
    api.get('/admin/cross-references/sample', { responseType: 'blob' }),
  importCrossReferences: (file: File, replace: boolean) => {
    const form = new FormData();
    form.append('csv', file);
    return api.post(`/admin/cross-references/import?replace=${replace}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  /** MASTER Cross Reference Import: column-mapped rows, replace (wipe) or add/merge */
  importCrossReferencesMaster: (rows: Record<string, unknown>[], replace: boolean) =>
    api.post('/admin/cross-references/import-master', { rows, replace }),
  getNonWagoProductsSample: () =>
    api.get('/admin/non-wago-products/sample', { responseType: 'blob' }),
  importNonWagoProducts: (file: File, replace: boolean) => {
    const form = new FormData();
    form.append('csv', file);
    return api.post(`/admin/non-wago-products/import?replace=${replace}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getFailureReports: (params?: { source?: string; resolved?: string; fromDate?: string; toDate?: string; limit?: number; offset?: number }) =>
    api.get('/admin/failure-reports', { params }),
  resolveFailureReport: (id: string, resolutionNote: string) =>
    api.patch(`/admin/failure-reports/${id}/resolve`, { resolutionNote }),

  getUnmatchedSubmissions: (params?: { fromDate?: string; toDate?: string; source?: string; eventType?: string; userId?: string; status?: string; q?: string; limit?: number; offset?: number }) =>
    api.get('/admin/unmatched-submissions', { params }),
  ackUnmatchedSubmission: (id: string) =>
    api.patch(`/admin/unmatched-submissions/${id}/ack`),

  /** Product inspection: search parts across all catalogs */
  searchParts: (params?: { q?: string; catalogId?: string; limit?: number; offset?: number }) =>
    api.get('/admin/parts/search', { params }),
  /** Update part (admin only; supports all editable Part fields) */
  updatePart: (id: string, data: Record<string, unknown>) =>
    api.patch(`/parts/${id}`, data),
};

// ============================================================================
// Video Library API
// ============================================================================

export const videoLibraryApi = {
  list: (params?: {
    videoType?: string;
    partId?: string;
    partNumber?: string;
    seriesName?: string;
    search?: string;
    keyword?: string;
    industryTag?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ items: any[]; total: number }>('/video-library', { params }),

  getById: (id: string) => api.get<any>(`/video-library/${id}`),

  upload: (formData: FormData) =>
    api.post<{ video: any; unresolvedParts: string[] }>('/video-library', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateMetadata: (id: string, data: {
    title?: string;
    description?: string;
    videoType?: string;
    keywords?: string[];
    industryTags?: string[];
    duration?: number;
  }) => api.patch<any>(`/video-library/${id}`, data),

  updateAssociations: (id: string, data: { partNumbers: string[]; seriesNames: string[] }) =>
    api.patch<{ video: any; unresolvedParts: string[] }>(`/video-library/${id}/associations`, data),

  delete: (id: string) => api.delete(`/video-library/${id}`),

  trackView: (id: string) => api.post(`/video-library/${id}/view`),

  toggleFavorite: (id: string) => api.post<{ favorited: boolean }>(`/video-library/${id}/favorite`),

  getFavorites: (params?: { limit?: number; offset?: number }) =>
    api.get<{ items: any[]; total: number }>('/video-library/me/favorites', { params }),

  getHistory: (params?: { limit?: number }) =>
    api.get<any[]>('/video-library/me/history', { params }),

  getComments: (id: string) => api.get<any[]>(`/video-library/${id}/comments`),

  postComment: (id: string, data: { content: string; parentId?: string }) =>
    api.post<any>(`/video-library/${id}/comments`, data),

  getRelated: (id: string) => api.get<any[]>(`/video-library/${id}/related`),

  // Playlists
  getPlaylists: () => api.get<any[]>('/video-library/playlists'),
  createPlaylist: (data: { name: string; description?: string }) =>
    api.post<any>('/video-library/playlists', data),
  getPlaylist: (playlistId: string) => api.get<any>(`/video-library/playlists/${playlistId}`),
  deletePlaylist: (playlistId: string) => api.delete(`/video-library/playlists/${playlistId}`),
  addToPlaylist: (playlistId: string, videoId: string) =>
    api.post<any>(`/video-library/playlists/${playlistId}/items`, { videoId }),
  removeFromPlaylist: (playlistId: string, videoId: string) =>
    api.delete(`/video-library/playlists/${playlistId}/items/${videoId}`),
  reorderPlaylistItem: (playlistId: string, videoId: string, order: number) =>
    api.patch(`/video-library/playlists/${playlistId}/reorder`, { videoId, order }),

  // Admin
  getAnalytics: () => api.get<any>('/video-library/admin/analytics'),
  exportCsv: () => api.get('/video-library/export/csv', { responseType: 'blob' }),
};

// ============================================================================
// BANNERS (Admin-managed product advertisement images for PDF)
// ============================================================================

export const bannerApi = {
  list: () => api.get<any[]>('/banners'),
  upload: (file: File, label?: string) => {
    const form = new FormData();
    form.append('image', file);
    if (label) form.append('label', label);
    return api.post<any>('/banners', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  update: (id: string, data: { label?: string; active?: boolean; order?: number }) =>
    api.patch<any>(`/banners/${id}`, data),
  remove: (id: string) => api.delete(`/banners/${id}`),
};

// ============================================================================
// APP SETTINGS (Generic thumbnail, global config)
// ============================================================================

export const appSettingsApi = {
  getGenericThumbnail: () => api.get<{ url: string | null }>('/app-settings/generic-thumbnail'),
  uploadGenericThumbnail: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<{ url: string }>('/app-settings/generic-thumbnail', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteGenericThumbnail: () => api.delete('/app-settings/generic-thumbnail'),
};

// ============================================================================
// USER MANAGEMENT EXTRAS
// ============================================================================

export const userAccentApi = {
  setColor: (userId: string, accentColor: string | null) =>
    api.patch<{ id: string; accentColor: string | null }>(`/user-management/${userId}/accent-color`, { accentColor }),
};
