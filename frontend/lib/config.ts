const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

export const API_URL = configuredApiUrl || 'https://api.satgo.tr/api'
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '')
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE_URL
