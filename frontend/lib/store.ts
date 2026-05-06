import { create } from 'zustand'
import Cookies from 'js-cookie'
import { authApi, usersApi } from '@/lib/api'

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

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  selectedCity: typeof window !== 'undefined' ? localStorage.getItem('selectedCity') || '' : '',
  selectedDistrict: typeof window !== 'undefined' ? localStorage.getItem('selectedDistrict') || '' : '',

  setUser: (user) => set({ user }),
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
      Cookies.set('accessToken', accessToken, { expires: 1 })
      Cookies.set('refreshToken', refreshToken, { expires: 7 })
      if (user) {
        set({ user, loading: false })
      } else {
        const me = await usersApi.getMe()
        set({ user: me.data.data, loading: false })
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
      Cookies.set('accessToken', accessToken, { expires: 1 })
      Cookies.set('refreshToken', refreshToken, { expires: 7 })
      set({ user, loading: false })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    const refresh = Cookies.get('refreshToken')
    if (refresh) await authApi.logout(refresh).catch(() => {})
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
    set({ user: null })
  },

  fetchMe: async () => {
    const token = Cookies.get('accessToken')
    if (!token) return
    try {
      const { data } = await usersApi.getMe()
      set({ user: data.data })
    } catch {
      Cookies.remove('accessToken')
      Cookies.remove('refreshToken')
      set({ user: null })
    }
  },
}))
