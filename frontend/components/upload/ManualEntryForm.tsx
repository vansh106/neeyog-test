'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16)
}
import { Plus, UserPlus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { mastersApi } from '@/lib/api'
import type {
  CascadeStepMeta,
  ClientDropdownOption,
  ManualEnquiryForm,
  ManualLineItem,
  ProductCategoryOption,
  ProductSizeOption,
} from '@/types'

type Props = {
  onSubmit: (emailText: string, inputType: string) => void
  isProcessing: boolean
}

/** Base UI Select must stay controlled: never switch `value` between undefined and string. */
const SELECT_EMPTY = '__none__'

function toSelectValue(v: string | null | undefined): string {
  return v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY
}

function fromSelectValue(v: string | null | undefined): string {
  return !v || v === SELECT_EMPTY ? '' : v
}

function createEmptyLineItem(): ManualLineItem {
  return {
    id: uuidv4(),
    category: '',
    cascadeSelections: {},
    selectedProduct: null,
    quantity: 1,
  }
}

function capLabel(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeProductCategories(raw: unknown): ProductCategoryOption[] {
  if (!Array.isArray(raw)) return []
  const out: ProductCategoryOption[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ key: item, label: capLabel(item) })
      continue
    }
    if (item && typeof item === 'object' && 'key' in item) {
      const o = item as { key: unknown; label?: unknown; count?: unknown }
      if (typeof o.key !== 'string' || !o.key.trim()) continue
      const label = typeof o.label === 'string' && o.label.trim() ? o.label : capLabel(o.key)
      const count = typeof o.count === 'number' ? o.count : undefined
      out.push({ key: o.key, label, count })
    }
  }
  return out
}

function isValidEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').slice(-10)
}

function buildEmailText(form: ManualEnquiryForm, clients: ClientDropdownOption[]): string {
  const client =
    form.clientMode === 'existing'
      ? clients.find((c) => c.id === form.selectedClientId) || null
      : null

  const company_name = form.clientMode === 'existing' ? (client?.company_name || '') : form.newClient.company_name
  const contact_name = form.clientMode === 'existing' ? (client?.contact_name || '') : form.newClient.contact_name
  const phone = form.clientMode === 'existing' ? (client?.phone || '') : form.newClient.phone
  const email = form.clientMode === 'existing' ? (client?.email || '') : form.newClient.email
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

  form.lineItems.forEach((li, idx) => {
    const n = idx + 1
    if (li.selectedProduct) {
      const p = li.selectedProduct
      const sizePart =
        p.size_inch != null || p.size_mm != null
          ? `${p.size_inch != null ? `${p.size_inch}\"` : ''}${p.size_mm != null ? ` (${p.size_mm}mm)` : ''}`.trim()
          : 'Size: TBD'
      lines.push(`${n}. ${p.name} — ${sizePart}`)
      if (p.material) lines.push(`   Material: ${p.material}`)
      lines.push(`   Quantity: ${li.quantity} ${p.unit}`)
    } else if (li.category) {
      lines.push(`${n}. ${capLabel(li.category)} — Size: TBD`)
      lines.push(`   Quantity: ${li.quantity}`)
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

function priorCascadeFilters(schema: CascadeStepMeta[], fieldKey: string, sel: Record<string, string>) {
  const ix = schema.findIndex((s) => s.key === fieldKey)
  const out: Record<string, string> = {}
  if (ix <= 0) return out
  for (let i = 0; i < ix; i++) {
    const k = schema[i].key
    if (sel[k]) out[k] = sel[k]
  }
  return out
}

type CascadeRowProps = {
  li: ManualLineItem
  idx: number
  categories: ProductCategoryOption[]
  categoriesError: string | null
  schema: CascadeStepMeta[] | undefined
  onSchemaNeeded: (categoryKey: string) => void
  updateLineItem: (id: string, patch: Partial<ManualLineItem>) => void
  errors: Record<string, string>
}

function ManualLineCascadeFields({
  li,
  idx,
  categories,
  categoriesError,
  schema,
  onSchemaNeeded,
  updateLineItem,
  errors,
}: CascadeRowProps) {
  const [stepOptions, setStepOptions] = useState<Record<string, string[]>>({})
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [ambiguous, setAmbiguous] = useState<ProductSizeOption[]>([])

  useEffect(() => {
    if (li.category) onSchemaNeeded(li.category)
  }, [li.category, onSchemaNeeded])

  useEffect(() => {
    if (!li.category || !schema?.length) {
      setStepOptions({})
      setAmbiguous([])
      return
    }
    let cancelled = false
    setOptionsLoading(true)
    ;(async () => {
      const next: Record<string, string[]> = {}
      let nextSelections: Record<string, string> = { ...(li.cascadeSelections || {}) }
      try {
        for (const step of schema) {
          const prior = priorCascadeFilters(schema, step.key, nextSelections)
          const res = await mastersApi.postCascadeValues<{ values: string[] }>({
            category: li.category,
            field: step.key,
            filters: prior,
          })
          if (cancelled) return
          const values = (res.values ?? []).filter((v) => v && v !== SELECT_EMPTY)
          next[step.key] = values

          const current = nextSelections[step.key] || ''
          const isSelectedValid = current ? values.includes(current) : true
          if (!isSelectedValid) {
            delete nextSelections[step.key]
            // Clear all downstream fields if current selection became invalid
            const ix = schema.findIndex((s) => s.key === step.key)
            if (ix >= 0) {
              for (let j = ix + 1; j < schema.length; j++) delete nextSelections[schema[j].key]
            }
          }

          // If a step has exactly one possible value, auto-select it.
          if (!nextSelections[step.key] && values.length === 1) {
            nextSelections[step.key] = values[0]
          }
        }
        if (!cancelled) setStepOptions(next)
        // Apply auto-selections / invalidation to the line item
        const changed =
          Object.keys(nextSelections).length !== Object.keys(li.cascadeSelections || {}).length ||
          Object.entries(nextSelections).some(([k, v]) => (li.cascadeSelections || {})[k] !== v)
        if (!cancelled && changed) {
          updateLineItem(li.id, { cascadeSelections: nextSelections, selectedProduct: null })
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [li.category, schema, li.cascadeSelections])

  const matchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!li.category || !schema?.length) {
      setAmbiguous([])
      return
    }
    if (matchTimer.current) clearTimeout(matchTimer.current)
    matchTimer.current = setTimeout(() => {
      mastersApi
        .postCascadeMatch<{ count: number; products: ProductSizeOption[] }>({
          category: li.category,
          filters: li.cascadeSelections,
        })
        .then((res) => {
          if (res.count === 1 && res.products[0]) {
            setAmbiguous([])
            const p = res.products[0]
            if (li.selectedProduct?.id !== p.id) {
              updateLineItem(li.id, { selectedProduct: p })
            }
          } else if (res.count > 1) {
            setAmbiguous(res.products)
            updateLineItem(li.id, { selectedProduct: null })
          } else {
            setAmbiguous([])
            updateLineItem(li.id, { selectedProduct: null })
          }
        })
        .catch(() => {
          setAmbiguous([])
          updateLineItem(li.id, { selectedProduct: null })
        })
    }, 280)
    return () => {
      if (matchTimer.current) clearTimeout(matchTimer.current)
    }
  }, [li.category, li.cascadeSelections, li.id, li.selectedProduct?.id, schema, updateLineItem])

  const patchCascadeField = (fieldKey: string, displayValue: string) => {
    if (!schema?.length) return
    const ix = schema.findIndex((s) => s.key === fieldKey)
    const next = { ...li.cascadeSelections }
    if (!displayValue) delete next[fieldKey]
    else next[fieldKey] = displayValue
    if (ix >= 0) {
      for (let j = ix + 1; j < schema.length; j++) delete next[schema[j].key]
    }
    updateLineItem(li.id, { cascadeSelections: next, selectedProduct: null })
  }

  const lineTotal = li.selectedProduct ? li.selectedProduct.base_price * (li.quantity || 0) : 0

  return (
    <div className="mt-4 space-y-3">
      <div className="min-w-0 space-y-1.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Category</div>
        {categoriesError && <p className="text-[12px] text-amber-800">{categoriesError}</p>}
        <Select
          value={toSelectValue(li.category)}
          onValueChange={(raw) => {
            const cat = fromSelectValue(raw ?? '')
            updateLineItem(li.id, {
              category: cat,
              cascadeSelections: {},
              selectedProduct: null,
              quantity: 1,
            })
            if (cat) onSchemaNeeded(cat)
          }}
        >
          <SelectTrigger className="h-10 w-full min-w-0">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_EMPTY}>
              <span className="text-muted-foreground">Select category</span>
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {li.category && schema === undefined && (
        <p className="text-[12px] text-surface-muted">Loading product fields…</p>
      )}
      {li.category && Array.isArray(schema) && schema.length === 0 && (
        <p className="text-[12px] text-amber-800">Could not load field list for this category.</p>
      )}

      {li.category &&
        schema?.map((step) => {
          const stepIndex = schema.findIndex((s) => s.key === step.key)
          // Only require previous steps that genuinely have multiple choices.
          const priorStepsOk =
            stepIndex === 0 ||
            schema.slice(0, stepIndex).every((s) => {
              const opts = stepOptions[s.key] ?? []
              if (opts.length <= 1) return true
              return !!li.cascadeSelections[s.key]
            })
          const opts = stepOptions[step.key] ?? []
          if (priorStepsOk && !optionsLoading && opts.length === 0 && stepIndex > 0) {
            return null
          }

          return (
            <div key={step.key} className="min-w-0 space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">{step.label}</div>
              <Select
                value={toSelectValue(li.cascadeSelections[step.key])}
                onValueChange={(raw) => patchCascadeField(step.key, fromSelectValue(raw ?? ''))}
                disabled={!priorStepsOk || optionsLoading}
              >
                <SelectTrigger className="h-10 w-full min-w-0">
                  <SelectValue
                    placeholder={
                      !priorStepsOk ? 'Complete fields above' : optionsLoading ? 'Loading…' : `Select ${step.label}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_EMPTY}>
                    <span className="text-muted-foreground">Select…</span>
                  </SelectItem>
                  {opts.map((opt) => (
                    <SelectItem key={`${step.key}:${opt}`} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}

      {ambiguous.length > 1 && (
        <div className="min-w-0 space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Exact match</div>
          <p className="text-[12px] text-surface-muted">
            Multiple catalog lines match. Pick the priced line you want.
          </p>
          <Select
            value={toSelectValue(li.selectedProduct?.id)}
            onValueChange={(raw) => {
              const id = fromSelectValue(raw ?? '')
              const found = ambiguous.find((p) => p.id === id) || null
              updateLineItem(li.id, { selectedProduct: found })
            }}
          >
            <SelectTrigger className="h-10 w-full min-w-0">
              <SelectValue placeholder="Choose line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_EMPTY}>
                <span className="text-muted-foreground">Choose line</span>
              </SelectItem>
              {ambiguous.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="min-w-0 space-y-1.5 sm:col-span-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Quantity</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              max={9999}
              value={li.quantity}
              onChange={(e) => updateLineItem(li.id, { quantity: Math.max(0, Number(e.target.value || 0)) })}
              className={cn('h-10 w-full min-w-[5.5rem] max-w-[8.5rem] shrink-0', errors[`li_${idx}_qty`] && 'border-red-300')}
            />
            {li.selectedProduct && <span className="text-[13px] text-surface-muted">× {li.selectedProduct.unit}</span>}
          </div>
          {li.selectedProduct && (
            <p className="text-[12px] font-mono text-brand-green-700">
              ≈ {formatCurrency(lineTotal)} (before GST)
            </p>
          )}
          {errors[`li_${idx}_qty`] && <p className="text-[12px] text-red-600">{errors[`li_${idx}_qty`]}</p>}
        </div>
      </div>

      {errors[`li_${idx}_product`] && <p className="text-[12px] text-amber-700">{errors[`li_${idx}_product`]}</p>}
    </div>
  )
}

export default function ManualEntryForm({ onSubmit, isProcessing }: Props) {
  const [form, setForm] = useState<ManualEnquiryForm>({
    clientMode: 'existing',
    selectedClientId: null,
    newClient: { company_name: '', contact_name: '', phone: '', email: '', address: '' },
    lineItems: [createEmptyLineItem()],
    priority: 'Normal',
    notes: '',
  })

  const [clients, setClients] = useState<ClientDropdownOption[]>([])
  const [categories, setCategories] = useState<ProductCategoryOption[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [cascadeSchemas, setCascadeSchemas] = useState<Record<string, CascadeStepMeta[]>>({})

  const [errors, setErrors] = useState<Record<string, string>>({})

  const ensureCascadeSchema = useCallback(async (cat: string) => {
    if (!cat) return
    const sch = await mastersApi.getCascadeSchema<CascadeStepMeta[]>(cat).catch(() => [])
    setCascadeSchemas((p) => (p[cat]?.length ? p : { ...p, [cat]: sch }))
  }, [])

  useEffect(() => {
    mastersApi.getClientsForDropdown<ClientDropdownOption[]>().then(setClients).catch(() => setClients([]))
    mastersApi
      .getCategories<unknown>()
      .then((raw) => {
        const next = normalizeProductCategories(raw)
        setCategories(next)
        setCategoriesError(next.length ? null : 'No product categories returned from the server.')
      })
      .catch((err: unknown) => {
        setCategories([])
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Could not load product categories.'
        setCategoriesError(
          `${msg} Restart the API after updating, or leave NEXT_PUBLIC_API_URL empty so calls use this app’s /api proxy (no trailing slash in the URL).`,
        )
      })
  }, [])

  const selectedClient = useMemo(() => {
    if (!form.selectedClientId) return null
    return clients.find((c) => c.id === form.selectedClientId) || null
  }, [clients, form.selectedClientId])

  const totalEstimate = useMemo(() => {
    return form.lineItems.reduce((sum, li) => {
      if (!li.selectedProduct) return sum
      const price = li.selectedProduct.base_price || 0
      return sum + price * (li.quantity || 0)
    }, 0)
  }, [form.lineItems])

  const updateLineItem = useCallback((id: string, patch: Partial<ManualLineItem>) => {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)),
    }))
  }, [])

  function addLineItem() {
    if (form.lineItems.length >= 10) return
    setForm((p) => ({ ...p, lineItems: [...p.lineItems, createEmptyLineItem()] }))
  }

  function removeLineItem(id: string) {
    if (form.lineItems.length <= 1) return
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((x) => x.id !== id) }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}

    if (form.clientMode === 'existing') {
      if (!form.selectedClientId) e.client = 'Please select a client'
    } else {
      if ((form.newClient.company_name || '').trim().length < 2) e.company_name = 'Company name is required'
      if (!(form.newClient.contact_name || '').trim()) e.contact_name = 'Contact name is required'
      const ph = cleanPhone(form.newClient.phone || '')
      if (ph.length !== 10) e.phone = 'Enter a valid 10-digit phone number'
      if (!isValidEmail((form.newClient.email || '').trim())) e.email = 'Enter a valid email'
    }

    const validLines = form.lineItems.filter((li) => li.category && li.selectedProduct && (li.quantity || 0) >= 1)
    if (validLines.length === 0) e.products = 'Please add at least one fully specified product line'

    // row-level hints
    form.lineItems.forEach((li, idx) => {
      if (li.category && !li.selectedProduct) e[`li_${idx}_product`] = 'Complete product selections (all fields) or pick an exact match'
      if (li.selectedProduct && (!li.quantity || li.quantity < 1)) e[`li_${idx}_qty`] = 'Enter quantity'
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const summaryText = useMemo(() => {
    const clientLabel =
      form.clientMode === 'existing'
        ? selectedClient?.company_name || 'Select client'
        : form.newClient.company_name || 'New client'
    const productCount = form.lineItems.filter((li) => li.selectedProduct && li.quantity >= 1).length
    if (!clientLabel || productCount === 0) return 'Fill in client and product details above'
    return `${clientLabel} — ${productCount} product(s) — Est. ${formatCurrency(totalEstimate)}`
  }, [form.clientMode, form.newClient.company_name, form.lineItems, selectedClient, totalEstimate])

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-navy-200">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-gray-900">Client Details</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, clientMode: 'existing' }))}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                form.clientMode === 'existing'
                  ? 'bg-brand-navy-500 text-white'
                  : 'border border-surface-border text-surface-muted hover:text-gray-900',
              )}
            >
              <UserRound className="size-3.5" />
              Existing Client
            </button>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, clientMode: 'new' }))}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                form.clientMode === 'new'
                  ? 'bg-brand-navy-500 text-white'
                  : 'border border-surface-border text-surface-muted hover:text-gray-900',
              )}
            >
              <UserPlus className="size-3.5" />
              New Client
            </button>
          </div>
        </div>

        {form.clientMode === 'existing' ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Client</div>
              <Select
                value={toSelectValue(form.selectedClientId ?? '')}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, selectedClientId: fromSelectValue(v) || null }))
                }
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
                value={form.newClient.company_name}
                onChange={(e) => setForm((p) => ({ ...p, newClient: { ...p.newClient, company_name: e.target.value } }))}
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
                value={form.newClient.contact_name}
                onChange={(e) => setForm((p) => ({ ...p, newClient: { ...p.newClient, contact_name: e.target.value } }))}
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
                value={form.newClient.phone}
                onChange={(e) => setForm((p) => ({ ...p, newClient: { ...p.newClient, phone: e.target.value } }))}
                className={cn('h-10', errors.phone && 'border-red-300')}
                placeholder="9823456789"
              />
              {errors.phone && <p className="text-[12px] text-red-600">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Email Address</div>
              <Input
                value={form.newClient.email}
                onChange={(e) => setForm((p) => ({ ...p, newClient: { ...p.newClient, email: e.target.value } }))}
                className={cn('h-10', errors.email && 'border-red-300')}
                placeholder="suresh@abc.com"
              />
              {errors.email && <p className="text-[12px] text-red-600">{errors.email}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Address</div>
              <Textarea
                value={form.newClient.address}
                onChange={(e) => setForm((p) => ({ ...p, newClient: { ...p.newClient, address: e.target.value } }))}
                className="min-h-[70px]"
                placeholder="City, State — for shipping"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-gold-200">
        <h2 className="text-[15px] font-semibold text-gray-900">Products Requested</h2>

        <div className="mt-4 space-y-3">
          {form.lineItems.map((li, idx) => {
            const lineTotal = li.selectedProduct ? li.selectedProduct.base_price * (li.quantity || 0) : 0

            return (
              <div key={li.id} className="rounded-xl border border-surface-border bg-surface-page p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-green-100 text-brand-green-700 font-mono text-[12px]">
                      {idx + 1}
                    </span>
                    {li.category && li.selectedProduct && li.quantity >= 1 && (
                      <span className="rounded-full bg-brand-green-50 px-3 py-1 text-[12px] font-medium text-brand-green-700">
                        ✓ {li.quantity} × {li.selectedProduct.name} — {formatCurrency(lineTotal)}
                      </span>
                    )}
                  </div>
                  {form.lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(li.id)}
                      className="text-[12px] text-surface-muted hover:text-gray-900"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <ManualLineCascadeFields
                  li={li}
                  idx={idx}
                  categories={categories}
                  categoriesError={categoriesError}
                  schema={li.category ? cascadeSchemas[li.category] : undefined}
                  onSchemaNeeded={ensureCascadeSchema}
                  updateLineItem={updateLineItem}
                  errors={errors}
                />
              </div>
            )
          })}

          {errors.products && <p className="text-[12px] text-red-600">{errors.products}</p>}

          <Button
            type="button"
            variant="outline"
            onClick={addLineItem}
            disabled={form.lineItems.length >= 10}
            className="h-10 w-full border-dashed text-brand-green-700"
          >
            <Plus className="mr-2 size-4" />
            Add Another Product
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-gray-900">Additional Options</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Priority</div>
            <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v as ManualEnquiryForm['priority'] }))}>
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
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
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
          onClick={() => {
            if (!validate()) return
            const emailText = buildEmailText(form, clients)
            onSubmit(emailText, 'email') // backend will detect tag and convert to manual
          }}
          disabled={isProcessing}
          className="h-12 bg-brand-green-500 text-white hover:bg-brand-green-600"
        >
          {isProcessing ? 'AI is thinking…' : 'Process with AI →'}
        </Button>
      </div>
    </div>
  )
}

