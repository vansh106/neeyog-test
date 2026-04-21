'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, UserPlus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { mastersApi } from '@/lib/api'
import { ValveConfigurator, CompletedProductCard } from '@/components/configurator/ValveConfigurator'
import type {
  AssembledProduct,
  ClientDropdownOption,
  ManualEnquiryForm,
  ManualLineItem,
  OperatorKey,
} from '@/types'

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
function assembledToLineItem(p: AssembledProduct): ManualLineItem {
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
    base_price: p.unit_price ?? 0,
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

  return {
    id: p.id,
    category: v?.type ?? 'Valve',
    cascadeSelections: cascade,
    selectedProduct: sel,
    quantity: p.quantity,
  }
}

/** Build plain-text email for parser ingestion. */
function buildEmailText(
  form: ManualEnquiryForm,
  products: AssembledProduct[],
  clients: ClientDropdownOption[],
): string {
  const client =
    form.clientMode === 'existing'
      ? clients.find((c) => c.id === form.selectedClientId) || null
      : null

  const company_name =
    form.clientMode === 'existing' ? client?.company_name || '' : form.newClient.company_name
  const contact_name =
    form.clientMode === 'existing' ? client?.contact_name || '' : form.newClient.contact_name
  const phone = form.clientMode === 'existing' ? client?.phone || '' : form.newClient.phone
  const email = form.clientMode === 'existing' ? client?.email || '' : form.newClient.email
  const address = form.clientMode === 'existing' ? '' : form.newClient.address

  const subject = `Manual Enquiry — ${company_name || 'Client'}`

  const lines: string[] = []
  lines.push(`From: ${contact_name || 'Buyer'} <${email || 'unknown@example.com'}>`)
  if (company_name) lines.push(`Company: ${company_name}`)
  if (phone) lines.push(`Phone: ${phone}`)
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [newClient, setNewClient] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal')
  const [notes, setNotes] = useState('')

  const [clients, setClients] = useState<ClientDropdownOption[]>([])
  const [assembledProducts, setAssembledProducts] = useState<AssembledProduct[]>([])
  const [activeConfigIds, setActiveConfigIds] = useState<string[]>([uuidv4()])
  const [editingId, setEditingId] = useState<string | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    mastersApi
      .getClientsForDropdown<ClientDropdownOption[]>()
      .then(setClients)
      .catch(() => setClients([]))
  }, [])

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find((c) => c.id === selectedClientId) || null
  }, [clients, selectedClientId])

  const totalEstimate = useMemo(() => {
    return assembledProducts.reduce((sum, p) => {
      if (p.unit_price == null) return sum
      return sum + p.unit_price * p.quantity
    }, 0)
  }, [assembledProducts])

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
      if (!selectedClientId) e.client = 'Please select a client'
    } else {
      if ((newClient.company_name || '').trim().length < 2) e.company_name = 'Company name is required'
      if (!(newClient.contact_name || '').trim()) e.contact_name = 'Contact name is required'
      const ph = cleanPhone(newClient.phone || '')
      if (ph.length !== 10) e.phone = 'Enter a valid 10-digit phone number'
      if (!isValidEmail((newClient.email || '').trim())) e.email = 'Enter a valid email'
    }
    if (assembledProducts.length === 0) {
      e.products = 'Please complete at least one valve configurator'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const summaryText = useMemo(() => {
    const clientLabel =
      clientMode === 'existing'
        ? selectedClient?.company_name || 'Select client'
        : newClient.company_name || 'New client'
    if (!clientLabel || assembledProducts.length === 0) {
      return 'Fill in client and product details above'
    }
    return `${clientLabel} — ${assembledProducts.length} product(s) — Est. ${formatCurrency(totalEstimate)}`
  }, [clientMode, newClient.company_name, assembledProducts.length, selectedClient, totalEstimate])

  function submit() {
    if (!validate()) return
    const form: ManualEnquiryForm = {
      clientMode,
      selectedClientId,
      newClient,
      lineItems: assembledProducts.map(assembledToLineItem),
      priority,
      notes,
    }
    if (typeof window !== 'undefined' && typeof console !== 'undefined') {
      console.log(
        '[ManualEntryForm] buildEmailText:\n' + buildEmailText(form, assembledProducts, clients),
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
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Client</div>
              <Select
                value={toSelectValue(selectedClientId ?? '')}
                onValueChange={(v) => setSelectedClientId(fromSelectValue(v) || null)}
              >
                <SelectTrigger className={cn('h-10 w-full min-w-0', errors.client && 'border-red-300')}>
                  <SelectValue placeholder="Search clients..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_EMPTY}>
                    <span className="text-muted-foreground">Select client…</span>
                  </SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client && <p className="text-[12px] text-red-600">{errors.client}</p>}
            </div>

            {selectedClient && (
              <div className="rounded-lg border border-surface-border bg-surface-page p-3 text-[13px]">
                <p className="font-semibold text-gray-900">{selectedClient.company_name}</p>
                <p className="mt-1 text-surface-muted">
                  {selectedClient.contact_name || '—'} | {selectedClient.phone || '—'}
                </p>
                <p className="text-surface-muted">
                  {selectedClient.email || '—'} | {selectedClient.city || '—'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                Company Name<span className="text-red-600"> *</span>
              </div>
              <Input
                value={newClient.company_name}
                onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                className={cn('h-10', errors.company_name && 'border-red-300')}
                placeholder="e.g. ABC Engineering Pvt. Ltd."
              />
              {errors.company_name && <p className="text-[12px] text-red-600">{errors.company_name}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                Contact Name<span className="text-red-600"> *</span>
              </div>
              <Input
                value={newClient.contact_name}
                onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                className={cn('h-10', errors.contact_name && 'border-red-300')}
                placeholder="e.g. Suresh Mehta"
              />
              {errors.contact_name && <p className="text-[12px] text-red-600">{errors.contact_name}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                Phone Number<span className="text-red-600"> *</span>
              </div>
              <Input
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                className={cn('h-10', errors.phone && 'border-red-300')}
                placeholder="9823456789"
              />
              {errors.phone && <p className="text-[12px] text-red-600">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Email Address</div>
              <Input
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                className={cn('h-10', errors.email && 'border-red-300')}
                placeholder="suresh@abc.com"
              />
              {errors.email && <p className="text-[12px] text-red-600">{errors.email}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Address</div>
              <Textarea
                value={newClient.address}
                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                className="min-h-[70px]"
                placeholder="City, State — for shipping"
              />
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
              onProductComplete={handleProductComplete(cid)}
              onProductRemove={
                assembledProducts.length > 0 || activeConfigIds.length > 1
                  ? () => removeActiveConfig(cid)
                  : undefined
              }
            />
          ))}

          {errors.products && <p className="text-[12px] text-red-600">{errors.products}</p>}

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-surface-muted">{summaryText}</p>
        <Button
          type="button"
          onClick={submit}
          disabled={isProcessing}
          className="h-12 bg-brand-green-500 text-white hover:bg-brand-green-600"
        >
          {isProcessing ? 'Processing…' : 'Process →'}
        </Button>
      </div>
    </div>
  )
}
