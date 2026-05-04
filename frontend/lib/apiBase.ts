/** API origin for axios and `fetch` (empty = same-origin + Next rewrites). */
export function apiBaseURL(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '')
}
