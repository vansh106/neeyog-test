export interface EnquiryListItem {
  enquiry_id: string
  client_org_name?: string
  status: string
  flow_type: string | null
  input_type: string
  created_at: string
  erp_export_available?: boolean
}

export interface EnquiryResponse {
  enquiry_id: string
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

export interface EnquiryDetail {
  enquiry_id: string
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
}

export interface QuotationLineItem {
  description: string
  size: string
  quantity: number
  unit: string
  unit_price: number
  line_total: number
  total?: number
  product_name?: string
  category?: string | null
  catalog_table?: string | null
  catalog_row_id?: string | null
}

export interface Quotation {
  quotation_id: string
  enquiry_id: string
  quote_number: string
  client_name: string
  client_company: string | null
  client_email: string | null
  client_phone: string | null
  line_items: QuotationLineItem[]
  subtotal: number
  gst_rate: number
  gst_amount: number
  pf_rate: number
  pf_amount: number
  freight_note: string
  total_amount: number
  validity_days: number
  status: string
  pdf_path: string | null
  notes: string | null
  created_at: string | null
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

export interface QuotationListItem {
  quotation_id: string
  quote_number: string
  client_name: string
  total_amount: number
  status: string
  created_at: string
}

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
  base_price: number
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
}

export interface ManualEnquiryForm {
  clientMode: 'existing' | 'new'
  /** Selected branch id (UUID) for DB clients; dummy-* for demo clients. */
  selectedClientId: string | null
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
  /** Optional supplier + pricing context for manual flow (stored on enquiry raw JSON when supported). */
  supplierPricing?: ManualSupplierPricingContext | null
}

export interface ManualSupplierPricingContext {
  supplier_id: string
  supplier_name: string
  margin_multiplier: number
  customer_discount_pct: number
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

export interface ValveProduct {
  id: string
  type: string
  /** Masters / catalog API key (e.g. ``butterfly_valve``, ``fp_needle_valve``). */
  catalog_category?: string | null
  variant_type?: string | null
  construction: string | null
  valve_size: string | null
  bore_type: string | null
  end_connection: string | null
  pressure: string | null
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
  /** Values keyed by DB / cascade field name. */
  field_values: Record<string, string>
}

export interface AssembledProduct {
  id: string
  valve: ValveProduct | null
  operator_key: OperatorKey | null
  operator_model: OperatorModel | null
  /** Supplier selected for this assembled product (per-product supplier selection). */
  supplier_id: string | null
  supplier_name?: string | null
  sov: AccessoryItem | null
  limit_switch_box: AccessoryItem | null
  positioner: AccessoryItem | null
  bracket: BracketCoupler | null
  include_bracket: boolean
  quantity: number
  unit_price: number | null
  has_unknown_prices: boolean
  unknown_components: string[]
  price_breakdown: Array<{ component: string; price: number | null }>
}

export interface SupplierResponse {
  id: string
  name: string
  primary_category_key: string
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
