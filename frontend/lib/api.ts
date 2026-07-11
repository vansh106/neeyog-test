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
            phone?: string | null
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
              phone: me.phone ?? null,
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
    const base = apiBaseURL()
    const axiosMsg = error instanceof Error ? error.message : String(error)
    const code = (error as { code?: string })?.code
    const via = base
      ? `Calling API directly at ${base} (NEXT_PUBLIC_API_URL).`
      : 'Using same-origin /api (Next.js rewrites → BACKEND_INTERNAL_URL / 127.0.0.1:8000).'
    const hint =
      'Start the FastAPI server on port 8000. If you use `npm run dev`, add to frontend/.env.local: BACKEND_INTERNAL_URL=http://127.0.0.1:8000 then restart Next.js. Test: curl http://127.0.0.1:8000/health'
    throw new Error(
      `Cannot reach API — ${[code, axiosMsg].filter(Boolean).join(' ')}. ${via} ${hint}`,
    )
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

function put<T>(
  url: string,
  data?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  return api.put(url, data, { params }) as unknown as Promise<T>
}

function del<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return api.delete(url, { params }) as unknown as Promise<T>
}

function postFormData<T>(url: string, formData: FormData): Promise<T> {
  return api.post(url, formData) as unknown as Promise<T>
}

/**
 * Fetch quotation PDF bytes with Bearer auth (same as other API calls).
 * A plain `<iframe src={apiUrl}>` cannot send Authorization headers, so previews must use blob URLs.
 */
export async function fetchQuotationPdfBlob(quotationId: string): Promise<Blob> {
  const blob = (await api.get(`/api/quotations/${encodeURIComponent(quotationId)}/pdf`, {
    responseType: 'blob',
  })) as unknown as Blob
  if (!(blob instanceof Blob)) throw new Error('Invalid PDF response')

  const magic = await blob.slice(0, 4).text()
  if (magic !== '%PDF') {
    const text = await blob.text()
    try {
      const j = JSON.parse(text) as { detail?: unknown }
      const d = j.detail
      throw new Error(typeof d === 'string' ? d : 'Could not load PDF')
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error('Could not load PDF')
      }
      throw e
    }
  }
  return blob
}

/** Triggers a file download with Bearer auth (plain `<a href>` cannot send the token). */
export async function downloadQuotationPdf(quotationId: string, filename?: string): Promise<void> {
  const blob = await fetchQuotationPdfBlob(quotationId)
  const safeName = (filename || `quotation_${quotationId.slice(0, 8)}`).replace(/[/\\?%*:|"<>]/g, '-')
  const name = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Opens the PDF in a new tab using an authenticated fetch + blob URL. */
export async function openQuotationPdfInNewTab(quotationId: string): Promise<void> {
  const blob = await fetchQuotationPdfBlob(quotationId)
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) {
    URL.revokeObjectURL(url)
    throw new Error('Pop-up blocked — allow pop-ups to open the PDF')
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

export const enquiriesApi = {
  uploadEmail: <T = unknown>(emailText: string, inputType: string = 'email') =>
    post<T>('/api/enquiries/upload-email', { email_text: emailText, input_type: inputType }),
  processEmailMatcher: <T = unknown>(enquiryId: string) =>
    post<T>(`/api/enquiries/${encodeURIComponent(enquiryId)}/process-matcher`, {}),
  decideEmailApproval: <T = unknown>(
    enquiryId: string,
    body: { decision: 'approve' | 'reject'; notes?: string },
  ) =>
    post<T>(`/api/enquiries/${encodeURIComponent(enquiryId)}/email-approval`, body),
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
  ) => get<T>('/api/enquiries', params as Record<string, unknown>),
  updateListingDates: <T = unknown>(
    id: string,
    body: { next_follow_up_date?: string | null; nextFollowUpNote?: string | null },
  ) => patch<T>(`/api/enquiries/${encodeURIComponent(id)}/listing-dates`, body),
  updateProductNotes: <T = unknown>(
    id: string,
    body: { productNotes: import('@/types').EnquiryProductNote[] },
  ) => patch<T>(`/api/enquiries/${encodeURIComponent(id)}/product-notes`, body),
  updateDetailType: <T = unknown>(
    id: string,
    body: { enquiryDetailType: import('@/lib/enquiryDetailType').EnquiryDetailType },
  ) => patch<T>(`/api/enquiries/${encodeURIComponent(id)}/detail-type`, body),
  updateQuoteStatus: <T = unknown>(
    id: string,
    body: { enquiryQuoteStatus: import('@/lib/enquiryQuoteStatus').EnquiryQuoteStatus },
  ) => patch<T>(`/api/enquiries/${encodeURIComponent(id)}/quote-status`, body),
  archive: <T = unknown>(id: string) =>
    post<T>(`/api/enquiries/${encodeURIComponent(id)}/archive`, {}),
  assignUser: <T = unknown>(id: string, body: { user_id: string }) =>
    patch<T>(`/api/enquiries/${encodeURIComponent(id)}/assign-user`, body),
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
  updatePdfDisplay: <T = unknown>(id: string, body: { pdf_display_overrides: Record<string, unknown> | null }) =>
    patch<T>(`/api/quotations/${id}/pdf-display`, body),
  updateFinancialSummary: <T = unknown>(
    id: string,
    body: {
      pfApplicable: boolean
      pfMode: 'percent' | 'amount'
      pfDraft: string
      freightApplicable: boolean
      freightMode: 'percent' | 'amount'
      freightDraft: string
      cgstApplicable: boolean
      cgstMode: 'percent' | 'amount'
      cgstDraft: string
      sgstApplicable: boolean
      sgstMode: 'percent' | 'amount'
      sgstDraft: string
      igstApplicable: boolean
      igstMode: 'percent' | 'amount'
      igstDraft: string
    },
  ) => patch<T>(`/api/quotations/${encodeURIComponent(id)}/financial-summary`, body),
  listTermsMaster: <T = unknown>() => get<T>('/api/quotations/terms-master'),
  createTermMaster: <T = unknown>(body: { body: string }) =>
    post<T>('/api/quotations/terms-master', body),
  getAudit: <T = unknown>(id: string, limit: number = 25) =>
    get<T>(`/api/quotations/${id}/audit`, { limit }),
  listQuotations: <T = unknown>(
    params?: {
      limit?: number
      offset?: number
      search?: string
      client_name?: string
      status?: string
      date_from?: string
      date_to?: string
    },
  ) => get<T>('/api/quotations', params as Record<string, unknown>),
  updateCrmStatus: <T = unknown>(
    id: string,
    body: { status: string; status_remarks?: string | null },
  ) => patch<T>(`/api/quotations/${encodeURIComponent(id)}/crm-status`, body),
  updateLineCrmStatus: <T = unknown>(
    id: string,
    lineIndex: number,
    body: { status: string; status_remarks?: string | null },
  ) =>
    patch<T>(
      `/api/quotations/${encodeURIComponent(id)}/line-items/${lineIndex}/crm-status`,
      body,
    ),
  updateListingDates: <T = unknown>(
    id: string,
    body: {
      validity_date?: string | null
      next_follow_up_date?: string | null
      nextFollowUpNote?: string | null
    },
  ) => patch<T>(`/api/quotations/${encodeURIComponent(id)}/listing-dates`, body),
  archive: <T = unknown>(id: string) =>
    post<T>(`/api/quotations/${encodeURIComponent(id)}/archive`, {}),
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

export const purchaseOrdersApi = {
  list: <T = unknown>(
    params?: {
      limit?: number
      offset?: number
      search?: string
      client_name?: string
      date_from?: string
      date_to?: string
      po_type?: string
    },
  ) => get<T>('/api/purchase-orders', params as Record<string, unknown>),
  get: <T = unknown>(id: string) => get<T>(`/api/purchase-orders/${id}`),
  create: <T = unknown>(body: import('@/types').PurchaseOrderCreatePayload) =>
    post<T>('/api/purchase-orders', body),
  update: <T = unknown>(id: string, body: import('@/types').PurchaseOrderUpdatePayload) =>
    patch<T>(`/api/purchase-orders/${encodeURIComponent(id)}`, body),
  delete: <T = unknown>(id: string) => del<T>(`/api/purchase-orders/${encodeURIComponent(id)}`),
}

export const indiamartApi = {
  listQueries: <T = unknown>(params?: { include_archived?: boolean }) =>
    get<T>('/api/indiamart/queries', params as Record<string, unknown>),
  getPrefill: <T = unknown>(queryId: string) =>
    get<T>(`/api/indiamart/queries/${encodeURIComponent(queryId)}/prefill`),
  pickupQuery: <T = unknown>(queryId: string, body: import('@/types').ManualEnquiryCreateForm) =>
    post<T>(`/api/indiamart/queries/${encodeURIComponent(queryId)}/pickup`, body),
  archiveQuery: <T = unknown>(queryId: string) =>
    post<T>(`/api/indiamart/queries/${encodeURIComponent(queryId)}/archive`, {}),
}

export const mastersApi = {
  listProducts: <T = unknown>(params?: { category?: string }) =>
    get<T>('/api/masters/products', params as Record<string, unknown>),
  getClientConfig: <T = unknown>() => get<T>('/api/masters/client-config'),
  listSheetRows: <T = unknown>(
    sheet: string,
    params?: {
      skip?: number
      limit?: number
      variant_type?: string
      variant_contains?: string
      variant_exclude_contains?: string
      variant_contains_any?: string
      model_name_prefix?: string
      nav?: string
    },
  ) => get<T>(`/api/masters/sheets/${sheet}/rows`, params as Record<string, unknown>),
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
  getSheetDefaultSupplier: (sheet: string, navSlug?: string | null) =>
    get<{ default: import('@/types').MasterSheetDefaultSupplier | null }>(
      `/api/masters/sheets/${encodeURIComponent(sheet)}/default-supplier`,
      navSlug ? { nav: navSlug } : undefined,
    ),
  setSheetDefaultSupplier: (sheet: string, supplierId: string, navSlug?: string | null) =>
    put<{ default: import('@/types').MasterSheetDefaultSupplier }>(
      `/api/masters/sheets/${encodeURIComponent(sheet)}/default-supplier`,
      { supplier_id: supplierId },
      navSlug ? { nav: navSlug } : undefined,
    ),
  clearSheetDefaultSupplier: (sheet: string, navSlug?: string | null) =>
    del<{ cleared: boolean }>(
      `/api/masters/sheets/${encodeURIComponent(sheet)}/default-supplier`,
      navSlug ? { nav: navSlug } : undefined,
    ),
  listSheetDefaultSuppliers: () =>
    get<{ items: import('@/types').MasterSheetDefaultSupplier[] }>('/api/masters/sheet-default-suppliers'),

  getOthersTree: <T = unknown>() => get<T>('/api/masters/others/tree'),
  createOthersCategory: (name: string) =>
    post<import('@/types').OthersCategory>('/api/masters/others/categories', { name }),
  updateOthersCategory: (categoryId: string, name: string) =>
    patch<import('@/types').OthersCategory>(`/api/masters/others/categories/${categoryId}`, { name }),
  deleteOthersCategory: (categoryId: string) =>
    del<{ deleted: boolean }>(`/api/masters/others/categories/${categoryId}`),
  createOthersSheet: (categoryId: string, name: string) =>
    post<import('@/types').OthersSheet>(`/api/masters/others/categories/${categoryId}/sheets`, {
      name,
    }),
  updateOthersSheet: (sheetId: string, name: string) =>
    patch<import('@/types').OthersSheet>(`/api/masters/others/sheets/${sheetId}`, { name }),
  deleteOthersSheet: (sheetId: string) =>
    del<{ deleted: boolean }>(`/api/masters/others/sheets/${sheetId}`),
  getOthersSheetRows: <T = unknown>(sheetId: string) =>
    get<T>(`/api/masters/others/sheets/${sheetId}/rows`),
  createOthersRow: (
    sheetId: string,
    body: { sr_no?: number | null; description?: string | null; price_inr?: number | null },
  ) => post<import('@/types').OthersSheetRow>(`/api/masters/others/sheets/${sheetId}/rows`, body),
  updateOthersRow: (
    sheetId: string,
    rowId: string,
    body: {
      sr_no?: number | null
      description?: string | null
      price_inr?: number | null
      clear_sr_no?: boolean
      clear_price?: boolean
    },
  ) =>
    patch<import('@/types').OthersSheetRow>(
      `/api/masters/others/sheets/${sheetId}/rows/${rowId}`,
      body,
    ),
  deleteOthersRow: (sheetId: string, rowId: string) =>
    del<{ deleted: boolean }>(`/api/masters/others/sheets/${sheetId}/rows/${rowId}`),
}

export const clientsApi = {
  searchCompanies: (search?: string, limit = 80) =>
    get<import('@/types').CompanyResponse[]>('/api/clients', {
      ...(search ? { search } : {}),
      limit,
    }),
  getCompany: (companyId: string) =>
    get<import('@/types').CompanyResponse>(`/api/clients/${companyId}`),
  createCompany: (data: import('@/types').CreateCompanyRequestPayload) =>
    post<import('@/types').CompanyResponse>('/api/clients', data),
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
  listBranchEmployees: (companyId: string, branchId: string) =>
    get<import('@/types').ClientEmployeeResponse[]>(
      `/api/clients/${companyId}/branches/${branchId}/employees`,
    ),
  createBranchEmployee: (
    companyId: string,
    branchId: string,
    data: import('@/types').CreateClientEmployeePayload,
  ) =>
    post<import('@/types').ClientEmployeeResponse>(
      `/api/clients/${companyId}/branches/${branchId}/employees`,
      data,
    ),
}

export const suppliersApi = {
  getSuppliers: (activeOnly = false) =>
    get<import('@/types').SupplierResponse[]>('/api/suppliers', { active_only: activeOnly }),
  createSupplier: (data: {
    name: string
    primary_category_key?: string
    category_keys?: string[]
    margin_multiplier?: number | null
    supplier_discount_pct?: number | null
    contact_person?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    notes?: string | null
  }) => post<import('@/types').SupplierResponse>('/api/suppliers', data),
  updateSupplier: (
    id: string,
    data: Partial<{
      name: string
      primary_category_key: string
      category_keys: string[]
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

  /** Suppliers with list prices for a resolved catalog row (excludes TBD / missing). */
  getSuppliersForProduct: (category: string, catalogRowId: string) =>
    get<{ items: Array<{ supplier_id: string; supplier_name: string; list_price_inr: number }> }>(
      '/api/configurator/suppliers-for-product',
      { category, catalog_row_id: catalogRowId },
    ),
}

export const syncApi = {
  getStatus: <T = unknown>() => get<T>('/api/sync/status'),
  triggerNow: <T = unknown>(body?: { mailbox_id?: string | null }) =>
    post<T>('/api/sync/trigger', body ?? {}),
  getHistory: <T = unknown>(limit?: number) =>
    get<T>('/api/sync/history', limit != null ? { limit } : undefined),
}

export const mailboxesApi = {
  list: <T = unknown[]>() => get<T>('/api/mailboxes'),
  create: <T = unknown>(body: {
    display_name: string
    email_address: string
    imap_host?: string
    imap_port?: number
    imap_folder?: string
    unread_only?: boolean
    app_password: string
  }) => post<T>('/api/mailboxes', body),
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
    get<T>('/api/users', includeInactive ? ({ include_inactive: true } as Record<string, unknown>) : undefined),
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
  }) => post<T>('/api/users', body),
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
  updateMonthlyTarget: <T = unknown>(id: string, monthly_booking_target: number) =>
    patch<T>(`/api/users/${id}/monthly-target`, { monthly_booking_target }),
}

export type BookingTargetTrackerResponse = {
  month_label: string
  month: number
  year: number
  scope_label: string
  total_target: number
  achieved_value: number
  pct_achieved: number
  expected_pace_pct: number
  working_days_left: number
  working_days_total: number
  working_days_elapsed: number
  required_daily_pace: number
  is_behind_schedule: boolean
}

export type DashboardKpisResponse = {
  month_label: string
  compare_month_label: string
  quoted_value: {
    total: number
    count: number
    mom_pct_change: number
  }
  po_received: {
    total: number
    count: number
  }
  win_rate: {
    pct: number
    pts_change: number
  }
  avg_response: {
    hours: number | null
    week1_hours: number | null
  }
}

export type ActionQueuesResponse = {
  incomplete_enquiries: {
    count: number
    items: Array<{
      enquiry_id: string
      subject: string
      required_action: string
      action_type: string
      aging_days: number
    }>
  }
  follow_ups_due: {
    count: number
    expired_count: number
    due_soon_count: number
    pipeline_value: number
    items: Array<{
      entity_type: 'enquiry' | 'quotation'
      entity_id: string
      quotation_id: string | null
      enquiry_id: string
      client_product: string
      deal_value: number
      due_label: string
      due_urgency: string
      next_follow_up_date: string | null
      status: string
      status_label: string
    }>
  }
  so_dates_pending: {
    count: number
    items: Array<{
      po_id: string
      po_number: string
      client_name: string
      quote_number: string | null
      quotation_id: string | null
      total_amount: number
      hours_overdue: number
      due_label: string
      created_at: string | null
    }>
  }
  quote_expiry: {
    has_expiring_quotes: boolean
    has_expired_follow_ups: boolean
    expired_count: number
    expired_value: number
    due_soon_count: number
    due_soon_value: number
    expiring_value: number
    timeframe_days: number
    accounts: Array<{
      account_name: string
      expiring_value: number
      no_follow_up_logged: boolean
      has_overdue?: boolean
    }>
  }
}

export type SalesFunnelResponse = {
  month_label: string
  month: number
  year: number
  enquiries: {
    count: number
    bar_width_pct: number
  }
  quoted: {
    count: number
    value: number
    bar_width_pct: number
    conversion_from_enquiries_pct: number
  }
  po_won: {
    count: number
    value: number
    bar_width_pct: number
    conversion_from_quoted_pct: number
  }
}

export type DashboardChartsResponse = {
  month_label: string
  lost_reasons: {
    total: number
    reasons: Array<{
      reason: string
      count: number
      bar_width_pct: number
      is_top: boolean
    }>
    insights: string[]
  }
  won_by_source: {
    total_won_value: number
    sources: Array<{
      channel_key: string
      channel_label: string
      won_value: number
      po_count: number
      share_pct: number
      bar_color: string
    }>
  }
  weekly_response: {
    weeks: Array<{
      week_label: string
      week: number
      avg_hours: number
      is_milestone?: boolean
    }>
    milestone_week: number | null
    milestone_hours: number | null
    target_hours: number | null
  }
  won_value_trend: {
    months: Array<{
      year: number
      month: number
      month_label: string
      won_value: number
      is_current: boolean
    }>
  }
  category_performance: {
    categories: Array<{
      category_key: string
      category_label: string
      category_abbr: string
      won_value: number
      quoted_value: number
      win_rate_pct: number
      po_count: number
      bar_width_pct: number
      win_rate_tier: 'high' | 'medium' | 'low' | 'neutral'
    }>
    insight: string | null
    highlight_token: string | null
  }
}

export type PipelineRegisterRow = {
  row_key: string
  year: number | null
  month: number | null
  month_label: string
  is_mtd: boolean
  is_total: boolean
  enquiry_count: number
  quote_count: number
  quoted_value: number
  po_count: number
  po_value: number
  conversion_pct: number
}

export type PipelineRegisterResponse = {
  fy_label: string
  rows: PipelineRegisterRow[]
  conversion_range: { min: number; max: number }
}

export type PipelineMonthEnquiriesResponse = {
  year: number
  month: number
  month_label: string
  count: number
  items: Array<{
    enquiry_id: string
    enquiry_number: string | null
    subject: string
    status: string
    flow_type: string | null
    created_at: string | null
    quoted_value: number | null
    quote_number: string | null
  }>
}

export type ConversionPipelineGroupBy = 'month' | 'user' | 'category' | 'customer'

export type ConversionPipelineRow = {
  row_key: string
  group_label: string
  enquiry_count: number
  quote_count: number
  quoted_value: number
  po_count: number
  po_value: number
  conversion_pct: number
  is_total?: boolean
}

export type ConversionPipelineReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  group_by: ConversionPipelineGroupBy
  group_by_label: string
  scope_label: string
  record_count: number
  conversion_threshold_pct: number
  rows: ConversionPipelineRow[]
  totals: ConversionPipelineRow & { is_total: true }
}

export type QuotationRegisterDisplayStatus =
  | 'open'
  | 'won'
  | 'lost'
  | 'expired'
  | 'expiring_soon'

export type QuotationRegisterRow = {
  quotation_id: string
  quote_ref: string
  date_raised: string | null
  customer_name: string
  product: string
  category: string
  quoted_value: number
  display_status: QuotationRegisterDisplayStatus
  crm_status: string
  salesperson: string
  salesperson_id: string | null
  expiry_date: string | null
  expiry_warning: boolean
}

export type QuotationRegisterReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  total_quoted_value: number
  salespeople: Array<{ id: string; name: string }>
  rows: QuotationRegisterRow[]
}

export type WinLossOutcome = 'won' | 'lost'

export type WinLossAnalysisRow = {
  quotation_id: string
  quote_ref: string
  customer_name: string
  product: string
  category: string
  quoted_value: number
  outcome: WinLossOutcome
  loss_reason: string | null
  loss_reason_raw: string | null
  salesperson: string
  salesperson_id: string | null
}

export type WinLossAnalysisSummary = {
  total_quoted_value: number
  total_won_value: number
  total_lost_value: number
  total_quoted_count: number
  total_won_count: number
  total_lost_count: number
  win_rate_value_pct: number
  win_rate_count_pct: number
  top_loss_reason: string | null
  top_loss_reason_count: number
}

export type WinLossAnalysisReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  loss_reason_categories: string[]
  categories: string[]
  salespeople: Array<{ id: string; name: string }>
  summary: WinLossAnalysisSummary
  loss_reason_breakdown: DashboardChartsResponse['lost_reasons']
  rows: WinLossAnalysisRow[]
}

export type SalesPerformanceUserRow = {
  user_id: string
  salesperson_name: string
  enquiry_count: number
  quote_count: number
  quoted_value: number
  po_count: number
  won_value: number
  win_rate_pct: number
  avg_response_hours: number | null
}

export type SalesPerformanceByUserReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  rows: SalesPerformanceUserRow[]
  totals: SalesPerformanceUserRow
}

export type SourceRoiRow = {
  source_key: string
  source_label: string
  enquiry_count: number
  quote_count: number
  quoted_value: number
  po_count: number
  won_value: number
  win_rate_pct: number
  revenue_share_pct: number
  bar_color: string
  is_highest_win_rate?: boolean
  is_lowest_win_rate?: boolean
}

export type SourceRoiReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  rows: SourceRoiRow[]
  totals: SourceRoiRow
}

export type SoHandoffRow = {
  po_id: string
  po_reference: string
  customer_name: string
  po_value: number
  po_date: string | null
  so_created: boolean
  so_number: string | null
  so_creation_date: string | null
  days_to_handoff: number | null
  handoff_owner: string
  handoff_owner_id: string | null
  po_age_days: number
  handoff_overdue: boolean
}

export type SoHandoffReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  handoff_overdue_days: number
  summary: {
    total_pos: number
    so_created_count: number
    pct_so_created: number
    avg_days_to_handoff: number | null
  }
  handoff_owners: Array<{ id: string; name: string }>
  rows: SoHandoffRow[]
}

export type CustomerReportRow = {
  customer_key: string
  customer_name: string
  enquiry_count: number
  quote_count: number
  quoted_value: number
  po_count: number
  po_value: number
  win_rate_pct: number
  last_activity_date: string | null
  primary_source_key: string
  primary_source_label: string
  primary_category: string
  customer_tier: string
  customer_tier_label: string
}

export type CustomerReportTotals = CustomerReportRow & {
  customer_count: number
  avg_win_rate_pct: number
}

export type CustomerReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  tier_thresholds_inr: Array<{ tier: string; label: string; min_po_value: number }>
  source_channels: Array<{ key: string; label: string }>
  rows: CustomerReportRow[]
  totals: CustomerReportTotals
}

export type ReportsBundleResponse = {
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  conversion_pipeline: Record<ConversionPipelineGroupBy, ConversionPipelineReportResponse>
  quotation_register: QuotationRegisterReportResponse
  win_loss_analysis: WinLossAnalysisReportResponse
  sales_performance_by_user: SalesPerformanceByUserReportResponse
  source_roi: SourceRoiReportResponse
  so_handoff: SoHandoffReportResponse
  customer: CustomerReportResponse
  response_sla: ResponseSlaReportResponse
  pending_ageing: PendingAgeingReportResponse
  lost_business: LostBusinessReportResponse
  avg_po_value: AvgPoValueReportResponse
  discount_price_variance: DiscountPriceVarianceReportResponse
}

export type ResponseSlaRow = {
  enquiry_id: string
  enquiry_ref: string
  customer_name: string
  category_key: string
  category: string
  received_at: string
  quote_sent_at: string
  response_hours: number
  sla_met: boolean
  salesperson: string
  salesperson_id: string | null
}

export type ResponseSlaReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  default_sla_target_hours: number
  sla_target_hours: number
  sla_target_options: number[]
  categories: string[]
  salespeople: Array<{ id: string; name: string }>
  summary: {
    total_enquiries: number
    sla_met_count: number
    sla_met_pct: number
    avg_response_hours: number | null
    worst_response_hours: number | null
  }
  weekly_trend: {
    weeks: Array<{
      week_label: string
      week_start: string
      avg_hours: number
      enquiry_count: number
      is_milestone?: boolean
    }>
    target_hours: number
    milestone_week: string | null
    milestone_hours: number | null
  }
  rows: ResponseSlaRow[]
}

export type PendingAgeingRow = {
  item_id: string
  item_type: 'enquiry' | 'quotation'
  reference: string
  customer_name: string
  product: string
  category: string
  quoted_value: number
  stage_key: 'enquiry' | 'quoted' | 'negotiation'
  stage_label: string
  created_date: string
  last_activity_date: string | null
  age_days: number
  ageing_bucket_key: 'green' | 'amber' | 'red' | 'critical'
  ageing_bucket_label: string
  salesperson: string
  salesperson_id: string | null
  next_action_due: string | null
  next_action_urgency: 'overdue' | 'upcoming' | 'neutral' | 'none'
}

export type PendingAgeingReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  as_of_date: string
  scope_label: string
  record_count: number
  ageing_buckets: Array<{ key: string; label: string }>
  bucket_summaries: Array<{ bucket_key: string; bucket_label: string; count: number; total_value: number }>
  categories: string[]
  stages: Array<{ key: string; label: string }>
  salespeople: Array<{ id: string; name: string }>
  summary: {
    total_open_value: number
    item_count: number
    avg_age_days: number
  }
  rows: PendingAgeingRow[]
}

export type LostBusinessRow = {
  quotation_id: string
  quote_ref: string
  customer_name: string
  product: string
  category: string
  quoted_value: number
  loss_date: string | null
  loss_reason: string | null
  loss_reason_raw: string | null
  competitor: string | null
  salesperson: string
  salesperson_id: string | null
  stage_lost_at_key: string
  stage_lost_at_label: string
  notes: string | null
}

export type LostBusinessReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  loss_reason_categories: string[]
  categories: string[]
  stages_lost_at: Array<{ key: string; label: string }>
  salespeople: Array<{ id: string; name: string }>
  summary: {
    total_lost_value: number
    loss_count: number
    avg_deal_size_lost: number
    top_loss_reason: string | null
    top_loss_reason_count: number
    top_loss_reason_by_value: string | null
    top_loss_reason_value: number
  }
  loss_reason_breakdown: DashboardChartsResponse['lost_reasons']
  rows: LostBusinessRow[]
}

export type AvgPoValueDimension = 'customer' | 'product' | 'category'

export type AvgPoValueRow = {
  dimension_name: string
  po_count: number
  total_po_value: number
  avg_po_value: number
  min_po_value: number
  max_po_value: number
  value_range: number
  avg_bar_pct: number
  outlier: 'high' | 'low' | null
}

export type AvgPoValueDimensionBlock = {
  rows: AvgPoValueRow[]
  summary: {
    overall_avg_po_value: number
    total_po_count: number
    total_won_value: number
  }
}

export type AvgPoValueReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  dimensions: Record<AvgPoValueDimension, AvgPoValueDimensionBlock>
}

export type DiscountPriceVarianceRow = {
  po_id: string
  quotation_id: string | null
  reference: string
  quote_ref: string
  customer_name: string
  product: string
  category: string
  list_price: number
  quoted_price: number
  final_po_price: number
  discount_pct: number
  discount_value: number
  variance_pct: number
  discount_band: 'none' | 'low' | 'medium' | 'high'
  approval_status: 'approved' | 'pending' | 'not_required'
  salesperson: string
  salesperson_id: string | null
}

export type DiscountPriceVarianceReportResponse = {
  report_title: string
  generated_at: string
  date_from: string
  date_to: string
  scope_label: string
  record_count: number
  discount_thresholds: {
    acceptable_max_pct: number
    moderate_max_pct: number
    approval_threshold_pct: number
  }
  categories: string[]
  salespeople: Array<{ id: string; name: string }>
  summary: {
    avg_discount_pct: number
    total_discount_value: number
    discounted_deal_count: number
  }
  rows: DiscountPriceVarianceRow[]
}

export const analyticsApi = {
  bookingTarget: <T = BookingTargetTrackerResponse>(params?: { user_id?: string; year?: number; month?: number }) =>
    get<T>('/api/analytics/booking-target', params as Record<string, unknown> | undefined),
  kpis: <T = DashboardKpisResponse>(params?: { user_id?: string; year?: number; month?: number }) =>
    get<T>('/api/analytics/kpis', params as Record<string, unknown> | undefined),
  actionQueues: <T = ActionQueuesResponse>(params?: { user_id?: string }) =>
    get<T>('/api/analytics/action-queues', params as Record<string, unknown> | undefined),
  salesFunnel: <T = SalesFunnelResponse>(params?: { user_id?: string; year?: number; month?: number }) =>
    get<T>('/api/analytics/sales-funnel', params as Record<string, unknown> | undefined),
  charts: <T = DashboardChartsResponse>(params?: { user_id?: string; year?: number; month?: number }) =>
    get<T>('/api/analytics/charts', params as Record<string, unknown> | undefined),
  pipelineRegister: <T = PipelineRegisterResponse>(params?: { user_id?: string }) =>
    get<T>('/api/analytics/pipeline-register', params as Record<string, unknown> | undefined),
  pipelineMonthEnquiries: <T = PipelineMonthEnquiriesResponse>(
    year: number,
    month: number,
    params?: { user_id?: string },
  ) =>
    get<T>('/api/analytics/pipeline-register/enquiries', {
      year,
      month,
      ...(params ?? {}),
    } as Record<string, unknown>),
  conversionPipelineReport: <T = ConversionPipelineReportResponse>(params: {
    date_from: string
    date_to: string
    group_by: ConversionPipelineGroupBy
    user_id?: string
  }) => get<T>('/api/analytics/conversion-pipeline-report', params as Record<string, unknown>),
  quotationRegisterReport: <T = QuotationRegisterReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/quotation-register-report', params as Record<string, unknown>),
  winLossAnalysisReport: <T = WinLossAnalysisReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/win-loss-analysis-report', params as Record<string, unknown>),
  salesPerformanceByUserReport: <T = SalesPerformanceByUserReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/sales-performance-by-user-report', params as Record<string, unknown>),
  sourceRoiReport: <T = SourceRoiReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/source-roi-report', params as Record<string, unknown>),
  soHandoffReport: <T = SoHandoffReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/so-handoff-report', params as Record<string, unknown>),
  customerReport: <T = CustomerReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/customer-report', params as Record<string, unknown>),
  reportsBundle: <T = ReportsBundleResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/reports-bundle', params as Record<string, unknown>),
  responseSlaReport: <T = ResponseSlaReportResponse>(params: {
    date_from: string
    date_to: string
    sla_target_hours?: number
    user_id?: string
  }) => get<T>('/api/analytics/response-sla-report', params as Record<string, unknown>),
  pendingAgeingReport: <T = PendingAgeingReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/pending-ageing-report', params as Record<string, unknown>),
  lostBusinessReport: <T = LostBusinessReportResponse>(params: {
    date_from: string
    date_to: string
    user_id?: string
  }) => get<T>('/api/analytics/lost-business-report', params as Record<string, unknown>),
}

export async function changePasswordApi(
  new_password: string,
  phone?: string,
  old_password?: string,
): Promise<{ message?: string; phone?: string | null }> {
  return post<{ message?: string; phone?: string | null }>('/api/auth/change-password', {
    ...(old_password != null && old_password !== '' ? { old_password } : {}),
    new_password,
    phone,
  })
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

export function extractEnquiryProductsStreamUrl(enquiryId: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  if (base) return `${base}/api/enquiries/${enquiryId}/extract-stream`
  return `/api/enquiries/${enquiryId}/extract-stream`
}

/** LangGraph product extractor — live SSE agent activity on enquiry detail. */
export async function extractEnquiryProductsStream(
  enquiryId: string,
  onEvent: (event: import('@/types').AgentEvent) => void,
): Promise<void> {
  const doFetch = () =>
    fetch(extractEnquiryProductsStreamUrl(enquiryId), {
      method: 'POST',
      headers: { ...bearerHeaders(true) },
      cache: 'no-store',
    })

  let response = await doFetch()
  if (response.status === 401) {
    await refreshAccessToken()
    response = await doFetch()
  }

  if (!response.ok || !response.body) {
    let detail = `API error: ${response.status}`
    try {
      const err = (await response.json()) as { detail?: string }
      if (err?.detail) detail = err.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
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
        const event = JSON.parse(jsonStr) as import('@/types').AgentEvent
        onEvent(event)
        if (event.type === 'stream_end') return
      } catch {
        /* malformed JSON — skip */
      }
    }
  }
}

export async function createManualEnquiry(
  body: import('@/types').ManualEnquiryCreateForm,
): Promise<import('@/types').EnquiryResponse> {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/enquiries/manual/create` : '/api/enquiries/manual/create'
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...bearerHeaders(true) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    let detail = `API error: ${res.status}`
    try {
      const err = (await res.json()) as { detail?: string }
      if (err?.detail) detail = err.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return (await res.json()) as import('@/types').EnquiryResponse
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
  if (!res.ok) {
    let detail = `API error: ${res.status}`
    try {
      const err = (await res.json()) as { detail?: string }
      if (err?.detail) detail = err.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
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
