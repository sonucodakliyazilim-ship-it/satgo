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
  /** Call once on client after mount — avoids SSR/localStorage hydration mismatch */
  hydrateFromClientStorage: () => void
  setUser: (user: User | null) => void
  setSelectedLocation: (city: string, district?: string) => void
  setSelectedCity: (city: string) => void
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
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
  user: null,
  loading: false,
  authReady: false,
  selectedCity: '',
  selectedDistrict: '',

  hydrateFromClientStorage: () => {
    if (typeof window === 'undefined') return

    set({
      selectedCity: localStorage.getItem('selectedCity') || '',
      selectedDistrict: localStorage.getItem('selectedDistrict') || '',
    })

    try {
      if (!hasAuthTokens()) return
      const raw = localStorage.getItem('authUser')
      if (!raw) return
      const parsed = JSON.parse(raw) as User | null
      if (parsed && typeof parsed === 'object' && parsed.id) {
        set({ user: parsed })
      }
    } catch {
      localStorage.removeItem('authUser')
    }
  },

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
        try {
          const me = await usersApi.getMe()
          const nextUser = me?.data?.data ?? null
          persistUser(nextUser)
          set({ user: nextUser, loading: false, authReady: true })
        } catch (inner: any) {
          clearAuthCookies()
          persistUser(null)
          const msg =
            inner?.response?.data?.message ||
            'Giriş yanıtı alındı ancak profil doğrulanamadı. Tekrar deneyin.'
          throw Object.assign(new Error(msg), { response: inner?.response })
        }
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
      const meRes = user ? null : await usersApi.getMe().catch(() => null)
      const currentUser = user || meRes?.data?.data || null
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
      const nextUser = data?.data ?? null
      if (nextUser) persistUser(nextUser)
      else persistUser(null)
      set({ user: nextUser })
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
