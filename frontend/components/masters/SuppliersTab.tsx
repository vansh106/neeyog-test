'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { suppliersApi } from '@/lib/api'
import {
  expandSupplierCategoryKeys,
  masterCatalogCategoryLabel,
  masterNavSupplierCategorySections,
} from '@/lib/masterSidebarNav'
import { cn } from '@/lib/utils'
import type { SupplierResponse } from '@/types'

function formatSupplierCategories(s: SupplierResponse): string {
  const keys = s.category_keys ?? []
  if (keys.length === 0) return 'All product categories'
  return keys.map((k) => masterCatalogCategoryLabel(k)).join(', ')
}

export default function SuppliersTab() {
  const [rows, setRows] = useState<SupplierResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierResponse | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [allCategories, setAllCategories] = useState(true)
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<Set<string>>(() => new Set())
  const [marginMultiplier, setMarginMultiplier] = useState<number | null>(null)
  const [supplierDiscount, setSupplierDiscount] = useState<number | null>(null)
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const categorySections = useMemo(() => masterNavSupplierCategorySections(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await suppliersApi.getSuppliers(false)
      setRows(data)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function resetCategorySelection(keys: string[]) {
    if (keys.length === 0) {
      setAllCategories(true)
      setSelectedCategoryKeys(new Set())
    } else {
      setAllCategories(false)
      setSelectedCategoryKeys(new Set(expandSupplierCategoryKeys(keys)))
    }
  }

  function openCreate() {
    setEditing(null)
    setName('')
    resetCategorySelection([])
    setMarginMultiplier(null)
    setSupplierDiscount(null)
    setContactPerson('')
    setPhone('')
    setEmail('')
    setAddress('')
    setNotes('')
    setSheetOpen(true)
  }

  function openEdit(s: SupplierResponse) {
    setEditing(s)
    setName(s.name)
    resetCategorySelection(s.category_keys ?? [])
    setMarginMultiplier(null)
    setSupplierDiscount(null)
    setContactPerson(s.contact_person ?? '')
    setPhone(s.phone ?? '')
    setEmail(s.email ?? '')
    setAddress('')
    setNotes('')
    setSheetOpen(true)
  }

  function toggleCategory(key: string) {
    setAllCategories(false)
    setSelectedCategoryKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSection(keys: string[], checked: boolean) {
    setAllCategories(false)
    setSelectedCategoryKeys((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (checked) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }

  function enableAllCategories() {
    setAllCategories(true)
    setSelectedCategoryKeys(new Set())
  }

  async function submitSheet() {
    if (!name.trim()) return
    const category_keys = allCategories ? [] : [...selectedCategoryKeys]
    if (!allCategories && category_keys.length === 0) {
      setErr('Select at least one product category, or choose All categories.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      if (editing) {
        await suppliersApi.updateSupplier(editing.id, {
          name: name.trim(),
          category_keys,
          contact_person: contactPerson || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          notes: notes || null,
        })
      } else {
        await suppliersApi.createSupplier({
          name: name.trim(),
          category_keys,
          margin_multiplier: marginMultiplier,
          supplier_discount_pct: supplierDiscount,
          contact_person: contactPerson || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          notes: notes || null,
        })
      }
      setSheetOpen(false)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function setPreferred(id: string) {
    try {
      await suppliersApi.setPreferred(id)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function deactivate(id: string) {
    try {
      await suppliersApi.deactivate(id)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-surface-muted">
          Vendors and negotiated list discounts. Catalog products are not duplicated here.
        </p>
        <Button type="button" onClick={openCreate} className="bg-brand-navy-500 text-white">
          + Add supplier
        </Button>
      </div>
      {err && <p className="text-[13px] text-red-600">{err}</p>}
      {loading ? (
        <p className="text-[14px] text-surface-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[14px] text-surface-muted">No suppliers yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-surface-border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-gray-900">{s.name}</p>
                  <p className="mt-1 text-[13px] text-surface-muted">
                    {[s.contact_person, s.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="mt-2 text-[13px] text-gray-800">
                    Categories:{' '}
                    <span className="font-medium">{formatSupplierCategories(s)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {s.is_preferred && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      <Star className="size-3 fill-amber-400 text-amber-500" />
                      Preferred
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      s.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.is_active && !s.is_preferred && (
                  <Button type="button" variant="outline" size="sm" onClick={() => void setPreferred(s.id)}>
                    Set as preferred
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(s)}>
                  Edit
                </Button>
                {s.is_active && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deactivate(s.id)}>
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit supplier' : 'Add supplier'}</SheetTitle>
            <SheetDescription>
              Select one or more product categories from the masters sheets. Leave all selected to cover every
              category.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <div className="grid gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                  Supplier name *
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC Valves Pvt Ltd" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                  Contact person
                </label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Phone</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Address</label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} className="min-h-[72px]" />
              </div>

              <div className="space-y-2 rounded-lg border border-surface-border bg-surface-page p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-gray-900">Product categories</p>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gray-800">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 rounded border-gray-300"
                      checked={allCategories}
                      onChange={(e) => {
                        if (e.target.checked) enableAllCategories()
                        else setAllCategories(false)
                      }}
                    />
                    All categories
                  </label>
                </div>
                <p className="text-[11px] text-surface-muted">
                  Grouped by masters sidebar headings (Valves, Hoses, Hose Fittings, Accessories).
                </p>
                <div
                  className={cn(
                    'max-h-[280px] space-y-4 overflow-y-auto rounded-md border border-surface-border bg-white p-2',
                    allCategories && 'pointer-events-none opacity-50',
                  )}
                >
                  {categorySections.map((section) => {
                    const sectionKeys = section.items.map((i) => i.key)
                    const allInSection =
                      sectionKeys.length > 0 && sectionKeys.every((k) => selectedCategoryKeys.has(k))
                    const someInSection =
                      !allInSection && sectionKeys.some((k) => selectedCategoryKeys.has(k))
                    return (
                      <div key={section.heading}>
                        <div className="mb-1.5 flex items-center gap-2 border-b border-surface-border pb-1">
                          <input
                            type="checkbox"
                            className="size-4 shrink-0 rounded border-gray-300"
                            checked={allInSection}
                            ref={(el) => {
                              if (el) el.indeterminate = someInSection
                            }}
                            onChange={(e) => toggleSection(sectionKeys, e.target.checked)}
                          />
                          <span className="text-[12px] font-semibold text-gray-900">{section.heading}</span>
                        </div>
                        <ul className="ml-6 space-y-1">
                          {section.items.map((item) => (
                            <li key={item.key}>
                              <label className="flex cursor-pointer items-start gap-2 text-[12px] text-gray-800">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 size-4 shrink-0 rounded border-gray-300"
                                  checked={selectedCategoryKeys.has(item.key)}
                                  onChange={() => toggleCategory(item.key)}
                                />
                                <span>{item.label}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>

              {!editing && (
                <div className="rounded-lg border border-surface-border bg-surface-page p-3">
                  <p className="text-[12px] font-semibold text-gray-900">Initial pricing vars (optional)</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        Margin (x)
                      </label>
                      <Input
                        inputMode="decimal"
                        placeholder="1.4"
                        value={marginMultiplier == null ? '' : String(marginMultiplier)}
                        onChange={(e) => setMarginMultiplier(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                        Discount (%)
                      </label>
                      <Input
                        inputMode="decimal"
                        placeholder="10"
                        value={supplierDiscount == null ? '' : String(supplierDiscount)}
                        onChange={(e) => setSupplierDiscount(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px]" />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !name.trim()} onClick={() => void submitSheet()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create supplier'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
