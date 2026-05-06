import { create } from 'zustand'
import { authApi, usersApi } from '@/lib/api'
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from '@/lib/authCookies'

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
  if (typeof window === 'undefined' || !getAccessToken()) return null

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
  return status === 401 || status === 403
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: getStoredUser(),
  loading: false,
  authReady: typeof window !== 'undefined' && !getAccessToken(),
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
      const { user, accessToken, refreshToken } = data.data
      setAuthCookies(accessToken, refreshToken)
      persistUser(user)
      if (user) {
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
      const { user, accessToken, refreshToken } = data.data
      setAuthCookies(accessToken, refreshToken)
      persistUser(user)
      set({ user, loading: false, authReady: true })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    const refresh = getRefreshToken()
    if (refresh) await authApi.logout(refresh).catch(() => {})
    clearAuthCookies()
    persistUser(null)
    set({ user: null, authReady: true })
  },

  fetchMe: async () => {
    const token = getAccessToken()
    if (!token) {
      persistUser(null)
      set({ user: null, authReady: true })
      return
    }

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
