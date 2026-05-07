import { API_BASE_URL } from './config'

export function mediaUrl(path?: string | null) {
  if (!path) return null
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
