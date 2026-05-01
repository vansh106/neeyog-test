'use client'

import { useCallback, useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { suppliersApi } from '@/lib/api'
import { SIDEBAR_MASTER_CATEGORIES } from '@/lib/masterCatalogCategories'
import type { SupplierResponse } from '@/types'

export default function SuppliersTab() {
  const [rows, setRows] = useState<SupplierResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierResponse | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [primaryCategory, setPrimaryCategory] = useState('all')
  const [marginMultiplier, setMarginMultiplier] = useState<number | null>(null)
  const [supplierDiscount, setSupplierDiscount] = useState<number | null>(null)
  const [customerDiscount, setCustomerDiscount] = useState<number | null>(null)
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

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

  function openCreate() {
    setEditing(null)
    setName('')
    setPrimaryCategory('all')
    setMarginMultiplier(null)
    setSupplierDiscount(null)
    setCustomerDiscount(null)
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
    setPrimaryCategory(s.primary_category_key || 'all')
    setMarginMultiplier(null)
    setSupplierDiscount(null)
    setCustomerDiscount(null)
    setContactPerson(s.contact_person ?? '')
    setPhone(s.phone ?? '')
    setEmail(s.email ?? '')
    setAddress('')
    setNotes('')
    setSheetOpen(true)
  }

  async function submitSheet() {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await suppliersApi.updateSupplier(editing.id, {
          name: name.trim(),
          primary_category_key: primaryCategory,
          contact_person: contactPerson || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          notes: notes || null,
        })
      } else {
        await suppliersApi.createSupplier({
          name: name.trim(),
          primary_category_key: primaryCategory,
          margin_multiplier: marginMultiplier,
          supplier_discount_pct: supplierDiscount,
          customer_discount_pct: customerDiscount,
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
                    Category: <span className="font-medium">{s.primary_category_key || 'all'}</span>
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
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit supplier' : 'Add supplier'}</SheetTitle>
            <SheetDescription>
              Supplier pricing variables are set per category (margin / discount / customer discount).
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-2">
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
            <div className="space-y-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                Category (default)
              </label>
              <Select value={primaryCategory} onValueChange={(v) => setPrimaryCategory(v || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SIDEBAR_MASTER_CATEGORIES.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div className="rounded-lg border border-surface-border bg-surface-page p-3">
                <p className="text-[12px] font-semibold text-gray-900">Initial pricing vars (optional)</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Margin (x)</label>
                    <Input
                      inputMode="decimal"
                      placeholder="1.4"
                      value={marginMultiplier == null ? '' : String(marginMultiplier)}
                      onChange={(e) => setMarginMultiplier(e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Discount (%)</label>
                    <Input
                      inputMode="decimal"
                      placeholder="10"
                      value={supplierDiscount == null ? '' : String(supplierDiscount)}
                      onChange={(e) => setSupplierDiscount(e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                      Customer discount (%)
                    </label>
                    <Input
                      inputMode="decimal"
                      placeholder="2"
                      value={customerDiscount == null ? '' : String(customerDiscount)}
                      onChange={(e) => setCustomerDiscount(e.target.value ? Number(e.target.value) : null)}
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
