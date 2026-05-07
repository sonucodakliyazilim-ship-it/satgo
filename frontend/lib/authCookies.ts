import Cookies from 'js-cookie'

const isSecureBrowser = () => typeof window !== 'undefined' && window.location.protocol === 'https:'
const baseCookieOptions = { path: '/' }

const cookieOptions = (expires?: number) => ({
  ...(expires ? { expires } : {}),
  path: '/',
  sameSite: 'lax' as const,
  secure: isSecureBrowser(),
})

export const getAccessToken = () => Cookies.get('accessToken')
export const getRefreshToken = () => Cookies.get('refreshToken')
export const hasAuthTokens = () => Boolean(getAccessToken() || getRefreshToken())

export const setAuthCookies = (accessToken: string, refreshToken?: string) => {
  Cookies.set('accessToken', accessToken, cookieOptions(1))

  if (refreshToken) {
    Cookies.set('refreshToken', refreshToken, cookieOptions(7))
  } else {
    Cookies.remove('refreshToken', cookieOptions())
    Cookies.remove('refreshToken', baseCookieOptions)
  }
}

export const clearAuthCookies = () => {
  Cookies.remove('accessToken', cookieOptions())
  Cookies.remove('refreshToken', cookieOptions())
  Cookies.remove('accessToken', baseCookieOptions)
  Cookies.remove('refreshToken', baseCookieOptions)

  if (typeof window !== 'undefined') {
    localStorage.removeItem('authUser')
  }
}
