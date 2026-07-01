export type EnquirySource = 'email' | 'indiamart' | 'manual' | 'referral'

export interface ListingCategoryLine {
  category: string
  sub_category?: string | null
}

export interface ListingItemDescriptionLine {
  short: string
  full: string
}

export interface EnquiryListItem {
  enquiry_id: string
  /** FY + serial (e.g. 262700089); legacy rows may omit. */
  enquiry_number?: string | null
  client_org_name?: string
  status: string
  flow_type: string | null
  input_type: string
  /** Business source: email, indiamart, manual, referral */
  source?: EnquirySource | string
  /** Whether client/product details were complete at intake. */
  enquiry_detail_type?: import('@/lib/enquiryDetailType').EnquiryDetailType | string
  /** Listing quote status: not_quoted | quoted | partially_quoted. */
  enquiry_quote_status?: import('@/lib/enquiryQuoteStatus').EnquiryQuoteStatus | string
  item_desc_short?: string
  item_desc_lines?: ListingItemDescriptionLine[]
  quotation_id?: string | null
  quote_number?: string | null
  next_follow_up_date?: string | null
  next_follow_up_note?: string | null
  follow_up_history?: import('@/lib/followUpTypes').FollowUpHistoryEntry[]
  created_at: string
  /** User who owns the enquiry for listing / dashboard scope. */
  created_by_user_id?: string | null
  /** User who created the enquiry (upload / manual); omitted for older rows or inbox sync. */
  created_by_name?: string | null
  erp_export_available?: boolean
  /** Inferred from parsed line items (listing filters). */
  category?: string | null
  items_search_text?: string
  is_non_standard_customer?: boolean
  series?: string | null
  is_sales_enquiry?: boolean
  is_archived?: boolean
}

export interface EnquiryResponse {
  enquiry_id: string
  enquiry_number?: string | null
  status: string
  flow_type: 'complete' | 'incomplete' | 'ambiguous' | 'not_found' | null
  message: string
  quotation_id: string | null
  pdf_available: boolean
  pdf_path: string | null
  clarification_questions: string | null
  ai_reasoning: string[]
  requires_human_review: boolean
  quote_number?: string | null
  subtotal?: number | null
  total_amount?: number | null
  line_items?: Array<{
    description?: string
    quantity?: number
    unit_price?: number
    unit?: string
    line_total?: number
  }>
}

export interface EmailApprovalInfo {
  status: 'pending' | 'approved' | 'rejected' | 'not_applicable' | string
  decided_at?: string | null
  decided_by_name?: string | null
  notes?: string | null
}

export interface EnquiryDetail {
  enquiry_id: string
  enquiry_number?: string | null
  status: string
  flow_type: string | null
  input_type: string
  raw_input?: string | null
  parsed_data: Record<string, unknown> | null
  matched_products: unknown[] | null
  confidence_score: number | null
  ai_reasoning: string | null
  error_message: string | null
  created_at: string | null
  display_company?: string | null
  inbox_processed?: boolean
  processing_started_at?: string | null
  processing_completed_at?: string | null
  email_approval?: EmailApprovalInfo | null
  requires_email_approval?: boolean
  is_email_agent_enquiry?: boolean
  enquiry_detail_type?: import('@/lib/enquiryDetailType').EnquiryDetailType | string
  next_follow_up_date?: string | null
  next_follow_up_note?: string | null
  follow_up_history?: import('@/lib/followUpTypes').FollowUpHistoryEntry[]
}

export interface QuotationLineItem {
  description: string
  size: string
  quantity: number
  unit: string
  unit_price: number
  base_unit_price?: number
  customer_discount_pct?: number
  customer_discount_amount?: number
  line_total: number
  total?: number
  price_tbd?: boolean
  product_name?: string
  category?: string | null
  catalog_table?: string | null
  catalog_row_id?: string | null
}

/** Label + value row (letterhead / client extras). Width fixed in PDF; text wraps vertically. */
export interface QuotationPdfKvRow {
  label: string
  value: string
}

/** Extra valuation rows after catalog lines (display-only; does not change totals). */
export interface QuotationPdfValuationSupplementRow {
  sr?: string
  description?: string
  size?: string
  qty?: string
  rate?: string
  disc?: string
  total?: string
}

/** PDF-only layout/text (does not change catalog rows or pricing math). */
export interface QuotationPdfDisplayOverrides {
  lines?: Array<{ description?: string; size?: string; product_name?: string } | null>
  /** When present, replaces quotation notes on the PDF only. */
  notes?: string
  /** Full left letterhead column (label/value rows). */
  header_left?: QuotationPdfKvRow[]
  /** Full right meta column (Date, Quotation No, …). */
  header_right?: QuotationPdfKvRow[]
  /** Center banner between header and company box. */
  thank_you_row?: string
  /** Extra label/value rows under the company block (left column). */
  company_left_extra?: QuotationPdfKvRow[]
  /** Right column text in company section. */
  company_right_text?: string
  /** Full terms list (unnumbered strings; PDF adds numbers). */
  terms_items?: string[]
  /** Per-quotation financial toggles (P&F, freight, CGST/SGST/IGST). */
  financial_config?: {
    pf_applicable?: boolean
    pf_mode?: 'percent' | 'amount'
    pf_draft?: string
    freight_applicable?: boolean
    freight_mode?: 'percent' | 'amount'
    freight_draft?: string
    cgst_applicable?: boolean
    cgst_mode?: 'percent' | 'amount'
    cgst_draft?: string
    sgst_applicable?: boolean
    sgst_mode?: 'percent' | 'amount'
    sgst_draft?: string
    igst_applicable?: boolean
    igst_mode?: 'percent' | 'amount'
    igst_draft?: string
    cgst_amount?: number
    sgst_amount?: number
    igst_amount?: number
  }
  footer_contact?: string
  footer_thanks?: string
  footer_disclaimer?: string
  payment_terms?: string
  delivery_period?: string
  valuation_supplement_rows?: QuotationPdfValuationSupplementRow[]
}

export interface QuotationClientEmployee {
  id: string
  address_code?: string | null
  full_name: string
  phone?: string | null
  email?: string | null
  department?: string | null
  designation?: string | null
}

export interface Quotation {
  quotation_id: string
  enquiry_id: string
  /** Human ref when enquiry has been numbered (FY + serial). */
  enquiry_number?: string | null
  quote_number: string
  client_name: string
  client_company: string | null
  client_email: string | null
  client_phone: string | null
  client_employee_id?: string | null
  client_employee?: QuotationClientEmployee | null
  line_items: QuotationLineItem[]
  subtotal: number
  gst_rate: number
  gst_amount: number
  pf_rate: number
  pf_amount: number
  freight_note: string
  freight_amount?: number
  freight_rate?: number | null
  total_amount: number
  validity_days: number
  validity_date?: string | null
  status: string
  status_remarks?: string | null
  pdf_path: string | null
  notes: string | null
  pdf_display_overrides?: QuotationPdfDisplayOverrides | null
  created_at: string | null
  created_by_name?: string | null
  created_by_email?: string | null
  created_by_phone?: string | null
  /** Sum of linked purchase order totals; when &gt; 0 the quote is treated as PO received. */
  po_total_amount?: number | null
}

export interface QuotationHistoryItem {
  quotation_id: string
  enquiry_id: string
  quote_number: string
  quoted_at: string
  client_name: string | null
  client_company: string | null
  unit_price: number
  quantity: number
  line_total: number
  currency: string
  category: string
  product: {
    catalog_table: string | null
    catalog_row_id: string | null
    variant_type: string | null
    construction: string | null
    valve_size: string | null
    end_connection: string | null
    pressure: string | null
    body: string | null
    ball_disc: string | null
    stem: string | null
    seat: string | null
  }
}

export interface QuotationHistoryResponse {
  total: number
  items: QuotationHistoryItem[]
}

export interface QuotationAuditRow {
  key: string
  label: string
  value: string
}

export interface QuotationAuditSection {
  title: string
  rows: QuotationAuditRow[]
  highlight_all?: boolean
}

export interface QuotationAuditChangeView {
  before: { sections: QuotationAuditSection[] }
  after: { sections: QuotationAuditSection[] }
  changed_keys: string[]
}

export interface QuotationAuditItem {
  at: string
  user: string
  user_name?: string | null
  action: string
  summary: string
  diff?: {
    counts?: { added?: number; removed?: number; changed?: number }
    added?: string[]
    removed?: string[]
    changed?: Array<{ line: string; changes: Record<string, { from: unknown; to: unknown }> }>
  } | null
  change_view?: QuotationAuditChangeView | null
}

export interface QuotationAuditResponse {
  items: QuotationAuditItem[]
}

export interface QuotationLineStatusProduct {
  line_index: number
  label: string
  quantity: number
  line_total: number
  status_remarks?: string | null
}

export interface QuotationLineStatusSummary {
  count: number
  total_lines: number
  products: QuotationLineStatusProduct[]
}

export interface QuotationListItem {
  quotation_id: string
  enquiry_id: string
  enquiry_number?: string | null
  client_employee_id?: string | null
  quote_number: string
  client_name: string
  client_company?: string | null
  primary_category: string
  category_label: string
  sub_category?: string | null
  category_lines?: ListingCategoryLine[]
  item_desc_short: string
  item_desc_lines?: ListingItemDescriptionLine[]
  subtotal: number
  total_amount: number
  po_total_amount?: number | null
  status: string
  status_remarks?: string | null
  line_status_summaries: Record<
    'ongoing' | 'po_received' | 'lost',
    QuotationLineStatusSummary
  >
  next_follow_up_date?: string | null
  next_follow_up_note?: string | null
  follow_up_history?: import('@/lib/followUpTypes').FollowUpHistoryEntry[]
  created_at: string
  /** Logged-in user who created the quotation (manual flow); omitted for older rows or system-generated quotes. */
  created_by_name?: string | null
  is_archived?: boolean
}

export interface PurchaseOrderLineItem extends QuotationLineItem {
  quoted_unit_price?: number
}

export interface PurchaseOrderListItem {
  po_id: string
  po_number: string
  created_at: string
  client_name: string
  client_company?: string | null
  po_type: 'quoted' | 'non_quoted'
  quote_number?: string | null
  quotation_id?: string | null
  primary_category: string
  item_desc_short: string
  total_amount: number
  so_number?: string | null
  so_date?: string | null
  created_by_name?: string | null
}

export interface PurchaseOrder {
  po_id: string
  po_number: string
  so_number?: string | null
  so_date?: string | null
  quotation_id?: string | null
  quote_number?: string | null
  po_type: 'quoted' | 'non_quoted'
  client_name: string
  client_company?: string | null
  client_email?: string | null
  client_phone?: string | null
  client_employee_id?: string | null
  line_items: PurchaseOrderLineItem[]
  subtotal: number
  gst_rate: number
  gst_amount: number
  pf_rate: number
  pf_amount: number
  freight_note: string
  freight_amount: number
  freight_rate?: number | null
  total_amount: number
  primary_category: string
  item_desc_short: string
  financial_config?: QuotationPdfDisplayOverrides['financial_config'] | null
  pdf_path?: string | null
  notes?: string | null
  created_at: string
  created_by_name?: string | null
  created_by_email?: string | null
}

export interface PurchaseOrderCreatePayload {
  quotation_id?: string | null
  selected_lines?: Array<{
    line_index: number
    quantity: number
    unit_price: number
    quoted_unit_price?: number
    customer_discount_pct?: number
  }>
  manual_line_items?: unknown[]
  client_name?: string
  client_company?: string
  client_email?: string
  client_phone?: string
  client_employee_id?: string
  so_number?: string
  so_date?: string | null
  notes?: string
  pf_applicable?: boolean
  pf_mode?: 'percent' | 'amount'
  pf_draft?: string
  freight_applicable?: boolean
  freight_mode?: 'percent' | 'amount'
  freight_draft?: string
  cgst_applicable?: boolean
  cgst_mode?: 'percent' | 'amount'
  cgst_draft?: string
  sgst_applicable?: boolean
  sgst_mode?: 'percent' | 'amount'
  sgst_draft?: string
  igst_applicable?: boolean
  igst_mode?: 'percent' | 'amount'
  igst_draft?: string
  /** CamelCase aliases accepted by the API (from financialDraftToApiBody). */
  pfApplicable?: boolean
  pfMode?: 'percent' | 'amount'
  pfDraft?: string
  freightApplicable?: boolean
  freightMode?: 'percent' | 'amount'
  freightDraft?: string
  cgstApplicable?: boolean
  cgstMode?: 'percent' | 'amount'
  cgstDraft?: string
  sgstApplicable?: boolean
  sgstMode?: 'percent' | 'amount'
  sgstDraft?: string
  igstApplicable?: boolean
  igstMode?: 'percent' | 'amount'
  igstDraft?: string
}

export type PurchaseOrderUpdatePayload = Partial<
  Omit<PurchaseOrderCreatePayload, 'quotation_id'>
>

export interface Product {
  id: string
  name: string
  category: string
  sub_category: string | null
  size_inch: number | null
  size_mm: number | null
  pressure_rating: string | null
  material: string | null
  base_price: number
  unit: string
  currency: string
  pricelist_version: string
  is_active: boolean
}

export interface HealthResponse {
  status: string
  client: string
  model: string
}

export interface EmailSyncStatus {
  sync_enabled: boolean
  email_configured: boolean
  email_address: string | null
  scheduler_running: boolean
  interval_seconds: number
  next_run: string | null
  /** Set after first sync — only mail after this point is parsed as enquiries */
  baseline_at: string | null
}

export interface ClientDropdownOption {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  city: string
  erp_code: string
  source: 'db' | 'dummy'
}

export const CLIENT_INDUSTRY_OPTIONS = [
  'Pharmaceutical',
  'Dairy',
  'Chemical',
  'Food & Beverage',
  'Oil & Gas',
  'Water Treatment',
  'General Manufacturing',
  'Other',
] as const

/** Contact person at a client branch (quotes can be tied to a specific employee). */
export interface ClientEmployeeResponse {
  id: string
  branch_id: string
  address_code?: string | null
  full_name: string
  phone?: string | null
  email?: string | null
  department?: string | null
  designation?: string | null
  is_active?: boolean
}

export interface CreateClientEmployeePayload {
  address_code?: string | null
  full_name: string
  phone?: string | null
  email?: string | null
  department?: string | null
  designation?: string | null
}

export interface BranchResponse {
  id: string
  branch_name: string
  is_headquarters: boolean
  contact_name: string | null
  designation: string | null
  phone: string | null
  email: string | null
  city: string
  state: string | null
  pincode: string | null
  address_line1: string | null
  country: string
  enquiry_count: number
  is_active: boolean
}

export interface CompanyRecentEnquiry {
  enquiry_id: string
  enquiry_number?: string | null
  created_at: string
  branch_name: string
  status: string
}

export interface CompanyResponse {
  id: string
  company_name: string
  gst_number: string | null
  industry: string | null
  erp_code: string | null
  default_discount_pct?: number | null
  is_erp_synced: boolean
  total_enquiry_count: number
  branch_count: number
  branches: BranchResponse[]
  is_active: boolean
  created_at: string
  recent_enquiries?: CompanyRecentEnquiry[]
}

export interface CreateCompanyRequestPayload {
  company_name?: string
  gst_number?: string | null
  industry?: string | null
  notes?: string | null
  is_active?: boolean
  branch_name?: string
  contact_name?: string | null
  designation?: string | null
  phone?: string | null
  email?: string | null
  city: string
  state?: string | null
  pincode?: string | null
  address_line1?: string | null
  country?: string
}

export interface AddBranchRequestPayload {
  branch_name: string
  contact_name?: string | null
  designation?: string | null
  phone?: string | null
  email?: string | null
  city: string
  state?: string | null
  pincode?: string | null
  address_line1?: string | null
  country?: string
}

/** UI state for branch-aware client selection (manual entry / CRM). */
export interface ClientSelection {
  mode: 'existing' | 'new'
  selectedCompany: CompanyResponse | null
  selectedBranch: BranchResponse | null
  newCompany: {
    company_name: string
    gst_number: string
    industry: string
  }
  newBranch: {
    branch_name: string
    contact_name: string
    designation: string
    phone: string
    email: string
    city: string
    state: string
    pincode: string
    address_line1: string
    country: string
  }
}

export interface ProductSizeOption {
  id: string
  name: string
  size_inch: number | null
  size_mm: number | null
  material: string
  base_price: number | null
  unit: string
  display_label: string
}

/** Sheet / catalog category for manual entry (key matches masters APIs). */
export interface ProductCategoryOption {
  key: string
  label: string
  count?: number
}

/** One column in the DB-driven product cascade (manual entry). */
export interface CascadeStepMeta {
  key: string
  label: string
}

export interface ManualLineItem {
  id: string
  category: string
  /** DB column name → chosen value (e.g. sub_category, product, body_material). */
  cascadeSelections: Record<string, string>
  selectedProduct: ProductSizeOption | null
  quantity: number
  customer_discount_pct?: number
  /** When true, quote/PDF show TBD instead of a numeric rate. */
  price_tbd?: boolean
  component_pricing?: Record<string, unknown>
}

/** Step 1 — client details only (no line items). */
export interface EnquiryProductNote {
  family: string
  category: string
  subCategory: string
  details: string
}

export interface ManualEnquiryCreateForm {
  clientMode: 'existing' | 'new'
  selectedClientId: string | null
  clientEmployeeId?: string | null
  newClientEmployee?: ManualEnquiryForm['newClientEmployee']
  newClient: ManualEnquiryForm['newClient']
  priority: 'Normal' | 'High' | 'Urgent'
  notes: string
  productNotes?: EnquiryProductNote[]
  enquiryDetailType: import('@/lib/enquiryDetailType').EnquiryDetailType
  nextFollowUpDate: string
  nextFollowUpNote?: string | null
  source: EnquirySource
  /** Links enquiry to IndiaMart query (one active enquiry per query until archived). */
  indiamartQueryId?: string | null
}

export interface IndiaMartQueryItem {
  id: string
  unique_query_id: string
  query_type: string | null
  query_type_label: string
  query_time: string | null
  sender_name: string | null
  sender_email: string | null
  sender_mobile: string | null
  sender_company: string | null
  sender_city: string | null
  sender_state: string | null
  sender_address: string | null
  sender_country_iso: string | null
  query_message: string | null
  query_product_name: string | null
  enquiry_id: string | null
  enquiry_number: string | null
  is_picked_up: boolean
  can_pickup: boolean
  picked_up_by_user_id: string | null
  picked_up_by_name: string | null
  picked_up_at: string | null
  is_archived: boolean
  created_at: string | null
  /** @deprecated use can_pickup */
  can_create_inquiry?: boolean
}

export interface IndiaMartPickupResponse {
  query: IndiaMartQueryItem
  enquiry_id: string
  enquiry_number: string | null
}

export interface IndiaMartQueryListResponse {
  queries: IndiaMartQueryItem[]
  total: number
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_message: string | null
  using_dummy_data: boolean
}

export interface IndiaMartPrefillResponse {
  query_id: string
  unique_query_id: string
  source: EnquirySource
  notes: string
  can_create_inquiry?: boolean
  can_pickup: boolean
  is_picked_up: boolean
  linked_enquiry_id: string | null
  client_hint: {
    mode: 'new' | 'existing'
    newClient?: {
      company_name?: string
      branch_name?: string
      contact_name?: string
      phone?: string
      email?: string
      city?: string
      state?: string
      address_line1?: string
    }
    selectedClientId?: string
  }
}

export interface ManualEnquiryForm {
  /** When set, updates this enquiry in place (email / matcher flows) instead of creating a new enquiry. */
  targetEnquiryId?: string | null
  clientMode: 'existing' | 'new'
  /** Selected branch id (UUID) for DB clients; dummy-* for demo clients. */
  selectedClientId: string | null
  /** DB client_employees.id — quote is for this contact (must belong to selected branch). */
  clientEmployeeId?: string | null
  /** When creating a new company, optional extra contact stored as branch employee and used for the quote. */
  newClientEmployee?: {
    addressCode?: string | null
    fullName: string
    phone?: string | null
    email?: string | null
    department?: string | null
    designation?: string | null
  }
  newClient: {
    company_name: string
    gst_number: string
    industry: string
    branch_name: string
    contact_name: string
    designation: string
    phone: string
    email: string
    city: string
    state: string
    pincode: string
    address_line1: string
    country: string
    /** @deprecated use address_line1 */
    address: string
  }
  lineItems: ManualLineItem[]
  priority: 'Normal' | 'High' | 'Urgent'
  notes: string
  nextFollowUpDate?: string
  nextFollowUpNote?: string | null
  /** Optional supplier + pricing context for manual flow (stored on enquiry raw JSON when supported). */
  supplierPricing?: ManualSupplierPricingContext | null
  /** Net total section: optional P&amp;F toggle and override amount (defaults to 3% of subtotal). */
  orderTotals?: ManualOrderTotals | null
}

export interface ManualOrderTotals {
  pfApplicable: boolean
  /** ``percent`` = draft is % of subtotal; ``amount`` = flat INR. */
  pfMode?: 'percent' | 'amount'
  /** When P&amp;F applies and omitted, server uses 3% of subtotal. */
  pfAmount?: number | null
  /** Set when pfMode is percent. */
  pfRate?: number | null
  freightApplicable?: boolean
  /** ``percent`` = draft is % of subtotal; ``amount`` = flat INR. */
  freightMode?: 'percent' | 'amount'
  freightAmount?: number | null
  /** Set when freightMode is percent. */
  freightRate?: number | null
}

export interface ManualSupplierPricingContext {
  supplier_id: string
  supplier_name: string
  margin_multiplier: number
  subtotal: number
  gst_amount: number
  pf_amount: number
  grand_total: number
}

export interface ClientConfig {
  company_name: string
  address: string
  gst_number: string
  phone: string
  email: string
  default_gst_rate: number
  default_pf_rate: number
  quote_validity_days: number
  [key: string]: unknown
}

export interface AgentEvent {
  type:
    | 'enquiry_created'
    | 'agent_start'
    | 'agent_complete'
    | 'agent_warning'
    | 'agent_error'
    | 'result'
    | 'stream_end'
    | 'hitl_required'
    | 'hitl_resumed'
    | 'client_hitl_required'
    | 'client_hitl_resumed'
    | 'client_verification_result'
    | 'approved_and_sent'
  agent?: string
  message?: string
  detail?: string
  status?: string
  data?: Record<string, unknown>
  enquiry_id?: string
  enquiry_number?: string
  timestamp?: string
  hitl_context?: HITLContext
  cycle?: number
  client_context?: ClientVerificationContext
}

export interface HITLContext {
  recommended_action: string
  summary: string
  options_available: string[]
  draft_email: string | null
  draft_quotation: Record<string, unknown> | null
}

export interface ClientSummary {
  id: string
  company_name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  erp_code?: string | null
  is_erp_synced?: boolean
}

export interface ClientVerificationContext {
  type: 'client_verification'
  summary: string
  recommended_action: 'confirm_new' | 'confirm_existing'
  extracted_client: {
    company_name?: string | null
    contact_name?: string | null
    email?: string | null
    phone?: string | null
    city?: string | null
    country?: string | null
  }
  matched_client?: ClientSummary | null
  client_is_new: boolean
  available_clients: ClientSummary[]
}

export interface ClientVerificationResponse {
  enquiry_id: string
  decision: 'confirmed_new' | 'matched_existing' | 'skip'
  client_id: string | null
  company_name: string | null
  erp_export_available: boolean
  erp_export_path: string | null
  message: string
}

export interface HITLStateResponse {
  awaiting_human: boolean
  hitl_cycle: number
  flow_type: string | null
  current_step: string | null
  hitl_context: HITLContext | null
  hitl_history: HITLHistoryEntry[]
  next_nodes: string[]
}

export interface HITLHistoryEntry {
  cycle: number
  decision: string
  prompt: string | null
  timestamp: string
  ai_interpretation?: {
    new_flow_type: string
    action: string
    reasoning: string
  }
}

// ── Valve configurator ────────────────────────────────────────────────────
export type OperatorKey =
  | 'bare_shaft'
  | 'manual'
  | 'gear_box'
  | 'da'
  | 'sa'
  | 'electric_actuator'
  | 'pneumatic_rack_pinion'
  | 'pneumatic_cylinder'

export interface ValveProduct {
  id: string
  type: string
  /** Masters / catalog API key (e.g. ``butterfly_valve``, ``fp_needle_valve``). */
  catalog_category?: string | null
  variant_type?: string | null
  construction: string | null
  valve_size: string | null
  size_id_mm?: string | null
  size_mm?: string | null
  end_connection_1?: string | null
  end_connection_2?: string | null
  hose_nipple_moc?: string | null
  hose_cap_moc?: string | null
  sms_nut_moc?: string | null
  tc_od?: string | null
  din_nut_moc?: string | null
  swivel_nut_moc?: string | null
  flange_nut_moc?: string | null
  bore_type: string | null
  end_connection: string | null
  pressure: string | null
  rating?: string | null
  temperature_range?: string | null
  wall_thickness?: string | null
  body: string | null
  ball_disc?: string | null
  ball?: string | null
  stem: string | null
  seat: string | null
  fasteners: string | null
  /** Flush bottom ball rows (``catalog_fp_ball_flush``). */
  product_sheet?: string | null
  base_price: number | null
  has_price: boolean
  /** Free-text description when ``catalog_category`` is ``__temporary_product__``. */
  temporary_description?: string | null
  /** Matrix damper spec picks (``fp_damper_*`` sheets). */
  damper_field_values?: Record<string, string> | null
}

export interface OperatorModel {
  id: string
  model_name: string
  operator_type: 'da' | 'sa'
  /** Nominal port size from the operator sheet (e.g. `1 1/2"`). */
  size: string | null
  base_price: number | null
}

export interface OperatorOption {
  key: OperatorKey
  label: string
  description: string
  has_price: boolean
  price: number | null
  models?: OperatorModel[]
  unlocks_accessories: boolean
}

export interface AccessoryItem {
  id: string
  sr_no: number
  type: string
  price: number | null
  /** Free-text accessory not in catalog (quotation-specific). */
  is_temporary?: boolean
  temporary_description?: string | null
}

export interface Accessories {
  sov: AccessoryItem[]
  limit_switch_boxes: AccessoryItem[]
  positioners: AccessoryItem[]
}

export interface BracketCoupler {
  id: string
  size: string
  price: number | null
}

export interface OperatorsResponsePayload {
  operator_options: OperatorOption[]
  da_operators: OperatorModel[]
  sa_operators: OperatorModel[]
  bracket: BracketCoupler | null
  /** `2 Way` or `3 Way`, extracted from the valve's construction. */
  construct_way: string | null
}

export interface AssemblyPriceBreakdown {
  subtotal: number
  has_unknown_prices: boolean
  unknown_components: string[]
  breakdown: Array<{ component: string; price: number | null }>
}

export interface CascadeStep {
  key: string
  label: string
}

export interface ValveSpecSelections {
  /** Catalog API key from ``/api/configurator/valve-types`` (e.g. ``butterfly_valve``). */
  catalog_category: string | null
  /** Butterfly (and similar) rows filtered to this ``variant_type`` when set. */
  catalog_variant_type?: string | null
  /** Disambiguates nav label when several leaves share the same catalog key. */
  catalog_nav_slug?: string | null
  /** Display label for dynamic Others sheets. */
  catalog_display_label?: string | null
  /** Values keyed by DB / cascade field name. */
  field_values: Record<string, string>
}

export interface AssembledProduct {
  id: string
  valve: ValveProduct | null
  /** Fitting add-on after qualifying hose selection (``fp_hose_tuder`` / thunder / PVC nylon). */
  fitting?: ValveProduct | null
  /** Hose end 1 fitting (primary; qty 2 covers both ends with same SKU). */
  fitting_end_1?: ValveProduct | null
  /** End 1 explicitly has no fitting. */
  fitting_end_1_bare?: boolean
  /** Hose end 2 fitting when ``fitting_end_1_qty`` is 1. */
  fitting_end_2?: ValveProduct | null
  /** End 2 explicitly has no fitting. */
  fitting_end_2_bare?: boolean
  /** Qty of end-1 fitting on the hose assembly (1 = second end needs its own pick). */
  fitting_end_1_qty?: 1 | 2
  operator_key: OperatorKey | null
  operator_model: OperatorModel | null
  /** Supplier selected for this assembled product (per-product supplier selection). */
  supplier_id: string | null
  supplier_name?: string | null
  component_pricing?: Record<
    string,
    {
      enabled: boolean
      supplier_id?: string | null
      supplier_name?: string | null
      base_price?: number | null
      temp_price?: number | null
      discount_pct?: number | null
      final_price?: number | null
    }
  >
  sov: AccessoryItem | null
  limit_switch_box: AccessoryItem | null
  positioner: AccessoryItem | null
  bracket: BracketCoupler | null
  include_bracket: boolean
  /** Cut length for hose products (masters price is per meter). */
  hose_length?: number | null
  hose_length_unit?: 'm' | 'cm' | 'mm' | null
  /** True when the main product is a free-text temporary line (not from catalog). */
  is_temporary?: boolean
  /** Product family context for temporary products. */
  temporary_product_family?: 'Valves' | 'Hoses' | 'Dampers' | 'Others' | null
  quantity: number
  unit?: string | null
  customer_discount_pct?: number | null
  unit_price: number | null
  has_unknown_prices: boolean
  unknown_components: string[]
  price_breakdown: Array<{ component: string; price: number | null }>
}

export interface OthersSheet {
  id: string
  category_id: string
  name: string
  catalog_key: string
  sort_order: number
  row_count?: number
}

export interface OthersCategory {
  id: string
  name: string
  sort_order: number
  sheets: OthersSheet[]
}

export interface OthersSheetRow {
  id: string
  row_id: string
  sheet_id: string
  sr_no: number | null
  description: string | null
  price_inr: number | null
}

export interface MasterSheetDefaultSupplier {
  catalog_table: string
  nav_slug: string | null
  supplier_id: string
  supplier_name: string | null
}

export interface SupplierResponse {
  id: string
  name: string
  primary_category_key: string
  /** Empty = all masters catalog sheets. */
  category_keys: string[]
  contact_person: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  is_preferred: boolean
  created_at: string
}

export interface SupplierCategoryPricing {
  id: string
  supplier_id: string
  category_key: string
  margin_multiplier: number | null
  supplier_discount_pct: number | null
  customer_discount_pct: number | null
}

export interface ResolvedSupplierCategoryPricing {
  margin_multiplier: number
  supplier_discount_pct: number
  customer_discount_pct: number
}

export interface SupplierPriceRow {
  id: string
  supplier_id: string
  catalog_table: string
  catalog_row_id: string
  list_price_inr: number
  discount_pct_override: number | null
  effective_discount_pct: number
  cost_to_parth: number
}

export interface PricingConfigResponse {
  margin_multiplier: number
  default_customer_discount_pct: number
  default_supplier_id: string | null
  default_supplier_name: string | null
}

export interface PriceCalculationResult {
  list_price: number
  supplier_discount_pct: number
  cost_to_parth: number
  margin_multiplier: number
  parth_selling_price: number
  customer_discount_pct: number
  customer_discount_amount: number
  final_unit_price: number
  quantity: number
  line_total: number
}

export interface PreviewRow {
  excel_data: Record<string, string>
  matched_catalog: {
    row_id: string
    description: string
  } | null
  price: number | null
  status: 'will_create' | 'will_update' | 'no_match'
  reason: string | null
}

export interface PreviewResult {
  total: number
  will_match: number
  will_fail: number
  will_update?: number
  will_create?: number
  preview_rows: PreviewRow[]
}

export interface ImportResult {
  total: number
  matched: number
  unmatched: number
  updated: number
  created: number
  unmatched_rows: Record<string, string>[]
}
