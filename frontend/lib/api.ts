import axios from 'axios'
import { API_URL } from './config'
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from './authCookies'

const TOKEN_REFRESH_BUFFER_MS = 30 * 1000

const shouldClearSession = (error: any) => {
  const status = error?.response?.status
  return status === 401
}

const isPublicAuthPath = (url = '') => {
  const publicAuthPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
  ]
  return publicAuthPaths.some((path) => url.includes(path))
}

const getApiPathname = (url = '') => {
  try {
    const pathname = new URL(url, API_URL).pathname
    return pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  } catch {
    return url.split('?')[0].replace(/^\/api(?=\/|$)/, '') || '/'
  }
}

const isPublicReadPath = (url = '', method = 'get') => {
  if (!['get', 'head', 'options'].includes(method.toLowerCase())) return false

  const pathname = getApiPathname(url)
  if (pathname === '/listings/me' || pathname.startsWith('/custom-fields/admin')) return false

  return (
    pathname === '/listings' ||
    pathname.startsWith('/listings/') ||
    pathname === '/categories' ||
    pathname.startsWith('/categories/') ||
    pathname === '/banners' ||
    pathname.startsWith('/banners/') ||
    pathname === '/custom-fields' ||
    pathname === '/hierarchy' ||
    pathname.startsWith('/hierarchy/') ||
    pathname === '/promotions/packages'
  )
}

const decodeJwtPayload = (token?: string) => {
  if (!token || typeof window === 'undefined') return null

  try {
    const payload = token.split('.')[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    return JSON.parse(window.atob(padded))
  } catch {
    return null
  }
}

const isTokenExpiringSoon = (token?: string) => {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now() + TOKEN_REFRESH_BUFFER_MS
}

const getCurrentAccessToken = () => {
  const token = getAccessToken()
  return token && !isTokenExpiringSoon(token) ? token : null
}

let refreshPromise: Promise<string | null> | null = null

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isTransientApiError = (error: any) => {
  const status = error?.response?.status
  const code = error?.code
  const message = String(error?.message || '').toLowerCase()
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('network error')
  )
}

const retryTransientRequest = async <T,>(request: () => Promise<T>, retries = 2): Promise<T> => {
  let lastError: any
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await request()
    } catch (error: any) {
      lastError = error
      if (!isTransientApiError(error) || attempt >= retries) break
      await sleep(400 * (attempt + 1))
    }
  }
  throw lastError
}

const requestFreshAccessToken = async () => {
  const refreshToken = getRefreshToken()

  try {
    const { data } = await retryTransientRequest(
      () => axios.post(
        `${API_URL}/auth/refresh`,
        refreshToken ? { refreshToken } : {},
        { withCredentials: true, timeout: 15000 },
      ),
    )
    const accessToken = data?.data?.accessToken
    if (!accessToken) return null

    setAuthCookies(accessToken, data?.data?.refreshToken)
    return accessToken as string
  } catch (error: any) {
    if (shouldClearSession(error)) {
      clearAuthCookies()
    }
    return null
  }
}

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = requestFreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export const ensureAccessToken = async () => {
  const token = getAccessToken()
  if (token && !isTokenExpiringSoon(token)) return token

  const refreshToken = getRefreshToken()
  if (!refreshToken) return token || null

  const refreshedToken = await refreshAccessToken()
  return refreshedToken || token || null
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const url = config.url || ''
  const method = config.method || 'get'

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers: any = config.headers
    if (typeof headers?.delete === 'function') headers.delete('Content-Type')
    else if (headers) delete headers['Content-Type']
  }

  if (isPublicAuthPath(url)) return config

  const token = isPublicReadPath(url, method)
    ? getCurrentAccessToken()
    : await ensureAccessToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isPublicAuthPath(original.url || '') &&
      !isPublicReadPath(original.url || '', original.method || 'get')
    ) {
      original._retry = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      clearAuthCookies()
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => retryTransientRequest(() => api.post('/auth/login', d, { timeout: 30000 })),
  logout: (refreshToken?: string) => api.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (d: any) => api.post('/auth/change-password', d),
}

export const listingsApi = {
  getAll: (params?: any) => api.get('/listings', { params }),
  getHomeSections: () => api.get('/listings/home-sections'),
  getMine: (params?: any) => api.get('/listings/me', { params }),
  getOne: (id: string) => api.get(`/listings/${id}`),
  create: (d: any) => api.post('/listings', d),
  createWithImages: (d: FormData, config: any = {}) =>
    api.post('/listings/with-images', d, { timeout: 0, ...config }),
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
  deleteListing: (id: string) => api.delete(`/admin/listings/${id}`),
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
  getAll: (params?: any) => api.get('/categories', { params }),
  getOne: (slug: string) => api.get(`/categories/${slug}`),
  create: (d: any) => api.post('/categories', d),
  update: (id: string | number, d: any) => api.patch(`/categories/${id}`, d),
  delete: (id: string | number) => api.delete(`/categories/${id}`),
  importCsv: (d: any) => api.post('/categories/import', d),
}

export const hierarchyApi = {
  getTree: (group = 'vehicle') => api.get('/hierarchy', { params: { group } }),
  listGroupSettings: () => api.get('/hierarchy/group-settings'),
  getGroupSettings: (group = 'vehicle') => api.get('/hierarchy/group-settings', { params: { group } }),
  updateGroupSettings: (d: any) => api.patch('/hierarchy/group-settings', d),
  create: (d: any) => api.post('/hierarchy', d),
  update: (id: string, d: any) => api.patch(`/hierarchy/${id}`, d),
  delete: (id: string) => api.delete(`/hierarchy/${id}`),
  importCsv: (d: any) => api.post('/hierarchy/import', d),
}

export const customFieldsApi = {
  getForCategory: (category_id: string | number, sub_category_id?: string | number) =>
    api.get('/custom-fields', { params: { category_id, sub_category_id } }),
  adminList: () => api.get('/custom-fields/admin'),
  adminUpsert: (d: any) => api.post('/custom-fields/admin', d),
  adminDelete: (id: string) => api.delete(`/custom-fields/admin/${id}`),
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
  uploadImages: (listingId: string, files: FormData, config: any = {}) =>
    api.post(`/upload/listing-images/${listingId}`, files, { timeout: 0, ...config }),
  deleteImage: (imageId: string) => api.delete(`/upload/listing-images/${imageId}`),
  setPrimary: (imageId: string) => api.patch(`/upload/listing-images/${imageId}/primary`),
}

export const usersApi = {
  getMe: () => api.get('/users/me/profile'),
  updateMe: (d: any) => api.patch('/users/me/profile', d),
  getUser: (id: string) => api.get(`/users/${id}`),
  report: (d: any) => api.post('/users/reports', d),
}
