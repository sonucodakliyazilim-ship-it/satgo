import Cookies from 'js-cookie'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const isSecureBrowser = () => typeof window !== 'undefined' && window.location.protocol === 'https:'
const baseCookieOptions = { path: '/' }

const cookieOptions = (expires?: number) => ({
  ...(expires ? { expires } : {}),
  path: '/',
  sameSite: 'lax' as const,
  secure: isSecureBrowser(),
})

const getStoredToken = (key: string) => {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(key) || undefined
}

const setStoredToken = (key: string, value: string) => {
  if (typeof window !== 'undefined') localStorage.setItem(key, value)
}

const removeStoredToken = (key: string) => {
  if (typeof window !== 'undefined') localStorage.removeItem(key)
}

export const getAccessToken = () => Cookies.get(ACCESS_TOKEN_KEY) || getStoredToken(ACCESS_TOKEN_KEY)
export const getRefreshToken = () => Cookies.get(REFRESH_TOKEN_KEY) || getStoredToken(REFRESH_TOKEN_KEY)
export const hasAuthTokens = () => Boolean(getAccessToken() || getRefreshToken())

export const setAuthCookies = (accessToken: string, refreshToken?: string) => {
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, cookieOptions(1))
  setStoredToken(ACCESS_TOKEN_KEY, accessToken)

  if (refreshToken) {
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, cookieOptions(7))
    setStoredToken(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export const clearAuthCookies = () => {
  Cookies.remove(ACCESS_TOKEN_KEY, cookieOptions())
  Cookies.remove(REFRESH_TOKEN_KEY, cookieOptions())
  Cookies.remove(ACCESS_TOKEN_KEY, baseCookieOptions)
  Cookies.remove(REFRESH_TOKEN_KEY, baseCookieOptions)
  removeStoredToken(ACCESS_TOKEN_KEY)
  removeStoredToken(REFRESH_TOKEN_KEY)

  if (typeof window !== 'undefined') {
    localStorage.removeItem('authUser')
  }
}
