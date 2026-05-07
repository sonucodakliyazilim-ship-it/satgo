import { create } from 'zustand'
import { authApi, ensureAccessToken, usersApi } from '@/lib/api'
import { clearAuthCookies, getRefreshToken, hasAuthTokens, setAuthCookies } from '@/lib/authCookies'

interface User {
  id: string
  name: string
  email: string
  role: string
  avatar_url?: string
  city?: string
}

interface AuthStore {
  user: User | null
  loading: boolean
  authReady: boolean
  selectedCity: string
  selectedDistrict: string
  setUser: (user: User | null) => void
  setSelectedLocation: (city: string, district?: string) => void
  setSelectedCity: (city: string) => void
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

const getStoredUser = () => {
  if (typeof window === 'undefined' || !hasAuthTokens()) return null

  try {
    return JSON.parse(localStorage.getItem('authUser') || 'null') as User | null
  } catch {
    localStorage.removeItem('authUser')
    return null
  }
}

const persistUser = (user: User | null) => {
  if (typeof window === 'undefined') return

  if (user) localStorage.setItem('authUser', JSON.stringify(user))
  else localStorage.removeItem('authUser')
}

const shouldClearSession = (error: any) => {
  const status = error?.response?.status
  return status === 401
}

const getAuthData = (data: any) => data?.data || data || {}
const getAuthTokens = (data: any) => {
  const authData = getAuthData(data)
  return {
    accessToken: authData.accessToken || authData.token || authData.access_token,
    refreshToken: authData.refreshToken || authData.refresh_token,
    user: authData.user,
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: getStoredUser(),
  loading: false,
  authReady: false,
  selectedCity: typeof window !== 'undefined' ? localStorage.getItem('selectedCity') || '' : '',
  selectedDistrict: typeof window !== 'undefined' ? localStorage.getItem('selectedDistrict') || '' : '',

  setUser: (user) => {
    persistUser(user)
    set({ user })
  },
  setSelectedLocation: (city, district = '') => {
    if (typeof window !== 'undefined') {
      if (city) localStorage.setItem('selectedCity', city)
      else localStorage.removeItem('selectedCity')
      if (district) localStorage.setItem('selectedDistrict', district)
      else localStorage.removeItem('selectedDistrict')
    }
    set({ selectedCity: city, selectedDistrict: district })
  },
  setSelectedCity: (city) => set((state) => {
    if (typeof window !== 'undefined') {
      if (city) localStorage.setItem('selectedCity', city)
      else localStorage.removeItem('selectedCity')
      localStorage.removeItem('selectedDistrict')
    }
    return { selectedCity: city, selectedDistrict: '' }
  }),

  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await authApi.login({ email, password })
      const { user, accessToken, refreshToken } = getAuthTokens(data)
      if (accessToken) setAuthCookies(accessToken, refreshToken)
      if (user) {
        persistUser(user)
        set({ user, loading: false, authReady: true })
      } else {
        const me = await usersApi.getMe()
        persistUser(me.data.data)
        set({ user: me.data.data, loading: false, authReady: true })
      }
    } finally {
      set({ loading: false })
    }
  },

  register: async (formData) => {
    set({ loading: true })
    try {
      const payload = {
        ...formData,
        phone: formData.phone?.trim() || undefined,
      }
      const { data } = await authApi.register(payload)
      const { user, accessToken, refreshToken } = getAuthTokens(data)
      if (accessToken) setAuthCookies(accessToken, refreshToken)
      const currentUser = user || (await usersApi.getMe()).data.data
      persistUser(currentUser)
      set({ user: currentUser, loading: false, authReady: true })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    const refresh = getRefreshToken()
    await authApi.logout(refresh).catch(() => {})
    clearAuthCookies()
    persistUser(null)
    set({ user: null, authReady: true })
  },

  fetchMe: async () => {
    await ensureAccessToken()

    try {
      const { data } = await usersApi.getMe()
      persistUser(data.data)
      set({ user: data.data })
    } catch (error: any) {
      if (shouldClearSession(error)) {
        clearAuthCookies()
        persistUser(null)
        set({ user: null })
      }
    } finally {
      set({ authReady: true })
    }
  },
}))
