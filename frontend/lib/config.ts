export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '')
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE_URL
