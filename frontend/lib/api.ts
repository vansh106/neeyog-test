import axios from 'axios'

export function apiBaseURL(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '')
}

const api = axios.create({
  baseURL: apiBaseURL(),
  timeout: 180000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const status = error.response.status
      if (status === 422) {
        const detail = error.response.data?.detail
        const msg = Array.isArray(detail)
          ? detail.map((e: { msg: string }) => e.msg).join(', ')
          : typeof detail === 'string' ? detail : 'Validation error'
        throw new Error(msg)
      }
      if (status >= 500) {
        throw new Error('Server error — check API logs')
      }
      throw new Error(error.response.data?.detail || `Request failed (${status})`)
    }
    throw new Error('Cannot reach API on localhost:8000')
  }
)

function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return api.get(url, { params }) as unknown as Promise<T>
}

function post<T>(url: string, data?: unknown): Promise<T> {
  return api.post(url, data) as unknown as Promise<T>
}

export const enquiriesApi = {
  uploadEmail: <T = unknown>(emailText: string, inputType: string = 'email') =>
    post<T>('/api/enquiries/upload-email', { email_text: emailText, input_type: inputType }),
  getEnquiry: <T = unknown>(id: string) => get<T>(`/api/enquiries/${id}`),
  listEnquiries: <T = unknown>(params?: { status?: string; flow_type?: string; limit?: number; offset?: number }) =>
    get<T>('/api/enquiries/', params as Record<string, unknown>),
  listEmailInbox: <T = unknown>(params?: { status?: string; limit?: number; offset?: number }) =>
    get<T>('/api/enquiries/emails/inbox', params as Record<string, unknown>),
  getHITLState: <T = unknown>(enquiryId: string) => get<T>(`/api/enquiries/${enquiryId}/hitl-state`),
  submitReview: <T = unknown>(enquiryId: string, body: { decision: string; edited_email?: string; human_prompt?: string }) =>
    post<T>(`/api/enquiries/${enquiryId}/review`, body),
  searchClients: <T = unknown>(q?: string) =>
    get<T>('/api/enquiries/clients/search', q ? { q } : undefined),
}

export const quotationsApi = {
  getQuotation: <T = unknown>(id: string) => get<T>(`/api/quotations/${id}`),
  listQuotations: <T = unknown>(params?: { limit?: number; offset?: number }) =>
    get<T>('/api/quotations/', params as Record<string, unknown>),
  getPdfUrl: (id: string) => {
    const base = apiBaseURL()
    return `${base}/api/quotations/${id}/pdf`
  },
}

export const mastersApi = {
  listProducts: <T = unknown>(params?: { category?: string }) =>
    get<T>('/api/masters/products', params as Record<string, unknown>),
  getClientConfig: <T = unknown>() => get<T>('/api/masters/client-config'),
  listSheetRows: <T = unknown>(sheet: string, params?: { skip?: number; limit?: number }) =>
    get<T>(`/api/masters/sheets/${sheet}/rows`, params as Record<string, unknown>),
  getClientsForDropdown: <T = unknown>(search?: string) =>
    get<T>('/api/masters/clients', search ? { search } : undefined),
  /** Prefer /api/masters/categories — avoids /products/{id} route shadowing on older API builds. */
  getCategories: <T = unknown>() => get<T>('/api/masters/categories'),
  getSubcategories: <T = unknown>(category: string) =>
    get<T>('/api/masters/products/subcategories', { category }),
  getProductsForSize: <T = unknown>(category: string, subcategory?: string) =>
    get<T>('/api/masters/products/sizes', subcategory ? { category, subcategory } : { category }),
  getMaterials: <T = unknown>(category: string) =>
    get<T>('/api/masters/products/materials', { category }),
  getCascadeSchema: <T = unknown>(category: string) =>
    get<T>('/api/masters/products/cascade-schema', { category }),
  postCascadeValues: <T = unknown>(body: { category: string; field: string; filters: Record<string, string> }) =>
    post<T>('/api/masters/products/cascade-values', body),
  postCascadeMatch: <T = unknown>(body: { category: string; filters: Record<string, string> }) =>
    post<T>('/api/masters/products/cascade-match', body),
}

export const systemApi = {
  health: <T = unknown>() => get<T>('/health'),
}

export const syncApi = {
  getStatus: <T = unknown>() => get<T>('/api/sync/status'),
  triggerNow: <T = unknown>() => post<T>('/api/sync/trigger'),
  getHistory: <T = unknown>(limit?: number) =>
    get<T>('/api/sync/history', limit != null ? { limit } : undefined),
}

/**
 * URL for SSE upload. Next.js rewrites buffer the full response, so the browser
 * must call the API origin directly when NEXT_PUBLIC_API_URL is set (e.g. http://localhost:8000).
 */
export function uploadEmailStreamUrl(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  if (base) return `${base}/api/enquiries/upload-email-stream`
  return '/api/enquiries/upload-email-stream'
}

export async function uploadEmailStream(
  emailText: string,
  inputType: string = 'email',
  onEvent: (event: import('@/types').AgentEvent) => void,
): Promise<void> {
  const response = await fetch(uploadEmailStreamUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_text: emailText, input_type: inputType }),
    cache: 'no-store',
  })

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const jsonStr = line.slice(5).trim()
      if (!jsonStr) continue
      try {
        const event = JSON.parse(jsonStr)
        onEvent(event)
        if (event.type === 'stream_end') return
      } catch {
        /* malformed JSON — skip */
      }
    }
  }
}

function sseStreamBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
}

export async function submitReviewStream(
  enquiryId: string,
  body: { decision: string; edited_email?: string; human_prompt?: string },
  onEvent: (event: import('@/types').AgentEvent) => void,
): Promise<void> {
  const base = sseStreamBaseUrl()
  const url = base
    ? `${base}/api/enquiries/${enquiryId}/review-stream`
    : `/api/enquiries/${enquiryId}/review-stream`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const jsonStr = line.slice(5).trim()
      if (!jsonStr) continue
      try {
        const event = JSON.parse(jsonStr)
        onEvent(event)
        if (event.type === 'stream_end') return
      } catch {
        /* malformed JSON — skip */
      }
    }
  }
}

export async function clientVerifyStream(
  enquiryId: string,
  body: { decision: string; selected_client_id?: string | null },
  onEvent: (event: import('@/types').AgentEvent) => void,
): Promise<void> {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  const url = base
    ? `${base}/api/enquiries/${enquiryId}/client-verify-stream`
    : `/api/enquiries/${enquiryId}/client-verify-stream`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const jsonStr = line.slice(5).trim()
      if (!jsonStr) continue
      try {
        const event = JSON.parse(jsonStr)
        onEvent(event)
        if (event.type === 'stream_end') return
      } catch {
        /* malformed JSON — skip */
      }
    }
  }
}

export function erpExportUrl(enquiryId: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  if (base) return `${base}/api/enquiries/${enquiryId}/erp-export`
  return `/api/enquiries/${enquiryId}/erp-export`
}

export default api
