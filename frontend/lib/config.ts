const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

/** Ensures requests hit …/api/auth/… — common misconfig is base host without /api. */
function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    let path = u.pathname.replace(/\/+$/, '')
    if (path.endsWith('/api') || path.includes('/api/')) {
      return `${u.origin}${path}`
    }
    path = path ? `${path}/api` : '/api'
    return `${u.origin}${path}`
  } catch {
    const base = trimmed.replace(/\/+$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
}

export const API_URL = configuredApiUrl ? normalizeApiUrl(configuredApiUrl) : 'https://api.satgo.tr/api'
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '')
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE_URL
