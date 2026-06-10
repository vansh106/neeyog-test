'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, UserPlus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency, formatPriceOrTbd, isPositivePrice, PRICE_TBD_LABEL } from '@/lib/utils'
import { useWarmupMatcherCatalog } from '@/hooks/useValveCatalog'
import { clientsApi, suppliersApi } from '@/lib/api'
import { ValveConfigurator, CompletedProductCard } from '@/components/configurator/ValveConfigurator'
import {
  assemblyLabel,
  assemblyPartComponentKey,
  assemblyPartUnitMultiplier,
  assembledToLineItem,
  catalogPartsForAssembly,
  operatorLabel,
  uuidv4,
} from '@/lib/manualAssemblyLineItem'
import type {
  AssembledProduct,
  BranchResponse,
  ClientEmployeeResponse,
  CompanyResponse,
  ManualEnquiryCreateForm,
  ManualEnquiryForm,
  ManualLineItem,
  PriceCalculationResult,
  SupplierResponse,
} from '@/types'
import { ENQUIRY_SOURCE_OPTIONS } from '@/lib/enquirySource'
import { CLIENT_INDUSTRY_OPTIONS, type EnquirySource } from '@/types'

const BRANCH_PRIMARY_CONTACT = '__branch_primary__'

type MatcherClientHint = {
  mode: 'existing' | 'new'
  selectedClientId?: string | null
  newClient?: Partial<{
    company_name: string
    branch_name: string
    contact_name: string
    phone: string
    email: string
    city: string
    address_line1: string
  }>
}

export type ManualFormStage = 'client' | 'products' | 'full'

type Props = {
  /** ``client`` = create enquiry only; ``products`` = add line items + quote; ``full`` = legacy combined form. */
  stage?: ManualFormStage
  onSubmitManual: (form: ManualEnquiryForm) => void
  /** Called when ``stage`` is ``client`` — creates enquiry without products. */
  onCreateEnquiry?: (form: ManualEnquiryCreateForm) => void
  isProcessing: boolean
  /** When opening Manual Entry from Emails → Process, pre-fills Notes once. */
  prefillNotesFromEnquiry?: string | null
  /** Completing an existing email enquiry — server merges quote onto this id. */
  targetEnquiryId?: string | null
  /** Pre-select catalog sheet + cascade (from matcher). Multiple RFQ lines → multiple configurators. */
  matcherSeed?: {
    catalogKey: string
    lines?: Array<{ filledCascade: Record<string, string>; quantity?: number }>
    /** @deprecated prefer `lines` */
    filledCascade?: Record<string, string>
  } | null
  matcherClientHint?: MatcherClientHint | null
  /** Bump to remount valve configurator (e.g. clear matcher seed for full manual). */
  matcherSeedVersion?: number
  /** Read-only client label shown when ``stage`` is ``products``. */
  clientSummaryLabel?: string | null
  /** Pre-select quote contact from enquiry ``parsed_data``. */
  initialClientEmployeeId?: string | null
}

const SELECT_EMPTY = '__none__'
const DEFAULT_GST_RATE = 0.18
const DEFAULT_PF_PERCENT = 3
const DEFAULT_PF_RATE = DEFAULT_PF_PERCENT / 100

export type ChargeMode = 'percent' | 'amount'
/** @deprecated Use ChargeMode */
export type FreightChargeMode = ChargeMode

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function resolvePfAmount(
  subtotal: number,
  pfApplicable: boolean,
  pfMode: ChargeMode,
  pfDraft: string,
): { pf: number; defaultPf: number; pfRate: number | null } {
  const defaultPf = roundMoney(subtotal * DEFAULT_PF_RATE)
  if (!pfApplicable) return { pf: 0, defaultPf, pfRate: null }
  const raw = pfDraft.trim().replace(/,/g, '')
  if (!raw) {
    if (pfMode === 'percent') {
      return { pf: defaultPf, defaultPf, pfRate: DEFAULT_PF_PERCENT }
    }
    return { pf: defaultPf, defaultPf, pfRate: null }
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    if (pfMode === 'percent') {
      return { pf: defaultPf, defaultPf, pfRate: DEFAULT_PF_PERCENT }
    }
    return { pf: defaultPf, defaultPf, pfRate: null }
  }
  if (pfMode === 'percent') {
    const pf = roundMoney(subtotal * (n / 100))
    return { pf, defaultPf, pfRate: n }
  }
  return { pf: roundMoney(n), defaultPf, pfRate: null }
}

function resolveFreightAmount(
  subtotal: number,
  freightApplicable: boolean,
  freightMode: ChargeMode,
  freightDraft: string,
): { freight: number; freightRate: number | null } {
  if (!freightApplicable) return { freight: 0, freightRate: null }
  const raw = freightDraft.trim().replace(/,/g, '')
  if (!raw) return { freight: 0, freightRate: null }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return { freight: 0, freightRate: null }
  if (freightMode === 'percent') {
    const freight = roundMoney(subtotal * (n / 100))
    return { freight, freightRate: n }
  }
  return { freight: roundMoney(n), freightRate: null }
}

const toSelectValue = (v: string | null | undefined) =>
  v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY
const fromSelectValue = (v: string | null | undefined) => (!v || v === SELECT_EMPTY ? '' : v)

function computeTaxTotals(
  subtotal: number,
  pfApplicable: boolean,
  pfMode: ChargeMode,
  pfDraft: string,
  freightApplicable: boolean,
  freightMode: ChargeMode,
  freightDraft: string,
) {
  const gst = roundMoney(subtotal * DEFAULT_GST_RATE)
  const { pf, defaultPf } = resolvePfAmount(subtotal, pfApplicable, pfMode, pfDraft)
  const { freight } = resolveFreightAmount(subtotal, freightApplicable, freightMode, freightDraft)
  return {
    subtotal,
    gst,
    pf,
    defaultPf,
    freight,
    grand: roundMoney(subtotal + gst + pf + freight),
  }
}

/** Right column width for subtotal / GST / P&F / freight amounts (aligned). */
const NET_TOTAL_AMOUNT_COL =
  'block w-full text-right font-mono text-[13px] tabular-nums leading-tight'

const NET_AMOUNT_INPUT_CLASS = cn(
  'h-6 min-h-0 w-[8ch] max-w-full min-w-0 shrink-0 rounded border border-input bg-white',
  'px-0 py-0 text-right font-mono text-[13px] tabular-nums leading-tight',
  'appearance-textfield [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
  'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

function ChargeModeToggle({
  mode,
  disabled,
  onPercent,
  onAmount,
}: {
  mode: ChargeMode
  disabled: boolean
  onPercent: () => void
  onAmount: () => void
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-surface-border bg-white">
      <button
        type="button"
        disabled={disabled}
        onClick={onPercent}
        className={cn(
          'px-2 py-0.5 text-[11px] font-semibold transition-colors',
          mode === 'percent' ? 'bg-brand-navy-500 text-white' : 'text-gray-700 hover:bg-[#F4F5F0]',
        )}
      >
        %
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onAmount}
        className={cn(
          'border-l border-surface-border px-2 py-0.5 text-[11px] font-semibold transition-colors',
          mode === 'amount' ? 'bg-brand-navy-500 text-white' : 'text-gray-700 hover:bg-[#F4F5F0]',
        )}
      >
        ₹
      </button>
    </div>
  )
}

function NetChargeRow({
  label,
  checkboxAriaLabel,
  checked,
  onCheckedChange,
  controlsDisabled,
  mode,
  onModePercent,
  onModeAmount,
  draft,
  onDraftChange,
  percentPlaceholder,
  amountPlaceholder,
  percentAriaLabel,
  amountAriaLabel,
  appliedAmount,
}: {
  label: string
  checkboxAriaLabel: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  controlsDisabled: boolean
  mode: ChargeMode
  onModePercent: () => void
  onModeAmount: () => void
  draft: string
  onDraftChange: (value: string) => void
  percentPlaceholder: string
  amountPlaceholder: string
  percentAriaLabel: string
  amountAriaLabel: string
  appliedAmount: number | null | undefined
}) {
  const isPercent = mode === 'percent'
  const showApplied =
    checked && isPercent && appliedAmount != null && appliedAmount > 0

  return (
    <div className="contents text-surface-muted">
      <div className="flex min-w-0 flex-nowrap items-center gap-2 py-0">
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            aria-label={checkboxAriaLabel}
            className="size-3.5 shrink-0 rounded border-[#B8BFB4] text-brand-green-600 focus:ring-brand-green-500/30"
          />
          <span className="whitespace-nowrap">{label}</span>
        </label>
        {checked && (
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
            <ChargeModeToggle
              mode={mode}
              disabled={controlsDisabled}
              onPercent={onModePercent}
              onAmount={onModeAmount}
            />
            {isPercent && (
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={controlsDisabled}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={percentPlaceholder}
                className="h-7 w-[3.25rem] shrink-0 px-1.5 py-0 font-mono text-[13px] tabular-nums text-right"
                aria-label={percentAriaLabel}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex w-full flex-col items-end justify-center self-center leading-none">
        {checked &&
          (isPercent ? (
            showApplied ? (
              <span className={cn(NET_TOTAL_AMOUNT_COL, 'whitespace-nowrap')}>
                <span className="text-[11px] font-sans text-surface-muted">Applied: </span>
                {formatCurrency(appliedAmount!)}
              </span>
            ) : null
          ) : (
            <div className="flex w-full items-center justify-end gap-0 font-mono text-[13px] tabular-nums">
              <span className="shrink-0 leading-tight">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={controlsDisabled}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={amountPlaceholder.replace(/[^\d.]/g, '') || '0.00'}
                className={NET_AMOUNT_INPUT_CLASS}
                aria-label={amountAriaLabel}
              />
            </div>
          ))}
      </div>
    </div>
  )
}

function isValidEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').slice(-10)
}

type ProductPricingCalc = {
  productId: string
  label: string
  supplierName: string | null
  ok: boolean
  missing: string[]
  rows: Array<{ component: string; calc: PriceCalculationResult; unitMult?: number }>
  assemblyUnit: number
  lineTotal: number
}

function dummyCompaniesForSearch(): CompanyResponse[] {
  const mk = (
    coId: string,
    company_name: string,
    bid: string,
    contact_name: string,
    email: string,
    phone: string,
    city: string,
    erp: string,
  ): CompanyResponse => ({
    id: coId,
    company_name,
    gst_number: null,
    industry: null,
    erp_code: erp,
    is_erp_synced: true,
    total_enquiry_count: 0,
    branch_count: 1,
    is_active: true,
    created_at: '',
    branches: [
      {
        id: bid,
        branch_name: 'Main',
        is_headquarters: true,
        contact_name,
        designation: null,
        phone,
        email,
        city,
        state: null,
        pincode: null,
        address_line1: null,
        country: 'India',
        enquiry_count: 0,
        is_active: true,
      },
    ],
  })
  return [
    mk('dc-1', 'Bharat Industrial Supplies', 'dummy-001', 'Ramesh Joshi', 'ramesh@bharatind.com', '9823001001', 'Pune', 'FC0101'),
    mk('dc-2', 'Nashik Engineering Works', 'dummy-002', 'Sunita Patil', 'sunita@nashikeng.in', '9765400200', 'Nashik', 'FC0202'),
    mk('dc-3', 'Maharashtra Process Equipment', 'dummy-003', 'Vijay Kulkarni', 'vijay@mpequip.com', '9712300303', 'Mumbai', 'FC0303'),
    mk('dc-4', 'Aurangabad Fluid Systems', 'dummy-004', 'Pradeep Shinde', 'pradeep@afsystems.in', '9823400404', 'Aurangabad', 'FC0404'),
  ]
}

/** Build plain-text email for parser ingestion. */
function buildEmailText(
  form: ManualEnquiryForm,
  products: AssembledProduct[],
  existingCompany: CompanyResponse | null,
  existingBranch: BranchResponse | null,
  productCalcs: ProductPricingCalc[],
  quoteEmployee: ClientEmployeeResponse | null,
): string {
  let company_name = ''
  let branch_name = ''
  let city = ''
  let state = ''
  let gst = ''
  let industry = ''
  let contact_name = ''
  let designation = ''
  let phone = ''
  let email = ''
  let address = ''
  let address_code = ''
  let department = ''

  if (form.clientMode === 'existing' && existingCompany && existingBranch) {
    company_name = existingCompany.company_name
    branch_name = existingBranch.branch_name
    city = existingBranch.city
    state = existingBranch.state || ''
    gst = existingCompany.gst_number || 'N/A'
    industry = existingCompany.industry || 'N/A'
    contact_name = existingBranch.contact_name || ''
    designation = existingBranch.designation || ''
    phone = existingBranch.phone || ''
    email = existingBranch.email || ''
    address = existingBranch.address_line1 || ''
    if (quoteEmployee) {
      contact_name = quoteEmployee.full_name
      designation = quoteEmployee.designation || ''
      phone = quoteEmployee.phone || phone
      email = quoteEmployee.email || email
      address_code = quoteEmployee.address_code || ''
      department = quoteEmployee.department || ''
    }
  } else if (form.clientMode === 'new') {
    const nc = form.newClient
    company_name = nc.company_name
    branch_name = nc.branch_name
    city = nc.city
    state = nc.state
    gst = nc.gst_number || 'N/A'
    industry = nc.industry || 'N/A'
    contact_name = nc.contact_name
    designation = nc.designation
    phone = nc.phone
    email = nc.email
    address = nc.address_line1 || nc.address
    const ne = form.newClientEmployee
    if (ne?.fullName?.trim()) {
      contact_name = ne.fullName.trim()
      if (ne.phone?.trim()) phone = ne.phone.trim()
      if (ne.email?.trim()) email = ne.email.trim()
      if (ne.designation?.trim()) designation = ne.designation.trim()
      address_code = ne.addressCode?.trim() || ''
      department = ne.department?.trim() || ''
    }
  }

  const subject = `Manual Enquiry — ${company_name || 'Client'}`

  const lines: string[] = []
  lines.push(`From: ${contact_name || 'Buyer'} <${email || 'unknown@example.com'}>`)
  if (company_name) lines.push(`Company: ${company_name}`)
  if (branch_name) lines.push(`Branch: ${branch_name}`)
  if (city || state) lines.push(`City: ${city}${state ? `, ${state}` : ''}`)
  if (form.clientMode === 'new' || (form.clientMode === 'existing' && existingCompany)) {
    lines.push(`GST: ${gst}`)
    lines.push(`Industry: ${industry}`)
  }
  if (contact_name) lines.push(`Contact: ${contact_name}`)
  if (address_code) lines.push(`Address Code: ${address_code}`)
  if (department) lines.push(`Department: ${department}`)
  if (designation) lines.push(`Designation: ${designation}`)
  if (phone) lines.push(`Phone: ${phone}`)
  if (email) lines.push(`Email: ${email}`)
  if (address) lines.push(`Address: ${address}`)
  lines.push(`Subject: ${subject}`)
  lines.push('')
  lines.push('Dear Sir,')
  lines.push('')
  lines.push('We require a quotation for the following items:')
  lines.push('')

  products.forEach((p, idx) => {
    const n = idx + 1
    const v = p.valve
    lines.push(`Product ${n}:`)
    if (v) {
      lines.push(`Type: ${v.type}${v.construction ? ` — ${v.construction}` : ''}`)
      if (v.valve_size) lines.push(`Size: ${v.valve_size}`)
      if (v.bore_type) lines.push(`Bore: ${v.bore_type}`)
      if (v.end_connection) lines.push(`Connection: ${v.end_connection}`)
      if (v.pressure) lines.push(`Pressure: ${v.pressure}`)
      const bodyBall = [v.body ? `Body: ${v.body}` : '', v.ball || v.ball_disc ? `Ball/Disc: ${v.ball ?? v.ball_disc}` : '']
        .filter(Boolean)
        .join(' | ')
      if (bodyBall) lines.push(bodyBall)
      const stemSeat = [v.stem ? `Stem: ${v.stem}` : '', v.seat ? `Seat: ${v.seat}` : '']
        .filter(Boolean)
        .join(' | ')
      if (stemSeat) lines.push(stemSeat)
      if (v.fasteners) lines.push(`Fasteners: ${v.fasteners}`)
    }
    lines.push(`Operator: ${operatorLabel(p.operator_key)}`)
    if (p.supplier_name) lines.push(`Supplier: ${p.supplier_name}`)
    if ((p.operator_key === 'da' || p.operator_key === 'sa') && p.operator_model) {
      lines.push(
        `  Model: ${p.operator_model.model_name}${
          p.operator_model.size ? ` (${p.operator_model.size})` : ''
        }`,
      )
    }
    if (p.sov) lines.push(`SOV: ${p.sov.type}`)
    if (p.limit_switch_box) lines.push(`Limit Switch Box: ${p.limit_switch_box.type}`)
    if (p.positioner) lines.push(`Positioner: ${p.positioner.type}`)
    lines.push(`Quantity: ${p.quantity}`)
    if (p.unit_price != null) {
      lines.push(`Unit Price: ${formatCurrency(p.unit_price)}`)
    } else {
      lines.push('Unit Price: Price on request')
    }
    lines.push('')
  })

  if (productCalcs.length) {
    lines.push('')
    lines.push('Supplier pricing breakdown:')
    productCalcs.forEach((pc, idx) => {
      lines.push(
        `Assembly ${idx + 1}: ${pc.label}${pc.supplierName ? ` (Supplier: ${pc.supplierName})` : ''}`,
      )
      if (!pc.ok) {
        lines.push(`  Missing prices for: ${pc.missing.join(', ')}`)
        return
      }
      pc.rows.forEach((r) => {
        lines.push(
          `  ${r.component}: list ${formatCurrency(r.calc.list_price)} → unit ${formatCurrency(r.calc.final_unit_price)} (line ${formatCurrency(r.calc.line_total)})`,
        )
      })
    })
  }

  if (form.notes.trim()) {
    lines.push(`Additional notes: ${form.notes.trim()}`)
    lines.push('')
  }

  lines.push(`Priority: ${form.priority}`)
  lines.push('')
  lines.push('Please send us your best quotation.')
  lines.push('')
  lines.push('Regards,')
  lines.push(contact_name || 'Buyer')
  if (company_name) lines.push(company_name)
  if (phone) lines.push(phone)
  lines.push('[MANUAL_ENTRY_SOURCE]')

  return lines.join('\n')
}

export default function ManualEntryForm({
  stage = 'full',
  onSubmitManual,
  onCreateEnquiry,
  isProcessing,
  prefillNotesFromEnquiry,
  targetEnquiryId,
  matcherSeed,
  matcherClientHint,
  matcherSeedVersion = 0,
  clientSummaryLabel,
  initialClientEmployeeId,
}: Props) {
  const showClientSection = stage !== 'products'
  const showProductsSection = stage !== 'client'
  useWarmupMatcherCatalog(matcherSeed?.catalogKey ?? null)

  const [enquirySource, setEnquirySource] = useState<EnquirySource>('manual')
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing')
  const [newClient, setNewClient] = useState({
    company_name: '',
    gst_number: '',
    industry: '',
    branch_name: 'Head Office',
    contact_name: '',
    designation: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    pincode: '',
    address_line1: '',
    country: 'India',
    address: '',
  })
  useEffect(() => {
    if (!matcherClientHint) return
    if (matcherClientHint.mode === 'existing' && matcherClientHint.selectedClientId) {
      setClientMode('existing')
      for (const co of dummyCompaniesForSearch()) {
        const br = (co.branches || []).find((b) => b.id === matcherClientHint.selectedClientId)
        if (br) {
          setSelectedCompany(co)
          setSelectedBranchId(br.id)
          setCompanyQuery(co.company_name)
          break
        }
      }
      return
    }
    if (matcherClientHint.mode === 'new' && matcherClientHint.newClient) {
      setClientMode('new')
      const nc = matcherClientHint.newClient
      setNewClient((prev) => ({
        ...prev,
        company_name: nc.company_name ?? prev.company_name,
        branch_name: nc.branch_name ?? prev.branch_name,
        contact_name: nc.contact_name ?? prev.contact_name,
        phone: nc.phone ?? prev.phone,
        email: nc.email ?? prev.email,
        city: nc.city ?? prev.city,
        address_line1: nc.address_line1 ?? prev.address_line1,
        address: nc.address_line1 ?? prev.address,
      }))
    }
  }, [matcherClientHint])

  useEffect(() => {
    if (!initialClientEmployeeId || stage === 'client') return
    setSelectedClientEmployeeId(initialClientEmployeeId)
  }, [initialClientEmployeeId, stage])

  const [companyQuery, setCompanyQuery] = useState('')
  const [debouncedCompanyQuery, setDebouncedCompanyQuery] = useState('')
  const [companyOptions, setCompanyOptions] = useState<CompanyResponse[]>([])
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyResponse | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [addBranchSaving, setAddBranchSaving] = useState(false)
  const [inlineBranch, setInlineBranch] = useState({
    branch_name: '',
    contact_name: '',
    designation: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    pincode: '',
    address_line1: '',
    country: 'India',
  })

  const [assembledProducts, setAssembledProducts] = useState<AssembledProduct[]>([])
  const [activeConfigIds, setActiveConfigIds] = useState<string[]>([uuidv4()])
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!matcherSeed?.catalogKey) {
      if (matcherSeedVersion > 0) setActiveConfigIds([uuidv4()])
      return
    }
    const n = matcherSeed.lines && matcherSeed.lines.length > 0 ? matcherSeed.lines.length : 1
    setActiveConfigIds(Array.from({ length: n }, () => uuidv4()))
  }, [matcherSeed, matcherSeedVersion])

  const [errors, setErrors] = useState<Record<string, string>>({})

  const [branchEmployees, setBranchEmployees] = useState<ClientEmployeeResponse[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [selectedClientEmployeeId, setSelectedClientEmployeeId] = useState<string | null>(null)
  const [inlineNewEmployeeAddressCode, setInlineNewEmployeeAddressCode] = useState('')
  const [inlineNewEmployeeName, setInlineNewEmployeeName] = useState('')
  const [inlineNewEmployeePhone, setInlineNewEmployeePhone] = useState('')
  const [inlineNewEmployeeEmail, setInlineNewEmployeeEmail] = useState('')
  const [inlineNewEmployeeDepartment, setInlineNewEmployeeDepartment] = useState('')
  const [inlineNewEmployeeDesignation, setInlineNewEmployeeDesignation] = useState('')
  const [addEmployeeSaving, setAddEmployeeSaving] = useState(false)
  const [addEmployeeErr, setAddEmployeeErr] = useState<string | null>(null)
  const [newClientQuoteEmployeeAddressCode, setNewClientQuoteEmployeeAddressCode] = useState('')
  const [newClientQuoteEmployeeName, setNewClientQuoteEmployeeName] = useState('')
  const [newClientQuoteEmployeePhone, setNewClientQuoteEmployeePhone] = useState('')
  const [newClientQuoteEmployeeEmail, setNewClientQuoteEmployeeEmail] = useState('')
  const [newClientQuoteEmployeeDepartment, setNewClientQuoteEmployeeDepartment] = useState('')
  const [newClientQuoteEmployeeDesignation, setNewClientQuoteEmployeeDesignation] = useState('')

  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [productCalcs, setProductCalcs] = useState<ProductPricingCalc[]>([])
  const [pricingLoading, setPricingLoading] = useState(false)
  const [tempQuoteUnitByProduct, setTempQuoteUnitByProduct] = useState<Record<string, string>>({})
  const [customerDiscountByProduct, setCustomerDiscountByProduct] = useState<Record<string, string>>({})
  const [pfApplicable, setPfApplicable] = useState(true)
  const [pfMode, setPfMode] = useState<ChargeMode>('percent')
  const [pfAmountDraft, setPfAmountDraft] = useState('')
  const [freightApplicable, setFreightApplicable] = useState(false)
  const [freightMode, setFreightMode] = useState<ChargeMode>('amount')
  const [freightDraft, setFreightDraft] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompanyQuery(companyQuery), 300)
    return () => clearTimeout(t)
  }, [companyQuery])

  useEffect(() => {
    let cancelled = false
    clientsApi
      .searchCompanies(debouncedCompanyQuery.trim() || undefined, 40)
      .then((rows) => {
        if (!cancelled) setCompanyOptions(rows)
      })
      .catch(() => {
        if (!cancelled) setCompanyOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [debouncedCompanyQuery])

  const mergedCompanyOptions = useMemo(() => {
    const q = debouncedCompanyQuery.trim().toLowerCase()
    const dummies = dummyCompaniesForSearch().filter((co) => !q || co.company_name.toLowerCase().includes(q))
    return [...dummies, ...companyOptions]
  }, [companyOptions, debouncedCompanyQuery])

  useEffect(() => {
    if (!selectedCompany) {
      setSelectedBranchId(null)
      return
    }
    const active = (selectedCompany.branches || []).filter((b) => b.is_active)
    if (active.length === 1) {
      setSelectedBranchId(active[0].id)
      return
    }
    setSelectedBranchId((cur) => {
      if (cur && active.some((b) => b.id === cur)) return cur
      return null
    })
  }, [selectedCompany])

  useEffect(() => {
    if (clientMode === 'new') {
      setSelectedCompany(null)
      setSelectedBranchId(null)
      setCompanyQuery('')
      setCompanyMenuOpen(false)
    }
  }, [clientMode])

  useEffect(() => {
    setSelectedClientEmployeeId(null)
    setBranchEmployees([])
    setAddEmployeeErr(null)
    if (clientMode !== 'existing' || !selectedCompany || !selectedBranchId) return
    if (selectedBranchId.startsWith('dummy-')) return
    let cancelled = false
    setEmployeesLoading(true)
    clientsApi
      .listBranchEmployees(selectedCompany.id, selectedBranchId)
      .then((rows) => {
        if (!cancelled) setBranchEmployees(rows)
      })
      .catch(() => {
        if (!cancelled) setBranchEmployees([])
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientMode, selectedCompany?.id, selectedBranchId])

  const selectedQuoteEmployee = useMemo((): ClientEmployeeResponse | null => {
    if (!selectedClientEmployeeId) return null
    const sid = selectedClientEmployeeId.toLowerCase()
    return branchEmployees.find((e) => e.id.toLowerCase() === sid) ?? null
  }, [branchEmployees, selectedClientEmployeeId])

  const quoteContactSelectLabel = useMemo(() => {
    if (!selectedClientEmployeeId) return 'Branch primary contact (above)'
    if (selectedQuoteEmployee) {
      const n = selectedQuoteEmployee.full_name?.trim() || 'Contact'
      return selectedQuoteEmployee.email ? `${n} · ${selectedQuoteEmployee.email}` : n
    }
    return employeesLoading ? 'Loading…' : 'Saved contact'
  }, [selectedClientEmployeeId, selectedQuoteEmployee, employeesLoading])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [sList] = await Promise.all([
          suppliersApi.getSuppliers(true),
        ])
        if (cancelled) return
        setSuppliers(sList)
      } catch {
        if (!cancelled) {
          setSuppliers([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedBranch = useMemo((): BranchResponse | null => {
    if (!selectedCompany || !selectedBranchId) return null
    return (selectedCompany.branches || []).find((b) => b.id === selectedBranchId) ?? null
  }, [selectedCompany, selectedBranchId])

  const defaultClientDiscount = useMemo(() => {
    if (clientMode !== 'existing') return null
    const v = selectedCompany?.default_discount_pct
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }, [clientMode, selectedCompany?.default_discount_pct])

  const totalEstimate = useMemo(() => {
    const parseOverride = (id: string): number | null => {
      const raw = (tempQuoteUnitByProduct[id] ?? '').trim()
      if (!raw) return null
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) return null
      return n
    }

    const parseDiscount = (id: string): number => {
      const raw = (customerDiscountByProduct[id] ?? '').trim()
      if (raw) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) return Math.min(n, 100)
      }
      return defaultClientDiscount ?? 0
    }

    const discountedUnit = (id: string, unit: number): number => {
      const pct = parseDiscount(id)
      return unit * (1 - pct / 100)
    }

    if (productCalcs.length && productCalcs.every((c) => c.ok)) {
      return assembledProducts.reduce((sum, p) => {
        const ov = parseOverride(p.id)
        if (ov != null) return sum + discountedUnit(p.id, ov) * p.quantity
        const pc = productCalcs.find((c) => c.productId === p.id)
        return sum + discountedUnit(p.id, pc?.assemblyUnit ?? 0) * p.quantity
      }, 0)
    }
    return assembledProducts.reduce((sum, p) => {
      const ov = parseOverride(p.id)
      if (ov != null) return sum + discountedUnit(p.id, ov) * p.quantity
      if (p.unit_price == null) return sum
      return sum + discountedUnit(p.id, p.unit_price) * p.quantity
    }, 0)
  }, [assembledProducts, customerDiscountByProduct, defaultClientDiscount, productCalcs, tempQuoteUnitByProduct])

  useEffect(() => {
    if (assembledProducts.length === 0) {
      setProductCalcs([])
      setPricingLoading(false)
      return
    }
    let cancelled = false
    setPricingLoading(true)
    ;(async () => {
      const out: ProductPricingCalc[] = []
      for (const p of assembledProducts) {
        const supplierId = p.supplier_id
        const componentKeyForPart = assemblyPartComponentKey
        const parts = catalogPartsForAssembly(p)
        const missing: string[] = []
        if (parts.length === 0) missing.push('Valve configuration')
        if (suppliers.length > 0 && !supplierId) missing.push('Supplier selection')
        const rows: Array<{ component: string; calc: PriceCalculationResult; unitMult?: number }> = []
        if (supplierId || p.component_pricing) {
          for (const part of parts) {
            const compKey = componentKeyForPart(part.label)
            const partSupplierId = compKey
              ? (p.component_pricing?.[compKey]?.supplier_id ?? supplierId)
              : supplierId
            if (!partSupplierId) {
              missing.push(`${part.label} supplier`)
              continue
            }
            const pr = await suppliersApi.getProductPrice(
              partSupplierId,
              part.catalog_table,
              part.catalog_row_id,
            )
            if (!pr) {
              missing.push(part.label)
              continue
            }
            const vars = await suppliersApi.getResolvedCategoryPricing(partSupplierId, part.catalog_table)
            const calc = await suppliersApi.calculatePrice({
              list_price: pr.list_price_inr,
              supplier_discount_pct: vars.supplier_discount_pct,
              margin_multiplier: vars.margin_multiplier,
              customer_discount_pct: 0,
              quantity: p.quantity,
            })
            const unitMult = assemblyPartUnitMultiplier(part.label, p)
            rows.push({ component: part.label, calc, unitMult })
          }
        }
        const ok = parts.length > 0 && missing.length === 0
        const assemblyUnit = ok
          ? rows.reduce((sum, r) => sum + r.calc.final_unit_price * (r.unitMult ?? 1), 0)
          : 0
        const lineTotal = ok ? rows.reduce((sum, r) => sum + r.calc.line_total, 0) : 0
        out.push({
          productId: p.id,
          label: assemblyLabel(p),
          supplierName: p.supplier_name ?? null,
          ok,
          missing,
          rows,
          assemblyUnit,
          lineTotal,
        })
      }
      if (!cancelled) setProductCalcs(out)
    })()
      .catch(() => {
        if (!cancelled) setProductCalcs([])
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assembledProducts, suppliers.length])

  const pricingTotals = useMemo(() => {
    const parseOverride = (id: string): number | null => {
      const raw = (tempQuoteUnitByProduct[id] ?? '').trim()
      if (!raw) return null
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) return null
      return n
    }

    if (!productCalcs.length) return null
    if (assembledProducts.length === 0) return null

    const parseDiscount = (id: string): number => {
      const raw = (customerDiscountByProduct[id] ?? '').trim()
      if (raw) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) return Math.min(n, 100)
      }
      return defaultClientDiscount ?? 0
    }

    let subtotal = 0
    for (const p of assembledProducts) {
      const ov = parseOverride(p.id)
      const discountFactor = 1 - parseDiscount(p.id) / 100
      if (ov != null) {
        subtotal += ov * discountFactor * p.quantity
        continue
      }
      const pc = productCalcs.find((c) => c.productId === p.id)
      if (!pc?.ok) return null
      subtotal += pc.assemblyUnit * discountFactor * p.quantity
    }
    return computeTaxTotals(
      subtotal,
      pfApplicable,
      pfMode,
      pfAmountDraft,
      freightApplicable,
      freightMode,
      freightDraft,
    )
  }, [
    assembledProducts,
    customerDiscountByProduct,
    defaultClientDiscount,
    pfApplicable,
    pfMode,
    pfAmountDraft,
    freightApplicable,
    freightMode,
    freightDraft,
    productCalcs,
    tempQuoteUnitByProduct,
  ])

  const supplierRequired = suppliers.length > 0
  const pricingReady = useMemo(() => {
    if (assembledProducts.length === 0) return false
    if (!supplierRequired) return true
    return assembledProducts.every((p) => Boolean(p.supplier_id))
  }, [assembledProducts, supplierRequired])

  /** Subtotal = Σ (quoted unit × qty); taxes match quotation rules (GST 18%, P&amp;F 3% on subtotal). */
  const netOrderTotals = useMemo(() => {
    if (assembledProducts.length === 0) return null
    let subtotal = 0
    let hasUnpriced = false
    for (const p of assembledProducts) {
      const u = p.unit_price
      if (!isPositivePrice(u)) {
        hasUnpriced = true
        continue
      }
      subtotal += Number(u) * p.quantity
    }
    return {
      ...computeTaxTotals(
        subtotal,
        pfApplicable,
        pfMode,
        pfAmountDraft,
        freightApplicable,
        freightMode,
        freightDraft,
      ),
      allPriced: !hasUnpriced,
      hasUnpriced,
    }
  }, [
    assembledProducts,
    pfApplicable,
    pfMode,
    pfAmountDraft,
    freightApplicable,
    freightMode,
    freightDraft,
  ])

  const handleProductComplete = useCallback(
    (configId: string) => (product: AssembledProduct) => {
      setAssembledProducts((prev) => {
        const existing = prev.find((p) => p.id === product.id)
        if (existing) {
          return prev.map((p) => (p.id === product.id ? product : p))
        }
        return [...prev, product]
      })
      setActiveConfigIds((ids) => ids.filter((x) => x !== configId))
      setEditingId(null)
    },
    [],
  )

  const removeActiveConfig = (configId: string) => {
    setActiveConfigIds((ids) =>
      ids.length > 1 ? ids.filter((x) => x !== configId) : ids,
    )
  }

  const removeProduct = (id: string) => {
    setAssembledProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const startEdit = (productId: string) => {
    setEditingId(productId)
  }

  const canAddMore =
    assembledProducts.length + activeConfigIds.length < 10 && assembledProducts.length > 0

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (showClientSection) {
      if (clientMode === 'existing') {
        if (!selectedCompany) e.client = 'Please search and select a company'
        else if (!selectedBranchId) e.client = 'Please select a branch'
      } else {
        if ((newClient.company_name || '').trim().length < 2) e.company_name = 'Company name is required'
        if (!(newClient.branch_name || '').trim()) e.branch_name = 'Branch name is required'
        if (!(newClient.city || '').trim()) e.city = 'City is required'
        if (!(newClient.contact_name || '').trim()) e.contact_name = 'Contact name is required'
        const ph = cleanPhone(newClient.phone || '')
        if (ph.length !== 10) e.phone = 'Enter a valid 10-digit phone number'
        if ((newClient.email || '').trim() && !isValidEmail((newClient.email || '').trim())) {
          e.email = 'Enter a valid email'
        }
      }
    }
    if (showProductsSection) {
      if (stage === 'products') {
        if (clientMode === 'existing' && !selectedBranchId) {
          e.client = 'Client could not be loaded — refresh the enquiry page'
        }
        if (clientMode === 'new' && (newClient.company_name || '').trim().length < 2) {
          e.client = 'Client could not be loaded — refresh the enquiry page'
        }
      }
      if (assembledProducts.length === 0) {
        e.products = 'Please complete at least one valve configurator'
      }
      if (supplierRequired) {
        const missingSupplier = assembledProducts.some((p) => !p.supplier_id)
        if (missingSupplier) e.supplier = 'Please select a supplier for each product'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const summaryText = useMemo(() => {
    const clientLabel =
      clientSummaryLabel ||
      (clientMode === 'existing'
        ? selectedCompany && selectedBranch
          ? `${selectedCompany.company_name} — ${selectedBranch.branch_name}`
          : 'Select company & branch'
        : newClient.company_name || 'New client')
    if (stage === 'client') {
      return clientLabel && clientLabel !== 'Select company & branch'
        ? `${clientLabel} — ready to create enquiry`
        : 'Select or add a client above'
    }
    if (!clientLabel || assembledProducts.length === 0) {
      return stage === 'products'
        ? 'Configure at least one product above'
        : 'Fill in client and product details above'
    }
    const est = netOrderTotals?.grand ?? totalEstimate
    const hasTbd = assembledProducts.some(
      (p) => p.has_unknown_prices || !isPositivePrice(p.unit_price),
    )
    const estLabel = hasTbd
      ? `Est. ${formatCurrency(est)} (+ ${PRICE_TBD_LABEL} items)`
      : `Est. ${formatCurrency(est)}`
    return `${clientLabel} — ${assembledProducts.length} product(s) — ${estLabel}`
  }, [
    clientMode,
    clientSummaryLabel,
    newClient.company_name,
    assembledProducts.length,
    selectedCompany,
    selectedBranch,
    stage,
    totalEstimate,
    netOrderTotals?.grand,
  ])

  function buildClientPayload() {
    const base = {
      clientMode,
      selectedClientId: selectedBranchId,
      newClient: {
        ...newClient,
        address: newClient.address_line1 || newClient.address,
      },
      priority: 'Normal' as const,
      notes: (prefillNotesFromEnquiry || '').trim(),
      source: enquirySource,
    }
    if (
      clientMode === 'existing' &&
      selectedBranchId &&
      !selectedBranchId.startsWith('dummy-') &&
      selectedClientEmployeeId
    ) {
      return { ...base, clientEmployeeId: selectedClientEmployeeId }
    }
    const nqName = newClientQuoteEmployeeName.trim()
    if (clientMode === 'new' && nqName) {
      return {
        ...base,
        newClientEmployee: {
          addressCode: newClientQuoteEmployeeAddressCode.trim() || undefined,
          fullName: nqName,
          phone: newClientQuoteEmployeePhone.trim() || undefined,
          email: newClientQuoteEmployeeEmail.trim() || undefined,
          department: newClientQuoteEmployeeDepartment.trim() || undefined,
          designation: newClientQuoteEmployeeDesignation.trim() || undefined,
        },
      }
    }
    const inlineEmpName = inlineNewEmployeeName.trim()
    if (
      clientMode === 'existing' &&
      selectedBranchId &&
      !selectedBranchId.startsWith('dummy-') &&
      inlineEmpName &&
      !selectedClientEmployeeId
    ) {
      return {
        ...base,
        newClientEmployee: {
          addressCode: inlineNewEmployeeAddressCode.trim() || undefined,
          fullName: inlineEmpName,
          phone: inlineNewEmployeePhone.trim() || undefined,
          email: inlineNewEmployeeEmail.trim() || undefined,
          department: inlineNewEmployeeDepartment.trim() || undefined,
          designation: inlineNewEmployeeDesignation.trim() || undefined,
        },
      }
    }
    return base
  }

  async function submit() {
    if (!validate()) return
    if (stage === 'client') {
      onCreateEnquiry?.(buildClientPayload())
      return
    }
    const form: ManualEnquiryForm = {
      ...(targetEnquiryId ? { targetEnquiryId } : {}),
      clientMode,
      selectedClientId: selectedBranchId,
      newClient: {
        ...newClient,
        address: newClient.address_line1 || newClient.address,
      },
      lineItems: assembledProducts.map((p) =>
        assembledToLineItem(
          p,
          null,
          p.customer_discount_pct ?? defaultClientDiscount,
        ),
      ),
      priority: 'Normal',
      notes: (prefillNotesFromEnquiry || '').trim(),
    }
    if (netOrderTotals?.subtotal != null) {
      const { pf, pfRate } = resolvePfAmount(
        netOrderTotals.subtotal,
        pfApplicable,
        pfMode,
        pfAmountDraft,
      )
      const { freight, freightRate } = resolveFreightAmount(
        netOrderTotals.subtotal,
        freightApplicable,
        freightMode,
        freightDraft,
      )
      form.orderTotals = {
        pfApplicable,
        pfMode,
        pfAmount: pf,
        pfRate,
        freightApplicable,
        freightMode,
        freightAmount: freight,
        freightRate,
      }
    }
    if (
      clientMode === 'existing' &&
      selectedBranchId &&
      !selectedBranchId.startsWith('dummy-') &&
      selectedClientEmployeeId
    ) {
      form.clientEmployeeId = selectedClientEmployeeId
    }
    const nqName = newClientQuoteEmployeeName.trim()
    if (clientMode === 'new' && nqName) {
      form.newClientEmployee = {
        addressCode: newClientQuoteEmployeeAddressCode.trim() || undefined,
        fullName: nqName,
        phone: newClientQuoteEmployeePhone.trim() || undefined,
        email: newClientQuoteEmployeeEmail.trim() || undefined,
        department: newClientQuoteEmployeeDepartment.trim() || undefined,
        designation: newClientQuoteEmployeeDesignation.trim() || undefined,
      }
    }
    const inlineEmpName = inlineNewEmployeeName.trim()
    if (
      clientMode === 'existing' &&
      selectedBranchId &&
      !selectedBranchId.startsWith('dummy-') &&
      inlineEmpName &&
      !selectedClientEmployeeId
    ) {
      form.newClientEmployee = {
        addressCode: inlineNewEmployeeAddressCode.trim() || undefined,
        fullName: inlineEmpName,
        phone: inlineNewEmployeePhone.trim() || undefined,
        email: inlineNewEmployeeEmail.trim() || undefined,
        department: inlineNewEmployeeDepartment.trim() || undefined,
        designation: inlineNewEmployeeDesignation.trim() || undefined,
      }
    }
    if (typeof window !== 'undefined' && typeof console !== 'undefined') {
      console.log(
        '[ManualEntryForm] buildEmailText:\n' +
          buildEmailText(
            form,
            assembledProducts,
            selectedCompany,
            selectedBranch,
            productCalcs,
            selectedQuoteEmployee,
          ),
      )
    }
    onSubmitManual(form)
  }

  const submitLabel =
    stage === 'client'
      ? isProcessing
        ? 'Creating…'
        : 'Create Enquiry →'
      : stage === 'products'
        ? isProcessing
          ? 'Generating…'
          : 'Generate Quotation →'
        : isProcessing
          ? 'Processing…'
          : 'Process →'

  return (
    <div className="space-y-5">
      {stage === 'products' && clientSummaryLabel ? (
        <div className="rounded-lg border border-brand-navy-200 bg-brand-navy-50/40 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Client</p>
          <p className="mt-1 text-[14px] font-semibold text-gray-900">{clientSummaryLabel}</p>
        </div>
      ) : null}

      {stage === 'client' ? (
        <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Source</div>
          <p className="mt-1 text-[12px] text-surface-muted">
            How did this enquiry reach you?
          </p>
          <Select
            value={enquirySource}
            onValueChange={(v) => setEnquirySource((v as EnquirySource) || 'manual')}
          >
            <SelectTrigger className="mt-3 h-10 w-full border-surface-border bg-white text-[13px]">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {ENQUIRY_SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      ) : null}

      {/* ── Client Details ─────────────────────────────────────────── */}
      {showClientSection ? (
      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-navy-200">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-gray-900">Client Details</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setClientMode('existing')}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                clientMode === 'existing'
                  ? 'bg-brand-navy-500 text-white'
                  : 'border border-surface-border text-surface-muted hover:text-gray-900',
              )}
            >
              <UserRound className="size-3.5" /> Existing Client
            </button>
            <button
              type="button"
              onClick={() => setClientMode('new')}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                clientMode === 'new'
                  ? 'bg-brand-navy-500 text-white'
                  : 'border border-surface-border text-surface-muted hover:text-gray-900',
              )}
            >
              <UserPlus className="size-3.5" /> New Client
            </button>
          </div>
        </div>

        {clientMode === 'existing' ? (
          <div className="mt-4 space-y-4">
            <div className="relative space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                Search company
              </div>
              <Input
                value={companyQuery}
                onChange={(e) => {
                  setCompanyQuery(e.target.value)
                  setCompanyMenuOpen(true)
                }}
                onFocus={() => setCompanyMenuOpen(true)}
                placeholder="Type to search…"
                className={cn('h-10', errors.client && 'border-red-300')}
              />
              {companyMenuOpen && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-surface-border bg-white py-1 shadow-md">
                  {mergedCompanyOptions.length === 0 ? (
                    <p className="px-3 py-2 text-[13px] text-surface-muted">No matches</p>
                  ) : (
                    mergedCompanyOptions.map((co) => (
                      <button
                        key={co.id}
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-[13px] hover:bg-surface-page"
                        onClick={() => {
                          setSelectedCompany(co)
                          setCompanyQuery(co.company_name)
                          setCompanyMenuOpen(false)
                        }}
                      >
                        <span className="font-medium text-gray-900">{co.company_name}</span>
                        <span className="text-[12px] text-surface-muted">
                          {co.branch_count} branches
                          {co.gst_number ? ` · GST: ${co.gst_number}` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {errors.client && <p className="text-[12px] text-red-600">{errors.client}</p>}
            </div>

            {selectedCompany ? (
              <div className="space-y-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                  Select branch
                </div>
                {(selectedCompany.branches || []).filter((b) => b.is_active).length === 1 ? (
                  <div className="rounded-lg border border-surface-border bg-surface-page p-3 text-[13px] text-surface-muted">
                    {(selectedCompany.branches || []).filter((b) => b.is_active).map((b) => (
                      <span key={b.id}>
                        <span className="font-medium text-gray-900">{b.branch_name}</span>
                        {' — '}
                        {b.city}
                        {b.state ? `, ${b.state}` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(selectedCompany.branches || [])
                      .filter((b) => b.is_active)
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBranchId(b.id)}
                          className={cn(
                            'rounded-lg border p-3 text-left text-[13px] transition-colors',
                            selectedBranchId === b.id
                              ? 'border-2 border-brand-green-500 bg-brand-green-50'
                              : 'border-surface-border hover:bg-surface-page',
                          )}
                        >
                          <div className="flex items-center gap-1 font-semibold text-gray-900">
                            {b.is_headquarters ? '🏢' : '📍'} {b.branch_name}
                          </div>
                          <p className="mt-1 text-surface-muted">
                            {[b.city, b.state].filter(Boolean).join(', ') || '—'}
                          </p>
                          <p className="mt-1 text-surface-muted">{b.contact_name || '—'}</p>
                          <p className="text-surface-muted">{b.phone || '—'}</p>
                        </button>
                      ))}
                  </div>
                )}

                {!selectedCompany.id.startsWith('dc-') && (
                  <div>
                    {!showAddBranch ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-0 text-brand-green-600 hover:text-brand-green-700"
                        onClick={() => setShowAddBranch(true)}
                      >
                        + Add New Branch to This Company
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-dashed border-brand-green-300 bg-surface-page p-4">
                        <p className="mb-2 text-[12px] font-medium text-gray-900">New branch</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Branch name *"
                            value={inlineBranch.branch_name}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, branch_name: e.target.value })}
                          />
                          <Input
                            placeholder="City *"
                            value={inlineBranch.city}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, city: e.target.value })}
                          />
                          <Input
                            placeholder="Contact"
                            value={inlineBranch.contact_name}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, contact_name: e.target.value })}
                          />
                          <Input
                            placeholder="Designation"
                            value={inlineBranch.designation}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, designation: e.target.value })}
                          />
                          <Input
                            placeholder="Phone"
                            value={inlineBranch.phone}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, phone: e.target.value })}
                          />
                          <Input
                            placeholder="Email"
                            value={inlineBranch.email}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, email: e.target.value })}
                          />
                          <Input
                            placeholder="State"
                            value={inlineBranch.state}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, state: e.target.value })}
                            className="sm:col-span-1"
                          />
                          <Input
                            placeholder="Pincode"
                            value={inlineBranch.pincode}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, pincode: e.target.value })}
                          />
                          <Textarea
                            placeholder="Address"
                            className="min-h-[56px] sm:col-span-2"
                            value={inlineBranch.address_line1}
                            onChange={(e) => setInlineBranch({ ...inlineBranch, address_line1: e.target.value })}
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={addBranchSaving}
                            onClick={async () => {
                              if (!inlineBranch.branch_name.trim() || !inlineBranch.city.trim()) return
                              setAddBranchSaving(true)
                              try {
                                await clientsApi.addBranch(selectedCompany.id, {
                                  branch_name: inlineBranch.branch_name.trim(),
                                  contact_name: inlineBranch.contact_name.trim() || null,
                                  designation: inlineBranch.designation.trim() || null,
                                  phone: inlineBranch.phone.trim() || null,
                                  email: inlineBranch.email.trim() || null,
                                  city: inlineBranch.city.trim(),
                                  state: inlineBranch.state.trim() || null,
                                  pincode: inlineBranch.pincode.trim() || null,
                                  address_line1: inlineBranch.address_line1.trim() || null,
                                  country: inlineBranch.country.trim() || 'India',
                                })
                                const refreshed = await clientsApi.getCompany(selectedCompany.id)
                                setSelectedCompany(refreshed)
                                setShowAddBranch(false)
                                setInlineBranch({
                                  branch_name: '',
                                  contact_name: '',
                                  designation: '',
                                  phone: '',
                                  email: '',
                                  city: '',
                                  state: '',
                                  pincode: '',
                                  address_line1: '',
                                  country: 'India',
                                })
                              } finally {
                                setAddBranchSaving(false)
                              }
                            }}
                          >
                            {addBranchSaving ? 'Adding…' : 'Add Branch'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setShowAddBranch(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedCompany && selectedBranch ? (
                  <div className="rounded-lg border border-surface-border bg-white p-4 text-[13px] shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{selectedCompany.company_name}</p>
                        <p className="mt-0.5 text-brand-green-700">{selectedBranch.branch_name}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 text-[12px]"
                        onClick={() => {
                          setSelectedCompany(null)
                          setSelectedBranchId(null)
                          setCompanyQuery('')
                        }}
                      >
                        Change
                      </Button>
                    </div>
                    <p className="mt-2 text-surface-muted">
                      {selectedBranch.contact_name || '—'}
                      {selectedBranch.designation ? ` · ${selectedBranch.designation}` : ''}
                    </p>
                    <p className="mt-1 text-surface-muted">
                      {selectedBranch.phone ? `📞 ${selectedBranch.phone}` : ''}
                      {selectedBranch.email ? ` · ✉ ${selectedBranch.email}` : ''}
                    </p>
                    <p className="mt-1 text-surface-muted">
                      📍{' '}
                      {[selectedBranch.address_line1, [selectedBranch.city, selectedBranch.state].filter(Boolean).join(', '), selectedBranch.pincode]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    {!selectedBranch.id.startsWith('dummy-') && selectedCompany ? (
                      <div className="mt-4 space-y-3 border-t border-surface-border pt-4">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                          Quote for (contact at this branch)
                        </div>
                        <Select
                          value={selectedClientEmployeeId ?? BRANCH_PRIMARY_CONTACT}
                          onValueChange={(v) =>
                            setSelectedClientEmployeeId(v === BRANCH_PRIMARY_CONTACT ? null : v)
                          }
                          disabled={employeesLoading}
                        >
                          <SelectTrigger className="h-10 w-full min-w-0">
                            <SelectValue placeholder={employeesLoading ? 'Loading contacts…' : 'Select contact'}>
                              {quoteContactSelectLabel}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={BRANCH_PRIMARY_CONTACT}>
                              Branch primary contact (above)
                            </SelectItem>
                            {branchEmployees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.full_name}
                                {e.email ? ` · ${e.email}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="rounded-md bg-surface-page p-3">
                          <p className="mb-2 text-[11px] font-medium text-gray-800">Add contact to this branch</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <Input
                              value={inlineNewEmployeeAddressCode}
                              onChange={(e) => setInlineNewEmployeeAddressCode(e.target.value)}
                              placeholder="Address Code"
                              className="h-9 text-[13px]"
                            />
                            <Input
                              value={inlineNewEmployeeName}
                              onChange={(e) => setInlineNewEmployeeName(e.target.value)}
                              placeholder="Person Name *"
                              className="h-9 text-[13px]"
                            />
                            <Input
                              value={inlineNewEmployeePhone}
                              onChange={(e) => setInlineNewEmployeePhone(e.target.value)}
                              placeholder="Contact No."
                              className="h-9 text-[13px]"
                            />
                            <Input
                              value={inlineNewEmployeeEmail}
                              onChange={(e) => setInlineNewEmployeeEmail(e.target.value)}
                              placeholder="Email"
                              type="email"
                              className="h-9 text-[13px]"
                            />
                            <Input
                              value={inlineNewEmployeeDepartment}
                              onChange={(e) => setInlineNewEmployeeDepartment(e.target.value)}
                              placeholder="Department"
                              className="h-9 text-[13px]"
                            />
                            <Input
                              value={inlineNewEmployeeDesignation}
                              onChange={(e) => setInlineNewEmployeeDesignation(e.target.value)}
                              placeholder="Designation"
                              className="h-9 text-[13px]"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-2 h-8 text-[12px]"
                            disabled={
                              addEmployeeSaving ||
                              !inlineNewEmployeeName.trim() ||
                              (inlineNewEmployeeEmail.trim() !== '' &&
                                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inlineNewEmployeeEmail.trim()))
                            }
                            onClick={async () => {
                              const name = inlineNewEmployeeName.trim()
                              if (!name || !selectedCompany || selectedBranch.id.startsWith('dummy-')) return
                              setAddEmployeeSaving(true)
                              setAddEmployeeErr(null)
                              try {
                                const created = await clientsApi.createBranchEmployee(
                                  selectedCompany.id,
                                  selectedBranch.id,
                                  {
                                    address_code: inlineNewEmployeeAddressCode.trim() || undefined,
                                    full_name: name,
                                    phone: inlineNewEmployeePhone.trim() || undefined,
                                    email: inlineNewEmployeeEmail.trim() || undefined,
                                    department: inlineNewEmployeeDepartment.trim() || undefined,
                                    designation: inlineNewEmployeeDesignation.trim() || undefined,
                                  },
                                )
                                const rows = await clientsApi.listBranchEmployees(
                                  selectedCompany.id,
                                  selectedBranch.id,
                                )
                                setBranchEmployees(rows)
                                setSelectedClientEmployeeId(created.id)
                                setInlineNewEmployeeAddressCode('')
                                setInlineNewEmployeeName('')
                                setInlineNewEmployeePhone('')
                                setInlineNewEmployeeEmail('')
                                setInlineNewEmployeeDepartment('')
                                setInlineNewEmployeeDesignation('')
                              } catch (e) {
                                setAddEmployeeErr(
                                  e instanceof Error ? e.message : 'Could not save contact — try again or use Process quote to save.',
                                )
                              } finally {
                                setAddEmployeeSaving(false)
                              }
                            }}
                          >
                            {addEmployeeSaving ? 'Saving…' : 'Save & select for this quote'}
                          </Button>
                          {addEmployeeErr ? (
                            <p className="mt-2 text-[12px] text-red-600">{addEmployeeErr}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-surface-page p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-gray-900">Company Information</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Company Name<span className="text-red-600"> *</span>
                  </div>
                  <Input
                    value={newClient.company_name}
                    onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                    className={cn('mt-1 h-10', errors.company_name && 'border-red-300')}
                    placeholder="e.g. ABC Engineering Pvt. Ltd."
                  />
                  {errors.company_name && <p className="text-[12px] text-red-600">{errors.company_name}</p>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">GST Number</div>
                    <Input
                      value={newClient.gst_number}
                      onChange={(e) => setNewClient({ ...newClient, gst_number: e.target.value })}
                      className="mt-1 h-10 font-mono"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Industry</div>
                    <Select
                      value={newClient.industry || SELECT_EMPTY}
                      onValueChange={(v) =>
                        setNewClient({
                          ...newClient,
                          industry: !v || v === SELECT_EMPTY ? '' : v,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1 h-10">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                        {CLIENT_INDUSTRY_OPTIONS.map((x) => (
                          <SelectItem key={x} value={x}>
                            {x}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-surface-page p-4">
              <h3 className="mb-1 text-[13px] font-semibold text-gray-900">Branch / Location</h3>
              <p className="mb-3 text-[12px] text-surface-muted">You can add more branches later from Masters.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Branch Name<span className="text-red-600"> *</span>
                  </div>
                  <Input
                    value={newClient.branch_name}
                    onChange={(e) => setNewClient({ ...newClient, branch_name: e.target.value })}
                    className={cn('mt-1 h-10', errors.branch_name && 'border-red-300')}
                    placeholder="e.g. Head Office, Pune Branch"
                  />
                  {errors.branch_name && <p className="text-[12px] text-red-600">{errors.branch_name}</p>}
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Contact Name<span className="text-red-600"> *</span>
                  </div>
                  <Input
                    value={newClient.contact_name}
                    onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                    className={cn('mt-1 h-10', errors.contact_name && 'border-red-300')}
                  />
                  {errors.contact_name && <p className="text-[12px] text-red-600">{errors.contact_name}</p>}
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Designation</div>
                  <Input
                    value={newClient.designation}
                    onChange={(e) => setNewClient({ ...newClient, designation: e.target.value })}
                    className="mt-1 h-10"
                    placeholder="e.g. Purchase Manager"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Phone<span className="text-red-600"> *</span>
                  </div>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className={cn('mt-1 h-10', errors.phone && 'border-red-300')}
                  />
                  {errors.phone && <p className="text-[12px] text-red-600">{errors.phone}</p>}
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Email</div>
                  <Input
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className={cn('mt-1 h-10', errors.email && 'border-red-300')}
                  />
                  {errors.email && <p className="text-[12px] text-red-600">{errors.email}</p>}
                </div>
                <div className="sm:col-span-2 rounded-lg border border-dashed border-surface-border bg-white/60 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                    Quote for — different contact (optional)
                  </div>
                  <p className="mb-2 mt-1 text-[11px] text-surface-muted">
                    Saves as a branch contact person and uses them on this quotation. Leave blank to use the branch
                    contact above.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Input
                      value={newClientQuoteEmployeeAddressCode}
                      onChange={(e) => setNewClientQuoteEmployeeAddressCode(e.target.value)}
                      className="h-9 text-[13px]"
                      placeholder="Address Code"
                    />
                    <Input
                      value={newClientQuoteEmployeeName}
                      onChange={(e) => setNewClientQuoteEmployeeName(e.target.value)}
                      className="h-9 text-[13px]"
                      placeholder="Person Name"
                    />
                    <Input
                      value={newClientQuoteEmployeePhone}
                      onChange={(e) => setNewClientQuoteEmployeePhone(e.target.value)}
                      className="h-9 text-[13px]"
                      placeholder="Contact No."
                    />
                    <Input
                      value={newClientQuoteEmployeeEmail}
                      onChange={(e) => setNewClientQuoteEmployeeEmail(e.target.value)}
                      className="h-9 text-[13px]"
                      placeholder="Email"
                      type="email"
                    />
                    <Input
                      value={newClientQuoteEmployeeDepartment}
                      onChange={(e) => setNewClientQuoteEmployeeDepartment(e.target.value)}
                      className="h-9 text-[13px]"
                      placeholder="Department"
                    />
                    <Input
                      value={newClientQuoteEmployeeDesignation}
                      onChange={(e) => setNewClientQuoteEmployeeDesignation(e.target.value)}
                      className="h-9 text-[13px]"
                      placeholder="Designation"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                    City<span className="text-red-600"> *</span>
                  </div>
                  <Input
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    className={cn('mt-1 h-10', errors.city && 'border-red-300')}
                  />
                  {errors.city && <p className="text-[12px] text-red-600">{errors.city}</p>}
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">State</div>
                  <Input
                    value={newClient.state}
                    onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Pincode</div>
                  <Input
                    value={newClient.pincode}
                    onChange={(e) => setNewClient({ ...newClient, pincode: e.target.value })}
                    className="mt-1 h-10"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Address</div>
                  <Textarea
                    value={newClient.address_line1}
                    onChange={(e) =>
                      setNewClient({ ...newClient, address_line1: e.target.value, address: e.target.value })
                    }
                    className="mt-1 min-h-[70px]"
                    placeholder="Street address, landmark"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {/* ── Products (valve configurator) ───────────────────────────── */}
      {showProductsSection ? (
      <>
      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-gold-200">
        <h2 className="text-[15px] font-semibold text-gray-900">Products Requested</h2>

        <div className="mt-4 space-y-4">
          {assembledProducts.map((p, idx) =>
            editingId === p.id ? (
              <ValveConfigurator
                key={p.id}
                productIndex={idx}
                initialProduct={p}
                suppliers={suppliers}
                onProductComplete={(updated) => {
                  setAssembledProducts((prev) =>
                    prev.map((x) => (x.id === p.id ? updated : x)),
                  )
                  setEditingId(null)
                }}
                onProductRemove={() => {
                  removeProduct(p.id)
                  setEditingId(null)
                }}
              />
            ) : (
              <CompletedProductCard
                key={p.id}
                product={p}
                index={idx}
                onEdit={() => startEdit(p.id)}
                onRemove={() => removeProduct(p.id)}
              />
            ),
          )}

          {activeConfigIds.map((cid, idx) => {
            let initialSpecSeed:
              | { catalog_category: string; field_values: Record<string, string>; quantity?: number }
              | undefined
            if (matcherSeed?.catalogKey) {
              const lines = matcherSeed.lines
              if (lines && lines.length > 0) {
                const L = lines[idx] ?? { filledCascade: {} as Record<string, string> }
                const q = L.quantity
                initialSpecSeed = {
                  catalog_category: matcherSeed.catalogKey,
                  field_values: L.filledCascade ?? {},
                  ...(typeof q === 'number' && q > 0 ? { quantity: Math.floor(q) } : {}),
                }
              } else if (idx === 0) {
                initialSpecSeed = {
                  catalog_category: matcherSeed.catalogKey,
                  field_values: matcherSeed.filledCascade ?? {},
                }
              }
            }
            return (
              <ValveConfigurator
                key={`${cid}-${matcherSeedVersion}`}
                productIndex={assembledProducts.length + idx}
                suppliers={suppliers}
                initialSpecSeed={initialSpecSeed}
                onProductComplete={handleProductComplete(cid)}
                onProductRemove={
                  assembledProducts.length > 0 || activeConfigIds.length > 1
                    ? () => removeActiveConfig(cid)
                    : undefined
                }
              />
            )
          })}

          {errors.products && <p className="text-[12px] text-red-600">{errors.products}</p>}
          {errors.supplier && <p className="text-[12px] text-red-600">{errors.supplier}</p>}
          {errors.pricing && <p className="text-[12px] text-red-600">{errors.pricing}</p>}

          {canAddMore && activeConfigIds.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveConfigIds((ids) => [...ids, uuidv4()])}
              className="h-10 w-full border-dashed text-brand-green-700"
            >
              <Plus className="mr-2 size-4" />
              Add Another Product
            </Button>
          )}
        </div>
      </section>

      {/* ── Net total & taxes ─────────────────────────────────────── */}
      {assembledProducts.length > 0 && (
        <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-navy-200">
          <h2 className="text-[15px] font-semibold text-gray-900">Net total &amp; taxes</h2>
          <p className="mt-1 text-[13px] text-surface-muted">
            Subtotal uses each product&apos;s quoted unit price (after any customer discount from Step 5). GST is
            18% on subtotal. P&amp;F and freight can each be entered as a flat amount (₹) or as a percentage of
            subtotal; leave blank to use the default 3% for P&amp;F when enabled.
          </p>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="rounded-lg border border-surface-border bg-surface-page p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Line totals</p>
              <ul className="mt-2 space-y-2">
                {assembledProducts.map((p) => {
                  const u = p.unit_price
                  const ok = isPositivePrice(u)
                  const line = ok ? Number(u) * p.quantity : null
                  return (
                    <li key={p.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="min-w-0 font-medium text-gray-900">{assemblyLabel(p)}</span>
                      <span className="shrink-0 font-mono text-[12px] sm:text-[13px]">
                        {ok ? (
                          <>
                            {p.quantity} {p.unit || 'Nos'} × {formatCurrency(Number(u))} ={' '}
                            {formatCurrency(line!)}
                          </>
                        ) : (
                          <span className="text-brand-gold-700">{PRICE_TBD_LABEL}</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="rounded-lg border border-surface-border bg-[#FAFAF8] p-4">
              <div className="grid grid-cols-[1fr_8.5rem] items-center gap-x-3 gap-y-0.5 text-[13px]">
                <span className="text-surface-muted">Subtotal (excl. taxes)</span>
                <span className={NET_TOTAL_AMOUNT_COL}>
                  {netOrderTotals?.subtotal != null ? formatCurrency(netOrderTotals.subtotal) : '—'}
                </span>
                <span className="text-surface-muted">GST @ 18%</span>
                <span className={NET_TOTAL_AMOUNT_COL}>
                  {netOrderTotals?.gst != null ? formatCurrency(netOrderTotals.gst) : '—'}
                </span>
                <NetChargeRow
                  label="P&amp;F"
                  checkboxAriaLabel="Apply P and F charges"
                  checked={pfApplicable}
                  onCheckedChange={setPfApplicable}
                  controlsDisabled={!pfApplicable || netOrderTotals?.subtotal == null}
                  mode={pfMode}
                  onModePercent={() => setPfMode('percent')}
                  onModeAmount={() => setPfMode('amount')}
                  draft={pfAmountDraft}
                  onDraftChange={setPfAmountDraft}
                  percentPlaceholder={String(DEFAULT_PF_PERCENT)}
                  amountPlaceholder={
                    netOrderTotals?.defaultPf != null
                      ? netOrderTotals.defaultPf.toFixed(2)
                      : '0.00'
                  }
                  percentAriaLabel="P and F as percent of subtotal"
                  amountAriaLabel="P and F amount in INR"
                  appliedAmount={netOrderTotals?.pf}
                />
                <NetChargeRow
                  label="Freight"
                  checkboxAriaLabel="Apply freight"
                  checked={freightApplicable}
                  onCheckedChange={setFreightApplicable}
                  controlsDisabled={!freightApplicable || netOrderTotals?.subtotal == null}
                  mode={freightMode}
                  onModePercent={() => setFreightMode('percent')}
                  onModeAmount={() => setFreightMode('amount')}
                  draft={freightDraft}
                  onDraftChange={setFreightDraft}
                  percentPlaceholder="e.g. 2"
                  amountPlaceholder="0.00"
                  percentAriaLabel="Freight as percent of subtotal"
                  amountAriaLabel="Freight amount in INR"
                  appliedAmount={netOrderTotals?.freight}
                />
              </div>
              <div className="mt-3 grid grid-cols-[1fr_8.5rem] items-center gap-x-3 border-t border-surface-border pt-3 text-[13px] font-semibold text-gray-900">
                <span>Net total (incl. taxes)</span>
                <span className={cn(NET_TOTAL_AMOUNT_COL, 'text-brand-green-700')}>
                  {netOrderTotals?.grand != null ? formatCurrency(netOrderTotals.grand) : '—'}
                </span>
              </div>
            </div>
            {netOrderTotals?.hasUnpriced && (
              <p className="text-[12px] text-brand-gold-700">
                Items marked {PRICE_TBD_LABEL} are excluded from subtotal and net total until a list price is available.
              </p>
            )}
          </div>
        </section>
      )}

      {false && assembledProducts.length > 0 && (
        <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-navy-200">
          <h2 className="text-[15px] font-semibold text-gray-900">Pricing &amp; supplier</h2>
          <p className="mt-1 text-[13px] text-surface-muted">
            Totals use margin / supplier discount from supplier pricing. Customer discount is set per quote line.
          </p>
          {suppliers.length === 0 ? (
            <p className="mt-3 text-[13px] text-surface-muted">
              No active suppliers configured — quotes use assembly estimates only. Add suppliers under Masters.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {pricingLoading ? (
                <p className="text-[13px] text-surface-muted">Loading supplier prices…</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-surface-border">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Supplier price</th>
                        <th className="px-3 py-2">Cost to Parth</th>
                        <th className="px-3 py-2">Selling (unit)</th>
                        <th className="px-3 py-2">Quote unit (temp)</th>
                        <th className="px-3 py-2">Customer discount (%)</th>
                        <th className="px-3 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembledProducts.map((p) => {
                        const pc = productCalcs.find((c) => c.productId === p.id)
                        const overrideRaw = (tempQuoteUnitByProduct[p.id] ?? '').trim()
                        const overrideNum =
                          overrideRaw && Number.isFinite(Number(overrideRaw)) && Number(overrideRaw) > 0
                            ? Number(overrideRaw)
                            : null
                        if (!pc) {
                          return (
                            <tr key={p.id} className="border-b border-[#E2E6DC]">
                              <td className="px-3 py-2">{assemblyLabel(p)}</td>
                              <td colSpan={6} className="px-3 py-2 text-surface-muted">
                                —
                              </td>
                            </tr>
                          )
                        }
                        if (!pc.ok) {
                          return (
                            <tr key={p.id} className="border-b border-[#E2E6DC]">
                              <td className="px-3 py-2">{pc.label}</td>
                              <td colSpan={3} className="px-3 py-2 text-amber-800">
                                Price not configured for this supplier — {pc.missing.join(', ')}
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  value={tempQuoteUnitByProduct[p.id] ?? ''}
                                  onChange={(e) =>
                                    setTempQuoteUnitByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                  }
                                  className="h-8 w-32 font-mono"
                                  placeholder="e.g. 12500"
                                />
                                <p className="mt-1 text-[10px] text-surface-muted">
                                  Temporary quote price (doesn&apos;t change Masters)
                                </p>
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  value={customerDiscountByProduct[p.id] ?? ''}
                                  onChange={(e) =>
                                    setCustomerDiscountByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                  }
                                  className="h-8 w-32 font-mono"
                                  placeholder={defaultClientDiscount != null ? String(defaultClientDiscount) : '0'}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-surface-muted">
                                {overrideNum != null
                                  ? formatCurrency(
                                      overrideNum *
                                        p.quantity *
                                        (1 -
                                          ((Number(customerDiscountByProduct[p.id]) || defaultClientDiscount || 0) /
                                            100)),
                                    )
                                  : '—'}
                              </td>
                            </tr>
                          )
                        }
                        const listSum = pc.rows.reduce((s, r) => s + r.calc.list_price, 0)
                        const costSum = pc.rows.reduce((s, r) => s + r.calc.cost_to_parth, 0)
                        const discountPct = Math.min(
                          100,
                          Math.max(0, Number(customerDiscountByProduct[p.id] ?? '') || defaultClientDiscount || 0),
                        )
                        const effectiveUnit = (overrideNum ?? pc.assemblyUnit) * (1 - discountPct / 100)
                        const effectiveLine = effectiveUnit * p.quantity
                        return (
                          <tr key={p.id} className="border-b border-[#E2E6DC]">
                            <td className="px-3 py-2 font-medium text-gray-900">{pc.label}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(listSum)}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(costSum)}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(pc.assemblyUnit)}</td>
                            <td className="px-3 py-2">
                              <Input
                                value={tempQuoteUnitByProduct[p.id] ?? ''}
                                onChange={(e) =>
                                  setTempQuoteUnitByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                }
                                className="h-8 w-32 font-mono"
                                placeholder="(optional)"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={customerDiscountByProduct[p.id] ?? ''}
                                onChange={(e) =>
                                  setCustomerDiscountByProduct((cur) => ({ ...cur, [p.id]: e.target.value }))
                                }
                                className="h-8 w-32 font-mono"
                                placeholder={defaultClientDiscount != null ? String(defaultClientDiscount) : '0'}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {formatCurrency(effectiveLine)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {errors.pricing && <p className="text-[12px] text-red-600">{errors.pricing}</p>}

              {pricingTotals && (
                <div className="rounded-lg border border-surface-border bg-surface-page p-4 text-[13px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.subtotal ?? 0)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-surface-muted">
                    <span>GST @ 18%</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.gst ?? 0)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-surface-muted">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pfApplicable}
                        onChange={(e) => setPfApplicable(e.target.checked)}
                        aria-label="Apply P and F charges"
                        className="size-3.5 shrink-0 rounded border-[#B8BFB4] text-brand-green-600 focus:ring-brand-green-500/30"
                      />
                      <span>P&amp;F @ 3%</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!pfApplicable}
                      value={pfAmountDraft}
                      onChange={(e) => setPfAmountDraft(e.target.value)}
                      placeholder={
                        pricingTotals?.defaultPf != null
                          ? pricingTotals?.defaultPf.toFixed(2)
                          : '0.00'
                      }
                      className="h-8 w-32 shrink-0 font-mono text-right"
                      aria-label="P and F amount in INR"
                    />
                  </div>
                  <div className="mt-2 flex justify-between border-t border-surface-border pt-2 font-semibold text-gray-900">
                    <span>Grand total</span>
                    <span className="font-mono">{formatCurrency(pricingTotals?.grand ?? 0)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      </>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-surface-muted">{summaryText}</p>
        <Button
          type="button"
          onClick={submit}
          disabled={
            isProcessing ||
            (showProductsSection && supplierRequired && !pricingReady) ||
            (stage === 'client' && !onCreateEnquiry)
          }
          className="h-12 bg-brand-green-500 text-white hover:bg-brand-green-600"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
