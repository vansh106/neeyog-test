import axios, { type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '@/stores/authStore'
import { getRefreshToken, setRefreshToken } from '@/lib/refreshToken'

import { bearerHeaders } from '@/lib/bearer'
import { apiBaseURL } from '@/lib/apiBase'

export { apiBaseURL } from '@/lib/apiBase'

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshPromise: Promise<string | null> | null = null

/** Shared by axios 401 retry and SSE `fetch` (EventSource cannot refresh). */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  const rt = getRefreshToken()
  if (!rt) return Promise.resolve(null)
  const refreshUrl = apiBaseURL() ? `${apiBaseURL()}/api/auth/refresh` : '/api/auth/refresh'
  refreshPromise = axios
    .post<{ access_token?: string; refresh_token?: string }>(refreshUrl, { refresh_token: rt }, {
      headers: { 'Content-Type': 'application/json' },
    })
    .then(async ({ data }) => {
      if (data.access_token) {
        useAuthStore.getState().updateToken(data.access_token)
        if (data.refresh_token) setRefreshToken(data.refresh_token)
        try {
          const me = await get<{
            id: string
            email: string
            full_name: string
            tier: string
            job_title: string | null
            permissions: string[]
          }>('/api/auth/me')
          const prev = useAuthStore.getState().user
          if (prev && me) {
            useAuthStore.getState().setUser({
              ...prev,
              id: me.id,
              email: me.email,
              full_name: me.full_name,
              tier: me.tier,
              job_title: me.job_title,
              permissions: me.permissions,
            })
          }
        } catch {
          /* ignore — token is still valid */
        }
        return data.access_token
      }
      return null
    })
    .catch(() => {
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return null
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

function formatHttpDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: string }).message)
  }
  try {
    return JSON.stringify(detail)
  } catch {
    return 'Request failed'
  }
}

const api = axios.create({
  baseURL: apiBaseURL(),
  timeout: 180000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const base = apiBaseURL()
  if (base) config.baseURL = base
  const token = useAuthStore.getState().access_token
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData && config.headers && typeof config.headers.delete === 'function') {
    config.headers.delete('Content-Type')
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config as RetryConfig | undefined
    if (error.response && original) {
      const status = error.response.status
      const url = String(original.url || '')

      if (status === 401 && !original._retry && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh')) {
        original._retry = true
        const newTok = await refreshAccessToken()
        if (newTok) {
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${newTok}`
          return api.request(original)
        }
      }

      if (status === 422) {
        const detail = error.response.data?.detail
        const msg = Array.isArray(detail)
          ? detail.map((e: { msg: string }) => e.msg).join(', ')
          : typeof detail === 'string'
            ? detail
            : 'Validation error'
        throw new Error(msg)
      }
      if (status >= 500) {
        throw new Error('Server error — check API logs')
      }
      throw new Error(formatHttpDetail(error.response.data?.detail) || `Request failed (${status})`)
    }
    throw new Error('Cannot reach API on localhost:8000')
  },
)

function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return api.get(url, { params }) as unknown as Promise<T>
}

function post<T>(url: string, data?: unknown): Promise<T> {
  return api.post(url, data) as unknown as Promise<T>
}

function patch<T>(url: string, data?: unknown): Promise<T> {
  return api.patch(url, data) as unknown as Promise<T>
}

function postFormData<T>(url: string, formData: FormData): Promise<T> {
  return api.post(url, formData) as unknown as Promise<T>
}

export const enquiriesApi = {
  uploadEmail: <T = unknown>(emailText: string, inputType: string = 'email') =>
    post<T>('/api/enquiries/upload-email', { email_text: emailText, input_type: inputType }),
  processEmailMatcher: <T = unknown>(enquiryId: string) =>
    post<T>(`/api/enquiries/${encodeURIComponent(enquiryId)}/process-matcher`, {}),
  getRevertRequestDraft: <T = unknown>(enquiryId: string) =>
    get<T>(`/api/enquiries/${encodeURIComponent(enquiryId)}/revert-request-draft`),
  getEnquiry: <T = unknown>(id: string) => get<T>(`/api/enquiries/${id}`),
  listEnquiries: <T = unknown>(
    params?: {
      status?: string
      flow_type?: string
      company_id?: string
      limit?: number
      offset?: number
    },
  ) => get<T>('/api/enquiries/', params as Record<string, unknown>),
  listEmailInbox: <T = unknown>(params?: {
    status?: string
    limit?: number
    offset?: number
    mailbox_id?: string
  }) => get<T>('/api/enquiries/emails/inbox', params as Record<string, unknown>),
  getHITLState: <T = unknown>(enquiryId: string) => get<T>(`/api/enquiries/${enquiryId}/hitl-state`),
  submitReview: <T = unknown>(enquiryId: string, body: { decision: string; edited_email?: string; human_prompt?: string }) =>
    post<T>(`/api/enquiries/${enquiryId}/review`, body),
  searchClients: <T = unknown>(q?: string) =>
    get<T>('/api/enquiries/clients/search', q ? { q } : undefined),
}

export const quotationsApi = {
  getQuotation: <T = unknown>(id: string) => get<T>(`/api/quotations/${id}`),
  updateLineItems: <T = unknown>(id: string, body: { lineItems: unknown[] }) =>
    patch<T>(`/api/quotations/${id}`, body),
  getAudit: <T = unknown>(id: string, limit: number = 25) =>
    get<T>(`/api/quotations/${id}/audit`, { limit }),
  listQuotations: <T = unknown>(params?: { limit?: number; offset?: number }) =>
    get<T>('/api/quotations/', params as Record<string, unknown>),
  getQuoteHistory: <T = unknown>(
    params: {
      category: string
      catalog_table?: string
      catalog_row_id?: string
      limit?: number
      offset?: number
    } & Partial<{
      variant_type: string
      construction: string
      valve_size: string
      end_connection: string
      pressure: string
      body: string
      ball_disc: string
      stem: string
      seat: string
    }>,
  ) => get<T>('/api/quotations/history', params as Record<string, unknown>),
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
  postCascadeRows: <T = unknown>(body: { category: string; filters: Record<string, string>; limit?: number }) =>
    post<T>('/api/masters/products/cascade-rows', body),
}

export const clientsApi = {
  searchCompanies: (search?: string, limit = 80) =>
    get<import('@/types').CompanyResponse[]>('/api/clients/', {
      ...(search ? { search } : {}),
      limit,
    }),
  getCompany: (companyId: string) =>
    get<import('@/types').CompanyResponse>(`/api/clients/${companyId}`),
  createCompany: (data: import('@/types').CreateCompanyRequestPayload) =>
    post<import('@/types').CompanyResponse>('/api/clients/', data),
  updateCompany: (companyId: string, data: Partial<import('@/types').CreateCompanyRequestPayload>) =>
    patch<import('@/types').CompanyResponse>(`/api/clients/${companyId}`, data),
  addBranch: (companyId: string, data: import('@/types').AddBranchRequestPayload) =>
    post<import('@/types').BranchResponse>(`/api/clients/${companyId}/branches`, data),
  updateBranch: (
    companyId: string,
    branchId: string,
    data: Partial<import('@/types').AddBranchRequestPayload & { is_active?: boolean }>,
  ) => patch<import('@/types').BranchResponse>(`/api/clients/${companyId}/branches/${branchId}`, data),
  deactivateBranch: (companyId: string, branchId: string) =>
    patch<import('@/types').BranchResponse>(
      `/api/clients/${companyId}/branches/${branchId}/deactivate`,
      {},
    ),
}

export const suppliersApi = {
  getSuppliers: (activeOnly = false) =>
    get<import('@/types').SupplierResponse[]>('/api/suppliers/', { active_only: activeOnly }),
  createSupplier: (data: {
    name: string
    primary_category_key?: string
    margin_multiplier?: number | null
    supplier_discount_pct?: number | null
    contact_person?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    notes?: string | null
  }) => post<import('@/types').SupplierResponse>('/api/suppliers/', data),
  updateSupplier: (
    id: string,
    data: Partial<{
      name: string
      primary_category_key: string
      contact_person: string | null
      phone: string | null
      email: string | null
      address: string | null
      notes: string | null
    }>,
  ) => patch<import('@/types').SupplierResponse>(`/api/suppliers/${id}`, data),
  setPreferred: (id: string) => patch<import('@/types').SupplierResponse>(`/api/suppliers/${id}/preferred`, {}),
  deactivate: (id: string) => patch<import('@/types').SupplierResponse>(`/api/suppliers/${id}/deactivate`, {}),
  getSupplierPrices: (supplierId: string, catalogTable?: string) =>
    get<import('@/types').SupplierPriceRow[]>(
      `/api/suppliers/${supplierId}/prices`,
      catalogTable ? { catalog_table: catalogTable } : undefined,
    ),
  listCategoryPricing: (supplierId: string) =>
    get<import('@/types').SupplierCategoryPricing[]>(`/api/suppliers/${supplierId}/category-pricing`),
  getResolvedCategoryPricing: (supplierId: string, categoryKey: string) =>
    get<import('@/types').ResolvedSupplierCategoryPricing>(
      `/api/suppliers/${supplierId}/category-pricing/${categoryKey}`,
    ),
  upsertCategoryPricing: (
    supplierId: string,
    categoryKey: string,
    data: Partial<{
      margin_multiplier: number | null
      supplier_discount_pct: number | null
    }>,
  ) =>
    patch<import('@/types').SupplierCategoryPricing>(
      `/api/suppliers/${supplierId}/category-pricing/${categoryKey}`,
      data,
    ),
  upsertPrice: (
    supplierId: string,
    data: {
      catalog_table: string
      catalog_row_id: string
      list_price_inr: number
      discount_pct_override?: number | null
    },
  ) => post<import('@/types').SupplierPriceRow>(`/api/suppliers/${supplierId}/prices`, data),
  bulkUpsertPrices: (
    supplierId: string,
    prices: Array<{
      catalog_table: string
      catalog_row_id: string
      list_price_inr: number
      discount_pct_override?: number | null
    }>,
  ) => post<{ created: number; updated: number; failed: number }>(`/api/suppliers/${supplierId}/prices/bulk`, {
    prices,
  }),
  getProductPrice: async (
    supplierId: string,
    catalogTable: string,
    catalogRowId: string,
  ): Promise<import('@/types').SupplierPriceRow | null> => {
    try {
      return await get<import('@/types').SupplierPriceRow>(
        `/api/suppliers/${supplierId}/prices/${catalogTable}/${catalogRowId}`,
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/404|not found/i.test(msg)) return null
      throw e
    }
  },
  // pricing-config endpoints deprecated (client-level pricing removed)
  calculatePrice: (data: {
    list_price: number
    supplier_discount_pct: number
    margin_multiplier: number
    customer_discount_pct: number
    quantity?: number
  }) => post<import('@/types').PriceCalculationResult>('/api/suppliers/calculate-price', data),

  previewPricelist: (
    supplierId: string,
    catalogTable: string,
    columnMap: Record<string, string>,
    file: File,
  ) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('catalog_table', catalogTable)
    fd.append('column_map', JSON.stringify(columnMap))
    return postFormData<import('@/types').PreviewResult>(
      `/api/suppliers/${supplierId}/preview-pricelist`,
      fd,
    )
  },

  importPricelist: (
    supplierId: string,
    catalogTable: string,
    columnMap: Record<string, string>,
    file: File,
  ) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('catalog_table', catalogTable)
    fd.append('column_map', JSON.stringify(columnMap))
    return postFormData<import('@/types').ImportResult>(
      `/api/suppliers/${supplierId}/import-pricelist`,
      fd,
    )
  },
}

export const systemApi = {
  health: <T = unknown>() => get<T>('/health'),
}

export const configuratorApi = {
  getValveTypes: <T = unknown>() => get<T>('/api/configurator/valve-types'),

  getValveOptions: <T = unknown>(
    valve_type: string,
    field: string,
    filters: Record<string, string>,
  ) =>
    get<T>('/api/configurator/valve-options', {
      valve_type,
      field,
      filters: JSON.stringify(filters || {}),
    }),

  resolveValve: <T = unknown>(params: Record<string, string>) =>
    get<T>('/api/configurator/resolve-valve', params),

  getOperators: <T = unknown>(
    valve_type: string,
    construction: string,
    valve_size: string,
    category?: string | null,
  ) =>
    get<T>('/api/configurator/operators', {
      valve_type,
      construction,
      valve_size,
      ...(category ? { category } : {}),
    }),

  getAccessories: <T = unknown>() => get<T>('/api/configurator/accessories'),

  calculatePrice: <T = unknown>(body: {
    valve_price: number | null
    operator_type: string
    operator_price: number | null
    sov_price: number | null
    lsb_price: number | null
    positioner_price: number | null
    bracket_price: number | null
  }) => post<T>('/api/configurator/calculate-price', body),

  /** Full valve sheet for client-side cascades (one request per valve type per session). */
  getFullCatalog: <T = unknown>(valveType: string) =>
    get<T>('/api/configurator/full-catalog', { valve_type: valveType }),

  /** Full masters sheet for client-side cascades (one request per category per session). */
  getFullCategoryCatalog: <T = unknown>(category: string) =>
    get<T>('/api/configurator/full-category-catalog', { category }),
}

export const syncApi = {
  getStatus: <T = unknown>() => get<T>('/api/sync/status'),
  triggerNow: <T = unknown>(body?: { mailbox_id?: string | null }) =>
    post<T>('/api/sync/trigger', body ?? {}),
  getHistory: <T = unknown>(limit?: number) =>
    get<T>('/api/sync/history', limit != null ? { limit } : undefined),
}

export const mailboxesApi = {
  list: <T = unknown[]>() => get<T>('/api/mailboxes/'),
  create: <T = unknown>(body: {
    display_name: string
    email_address: string
    imap_host?: string
    imap_port?: number
    imap_folder?: string
    unread_only?: boolean
    app_password: string
  }) => post<T>('/api/mailboxes/', body),
  update: <T = unknown>(
    id: string,
    body: Partial<{
      display_name: string
      imap_host: string
      imap_port: number
      imap_folder: string
      unread_only: boolean
      is_active: boolean
      app_password: string
    }>,
  ) => patch<T>(`/api/mailboxes/${id}`, body),
  deactivate: (id: string) => post<unknown>(`/api/mailboxes/${id}/deactivate`, {}),
  testConnection: <T = { ok: boolean; message?: string }>(id: string) =>
    post<T>(`/api/mailboxes/${id}/test-connection`, {}),
}

export const usersApi = {
  permissionGroups: <T = Record<string, string[]>>() => get<T>('/api/users/permission-groups'),
  permissionPresets: <T = Record<string, string[]>>() => get<T>('/api/users/permission-presets'),
  list: <T = unknown[]>(includeInactive?: boolean) =>
    get<T>('/api/users/', includeInactive ? ({ include_inactive: true } as Record<string, unknown>) : undefined),
  getUser: <T = unknown>(id: string) => get<T>(`/api/users/${id}`),
  create: <T = { user: unknown; temp_password: string }>(body: {
    email: string
    full_name: string
    job_title?: string | null
    tier: string
    permissions: string[]
    mailbox_access?: Array<{
      mailbox_id: string
      can_view?: boolean
      can_process?: boolean
      can_trigger_sync?: boolean
    }>
  }) => post<T>('/api/users/', body),
  updatePermissions: <T = unknown>(id: string, permissions: string[]) =>
    patch<T>(`/api/users/${id}/permissions`, { permissions }),
  updateMailboxAccess: <T = unknown>(
    id: string,
    access: Array<{ mailbox_id: string; can_view: boolean; can_process: boolean; can_trigger_sync: boolean }>,
  ) => patch<T>(`/api/users/${id}/mailbox-access`, { access }),
  deactivate: (id: string) => patch<unknown>(`/api/users/${id}/deactivate`, {}),
  reactivate: (id: string) => patch<unknown>(`/api/users/${id}/reactivate`, {}),
  resetPassword: <T = { message: string; temp_password: string }>(id: string) =>
    post<T>(`/api/users/${id}/reset-password`, {}),
}

export async function changePasswordApi(
  old_password: string,
  new_password: string,
): Promise<{ message?: string }> {
  return post<{ message?: string }>('/api/auth/change-password', { old_password, new_password })
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
  const doFetch = () =>
    fetch(uploadEmailStreamUrl(), {
      method: 'POST',
      headers: { ...bearerHeaders(true) },
      body: JSON.stringify({ email_text: emailText, input_type: inputType }),
      cache: 'no-store',
    })

  let response = await doFetch()
  if (response.status === 401) {
    await refreshAccessToken()
    response = await doFetch()
  }

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

export async function processManualDropdown(body: import('@/types').ManualEnquiryForm): Promise<import('@/types').EnquiryResponse> {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/enquiries/manual/process` : '/api/enquiries/manual/process'
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...bearerHeaders(true) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return (await res.json()) as import('@/types').EnquiryResponse
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
    headers: { ...bearerHeaders(true) },
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
    headers: { ...bearerHeaders(true) },
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
