import axios from 'axios'
import Cookies from 'js-cookie'
import { API_URL } from './config'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = Cookies.get('refreshToken')
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh })
          Cookies.set('accessToken', data.data.accessToken, { expires: 1 })
          Cookies.set('refreshToken', data.data.refreshToken, { expires: 7 })
          original.headers.Authorization = `Bearer ${data.data.accessToken}`
          return api(original)
        } catch {
          Cookies.remove('accessToken')
          Cookies.remove('refreshToken')
          window.location.href = '/giris'
        }
      }
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => api.post('/auth/login', d),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (d: any) => api.post('/auth/change-password', d),
}

export const listingsApi = {
  getAll: (params?: any) => api.get('/listings', { params }),
  getMine: (params?: any) => api.get('/listings/me', { params }),
  getOne: (id: string) => api.get(`/listings/${id}`),
  create: (d: any) => api.post('/listings', d),
  update: (id: string, d: any) => api.patch(`/listings/${id}`, d),
  setStatus: (id: string, status: string) => api.patch(`/listings/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/listings/${id}`),
  getByUser: (userId: string, params?: any) => api.get(`/listings/user/${userId}`, { params }),
}

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params?: any) => api.get('/admin/users', { params }),
  listings: (params?: any) => api.get('/admin/listings', { params }),
  setListingStatus: (id: string, status: string, rejection_reason?: string) =>
    api.patch(`/admin/listings/${id}/status`, { status, rejection_reason }),
  setUserStatus: (id: string, status: string) => api.patch(`/admin/users/${id}/status`, { status }),
  reports: (params?: any) => api.get('/admin/reports', { params }),
  resolveReport: (id: string, data: any) => api.patch(`/admin/reports/${id}`, data),
  paymentSettings: () => api.get('/admin/payment-settings'),
  updatePaymentSettings: (d: any) => api.patch('/admin/payment-settings', d),
  promotionOrders: (params?: any) => api.get('/admin/promotion-orders', { params }),
  approvePromotionOrder: (id: string, admin_note?: string) =>
    api.patch(`/admin/promotion-orders/${id}/approve`, { admin_note }),
  rejectPromotionOrder: (id: string, admin_note?: string) =>
    api.patch(`/admin/promotion-orders/${id}/reject`, { admin_note }),
  promotions: () => api.get('/admin/promotions'),
  banners: () => api.get('/admin/banners'),
  createBanner: (d: FormData) => api.post('/admin/banners', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateBanner: (id: string, d: FormData) => api.patch(`/admin/banners/${id}`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteBanner: (id: string) => api.delete(`/admin/banners/${id}`),
}

export const bannersApi = {
  getAll: (params?: any) => api.get('/banners', { params }),
}

export const categoriesApi = {
  getAll: () => api.get('/categories'),
  getOne: (slug: string) => api.get(`/categories/${slug}`),
}

export const favoritesApi = {
  getAll: () => api.get('/favorites'),
  add: (id: string) => api.post(`/favorites/${id}`),
  remove: (id: string) => api.delete(`/favorites/${id}`),
  check: (id: string) => api.get(`/favorites/check/${id}`),
}

export const messagesApi = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (convId: string) => api.get(`/messages/conversations/${convId}`),
  send: (d: any) => api.post('/messages', d),
}

export const promotionsApi = {
  getPackages: () => api.get('/promotions/packages'),
  getMy: () => api.get('/promotions/my'),
  getOrder: (id: string) => api.get(`/promotions/orders/${id}`),
  purchase: (d: any) => api.post('/promotions/purchase', d),
}

export const uploadApi = {
  uploadImages: (listingId: string, files: FormData) =>
    api.post(`/upload/listing-images/${listingId}`, files, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImage: (imageId: string) => api.delete(`/upload/listing-images/${imageId}`),
  setPrimary: (imageId: string) => api.patch(`/upload/listing-images/${imageId}/primary`),
}

export const usersApi = {
  getMe: () => api.get('/users/me/profile'),
  updateMe: (d: any) => api.patch('/users/me/profile', d),
  getUser: (id: string) => api.get(`/users/${id}`),
  report: (d: any) => api.post('/users/reports', d),
}
