import { useAuthStore } from '@/stores/authStore'

/** Headers for `fetch` (SSE, streams) — reads current access token from the auth store. */
export function bearerHeaders(includeJsonContentType = false): Record<string, string> {
  const h: Record<string, string> = {}
  if (includeJsonContentType) h['Content-Type'] = 'application/json'
  const t = useAuthStore.getState().access_token
  if (t) h.Authorization = `Bearer ${t}`
  return h
}
