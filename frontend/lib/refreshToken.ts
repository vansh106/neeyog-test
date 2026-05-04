const KEY = 'cpq_refresh_token'

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY)
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, token)
}

export function clearRefreshToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}
