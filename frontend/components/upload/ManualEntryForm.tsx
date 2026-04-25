'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, UserPlus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { prefetchValveCatalogs } from '@/hooks/useValveCatalog'
import { clientsApi, suppliersApi } from '@/lib/api'
import { ValveConfigurator, CompletedProductCard } from '@/components/configurator/ValveConfigurator'
import type {
  AssembledProduct,
  BranchResponse,
  CompanyResponse,
  ManualEnquiryForm,
  ManualLineItem,
  OperatorKey,
  PriceCalculationResult,
  SupplierResponse,
} from '@/types'
import { CLIENT_INDUSTRY_OPTIONS } from '@/types'

type Props = {
  onSubmitManual: (form: ManualEnquiryForm) => void
  isProcessing: boolean
}

const SELECT_EMPTY = '__none__'
const toSelectValue = (v: string | null | undefined) =>
  v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY
const fromSelectValue = (v: string | null | undefined) => (!v || v === SELECT_EMPTY ? '' : v)

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16)
}

function isValidEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').slice(-10)
}

function operatorLabel(k: OperatorKey | null): string {
  switch (k) {
    case 'bare_shaft':
      return 'Bare Shaft'
    case 'manual':
      return 'Manual'
    case 'gear_box':
      return 'Gear Box'
    case 'da':
      return 'Double Acting (DA)'
    case 'sa':
      return 'Single Acting (SA)'
    case 'electric_actuator':
      return 'Electric Actuator'
    default:
      return '—'
  }
}

type CatalogPart = { label: string; catalog_table: string; catalog_row_id: string }

function valveTypeToCatalogTable(valveType: string | null | undefined): 'butterfly_valve' | 'ball_valve' | null {
  const t = (valveType || '').toLowerCase()
  if (t.includes('butterfly')) return 'butterfly_valve'
  if (t.includes('ball')) return 'ball_valve'
  return null
}

function catalogPartsForAssembly(p: AssembledProduct): CatalogPart[] {
  const parts: CatalogPart[] = []
  const v = p.valve
  if (v?.id) {
    const ct = valveTypeToCatalogTable(v.type)
    if (ct) parts.push({ label: 'Valve', catalog_table: ct, catalog_row_id: v.id })
  }
  if ((p.operator_key === 'da' || p.operator_key === 'sa') && p.operator_model?.id) {
    parts.push({ label: 'Operator', catalog_table: 'operator', catalog_row_id: p.operator_model.id })
  }
  if (p.sov?.id) parts.push({ label: 'SOV', catalog_table: 'sov', catalog_row_id: p.sov.id })
  if (p.limit_switch_box?.id) {
    parts.push({
      label: 'Limit switch',
      catalog_table: 'limit_switch_box',
      catalog_row_id: p.limit_switch_box.id,
    })
  }
  if (p.positioner?.id) {
    parts.push({ label: 'Positioner', catalog_table: 'positioner', catalog_row_id: p.positioner.id })
  }
  if (p.include_bracket && p.bracket?.id) {
    parts.push({
      label: 'Bracket / coupler',
      catalog_table: 'brackets_coupler',
      catalog_row_id: p.bracket.id,
    })
  }
  return parts
}

function assemblyLabel(p: AssembledProduct): string {
  const v = p.valve
  if (!v) return 'Assembly'
  return [v.type, v.construction, v.valve_size].filter(Boolean).join(' — ')
}

type ProductPricingCalc = {
  productId: string
  label: string
  supplierName: string | null
  ok: boolean
  missing: string[]
  rows: Array<{ component: string; calc: PriceCalculationResult }>
  assemblyUnit: number
  lineTotal: number
}

/** Parse leading inch size like `2"` or `1 1/2"` from valve_size text. */
function parseSizeInch(valveSize: string | null | undefined): number | null {
  if (!valveSize) return null
  const m = valveSize.trim().match(/^(\d+)\s+(\d+)\/(\d+)\s*"?$/)
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3])
  const m2 = valveSize.trim().match(/^(\d+)\/(\d+)\s*"?$/)
  if (m2) return Number(m2[1]) / Number(m2[2])
  const m3 = valveSize.trim().match(/^(\d+(?:\.\d+)?)\s*"?$/)
  if (m3) return Number(m3[1])
  return null
}
function parseSizeMm(valveSize: string | null | undefined): number | null {
  if (!valveSize) return null
  const mDn = valveSize.match(/DN\s*(\d+)/i)
  if (mDn) return Number(mDn[1])
  const mMm = valveSize.match(/(\d+)\s*MM/i)
  if (mMm) return Number(mMm[1])
  return null
}

/** Adapt an AssembledProduct into the existing ManualLineItem request shape. */
function assembledToLineItem(p: AssembledProduct, unitPriceOverride: number | null): ManualLineItem {
  const v = p.valve
  const materialParts = v
    ? [v.body, v.ball_disc ?? v.ball, v.stem, v.seat, v.fasteners].filter(Boolean)
    : []
  const material = materialParts.join(' / ') || ''
  const name = v
    ? [
        v.type,
        v.construction,
        v.valve_size,
      ]
        .filter(Boolean)
        .join(' — ')
    : 'Valve Assembly'

  const sel = {
    id: v?.id ?? uuidv4(),
    name,
    size_inch: parseSizeInch(v?.valve_size ?? null),
    size_mm: parseSizeMm(v?.valve_size ?? null),
    material,
    base_price:
      unitPriceOverride != null && Number.isFinite(unitPriceOverride) ? unitPriceOverride : (p.unit_price ?? 0),
    unit: 'Nos',
    display_label: name,
  }

  const cascade: Record<string, string> = {}
  if (v) {
    if (v.construction) cascade.construction = v.construction
    if (v.valve_size) cascade.valve_size = v.valve_size
    if (v.bore_type) cascade.bore_type = v.bore_type
    if (v.end_connection) cascade.end_connection = v.end_connection
    if (v.pressure) cascade.pressure = v.pressure
    if (v.body) cascade.body = v.body
    if (v.ball_disc) cascade.ball_disc = v.ball_disc
    if (v.ball) cascade.ball = v.ball
    if (v.stem) cascade.stem = v.stem
    if (v.seat) cascade.seat = v.seat
    if (v.fasteners) cascade.fasteners = v.fasteners
  }
  cascade.operator = operatorLabel(p.operator_key)
  if (p.operator_model) {
    cascade.operator_model = p.operator_model.model_name
    if (p.operator_model.size) cascade.operator_size = p.operator_model.size
  }
  if (p.sov) cascade.sov = p.sov.type
  if (p.limit_switch_box) cascade.limit_switch_box = p.limit_switch_box.type
  if (p.positioner) cascade.positioner = p.positioner.type
  if (p.include_bracket && p.bracket) cascade.bracket_coupler = `Included (${p.bracket.size})`
  if (p.supplier_name) cascade.supplier = p.supplier_name
  if (p.supplier_id) cascade.supplier_id = p.supplier_id

  return {
    id: p.id,
    category: v?.type ?? 'Valve',
    cascadeSelections: cascade,
    selectedProduct: sel,
    quantity: p.quantity,
  }
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
    if (p.include_bracket && p.bracket) lines.push(`Bracket & Coupler: included (${p.bracket.size})`)
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

export default function ManualEntryForm({ onSubmitManual, isProcessing }: Props) {
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
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal')
  const [notes, setNotes] = useState('')

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

  const [errors, setErrors] = useState<Record<string, string>>({})

  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [productCalcs, setProductCalcs] = useState<ProductPricingCalc[]>([])
  const [pricingLoading, setPricingLoading] = useState(false)

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

  useEffect(() => {
    void prefetchValveCatalogs()
  }, [])

  const selectedBranch = useMemo((): BranchResponse | null => {
    if (!selectedCompany || !selectedBranchId) return null
    return (selectedCompany.branches || []).find((b) => b.id === selectedBranchId) ?? null
  }, [selectedCompany, selectedBranchId])

  const totalEstimate = useMemo(() => {
    if (productCalcs.length && productCalcs.every((c) => c.ok)) {
      return productCalcs.reduce((s, c) => s + c.lineTotal, 0)
    }
    return assembledProducts.reduce((sum, p) => {
      if (p.unit_price == null) return sum
      return sum + p.unit_price * p.quantity
    }, 0)
  }, [assembledProducts, productCalcs])

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
        const parts = catalogPartsForAssembly(p)
        const missing: string[] = []
        if (parts.length === 0) missing.push('Valve configuration')
        if (suppliers.length > 0 && !supplierId) missing.push('Supplier selection')
        const rows: Array<{ component: string; calc: PriceCalculationResult }> = []
        if (supplierId) {
          for (const part of parts) {
            const pr = await suppliersApi.getProductPrice(
              supplierId,
              part.catalog_table,
              part.catalog_row_id,
            )
            if (!pr) {
              missing.push(part.label)
              continue
            }
            const vars = await suppliersApi.getResolvedCategoryPricing(supplierId, part.catalog_table)
            const calc = await suppliersApi.calculatePrice({
              list_price: pr.list_price_inr,
              supplier_discount_pct: vars.supplier_discount_pct,
              margin_multiplier: vars.margin_multiplier,
              customer_discount_pct: vars.customer_discount_pct,
              quantity: p.quantity,
            })
            rows.push({ component: part.label, calc })
          }
        }
        const ok = parts.length > 0 && missing.length === 0
        const assemblyUnit = ok
          ? rows.reduce((sum, r) => sum + r.calc.final_unit_price, 0)
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
    if (!productCalcs.length || !productCalcs.every((c) => c.ok)) return null
    const subtotal = productCalcs.reduce((s, c) => s + c.lineTotal, 0)
    const gst = subtotal * 0.18
    const pf = subtotal * 0.03
    const grand = subtotal + gst + pf
    return { subtotal, gst, pf, grand }
  }, [productCalcs])

  const supplierRequired = suppliers.length > 0
  const pricingReady =
    !supplierRequired ||
    (productCalcs.length === assembledProducts.length && productCalcs.every((c) => c.ok))

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
    if (assembledProducts.length === 0) {
      e.products = 'Please complete at least one valve configurator'
    }
    if (supplierRequired) {
      const missingSupplier = assembledProducts.some((p) => !p.supplier_id)
      if (missingSupplier) e.supplier = 'Please select a supplier for each product'
      else if (!pricingReady) e.pricing = 'Supplier list prices are missing for one or more components'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const summaryText = useMemo(() => {
    const clientLabel =
      clientMode === 'existing'
        ? selectedCompany && selectedBranch
          ? `${selectedCompany.company_name} — ${selectedBranch.branch_name}`
          : 'Select company & branch'
        : newClient.company_name || 'New client'
    if (!clientLabel || assembledProducts.length === 0) {
      return 'Fill in client and product details above'
    }
    return `${clientLabel} — ${assembledProducts.length} product(s) — Est. ${formatCurrency(totalEstimate)}`
  }, [
    clientMode,
    newClient.company_name,
    assembledProducts.length,
    selectedCompany,
    selectedBranch,
    totalEstimate,
  ])

  async function submit() {
    if (!validate()) return
    const unitByProduct = new Map(
      productCalcs.filter((c) => c.ok).map((c) => [c.productId, c.assemblyUnit]),
    )
    const form: ManualEnquiryForm = {
      clientMode,
      selectedClientId: selectedBranchId,
      newClient: {
        ...newClient,
        address: newClient.address_line1 || newClient.address,
      },
      lineItems: assembledProducts.map((p) => assembledToLineItem(p, unitByProduct.get(p.id) ?? null)),
      priority,
      notes,
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
          ),
      )
    }
    onSubmitManual(form)
  }

  return (
    <div className="space-y-5">
      {/* ── Client Details ─────────────────────────────────────────── */}
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

      {/* ── Products (valve configurator) ───────────────────────────── */}
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

          {activeConfigIds.map((cid, idx) => (
            <ValveConfigurator
              key={cid}
              productIndex={assembledProducts.length + idx}
              suppliers={suppliers}
              onProductComplete={handleProductComplete(cid)}
              onProductRemove={
                assembledProducts.length > 0 || activeConfigIds.length > 1
                  ? () => removeActiveConfig(cid)
                  : undefined
              }
            />
          ))}

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

      {/* ── Additional Options ──────────────────────────────────────── */}
      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-gray-900">Additional Options</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Priority</div>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as 'Normal' | 'High' | 'Urgent')}
            >
              <SelectTrigger className="h-10 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['Normal', 'High', 'Urgent'] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Notes</div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[90px]"
              placeholder="Any special requirements, delivery location, deadline..."
            />
          </div>
        </div>
      </section>

      {assembledProducts.length > 0 && (
        <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-navy-200">
          <h2 className="text-[15px] font-semibold text-gray-900">Pricing &amp; supplier</h2>
          <p className="mt-1 text-[13px] text-surface-muted">
            Totals use margin / discount / customer discount per supplier per category.
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
                        <th className="px-3 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembledProducts.map((p) => {
                        const pc = productCalcs.find((c) => c.productId === p.id)
                        if (!pc) {
                          return (
                            <tr key={p.id} className="border-b border-[#E2E6DC]">
                              <td className="px-3 py-2">{assemblyLabel(p)}</td>
                              <td colSpan={4} className="px-3 py-2 text-surface-muted">
                                —
                              </td>
                            </tr>
                          )
                        }
                        if (!pc.ok) {
                          return (
                            <tr key={p.id} className="border-b border-[#E2E6DC]">
                              <td className="px-3 py-2">{pc.label}</td>
                              <td colSpan={4} className="px-3 py-2 text-amber-800">
                                Price not configured for this supplier — {pc.missing.join(', ')} — contact admin.
                              </td>
                            </tr>
                          )
                        }
                        const listSum = pc.rows.reduce((s, r) => s + r.calc.list_price, 0)
                        const costSum = pc.rows.reduce((s, r) => s + r.calc.cost_to_parth, 0)
                        return (
                          <tr key={p.id} className="border-b border-[#E2E6DC]">
                            <td className="px-3 py-2 font-medium text-gray-900">{pc.label}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(listSum)}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(costSum)}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(pc.assemblyUnit)}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(pc.lineTotal)}</td>
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
                    <span className="font-mono">{formatCurrency(pricingTotals.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-surface-muted">
                    <span>GST @ 18%</span>
                    <span className="font-mono">{formatCurrency(pricingTotals.gst)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-surface-muted">
                    <span>P&amp;F @ 3%</span>
                    <span className="font-mono">{formatCurrency(pricingTotals.pf)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-surface-border pt-2 font-semibold text-gray-900">
                    <span>Grand total</span>
                    <span className="font-mono">{formatCurrency(pricingTotals.grand)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-surface-muted">{summaryText}</p>
        <Button
          type="button"
          onClick={submit}
          disabled={isProcessing || (supplierRequired && !pricingReady)}
          className="h-12 bg-brand-green-500 text-white hover:bg-brand-green-600"
        >
          {isProcessing ? 'Processing…' : 'Process →'}
        </Button>
      </div>
    </div>
  )
}
