'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ChevronDown, ChevronRight, MapPin, Phone, Star, Mail } from 'lucide-react'

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
import { cn } from '@/lib/utils'
import { clientsApi } from '@/lib/api'
import {
  CLIENT_INDUSTRY_OPTIONS,
  type BranchResponse,
  type CompanyResponse,
  type CreateCompanyRequestPayload,
} from '@/types'

function emptyBranchForm() {
  return {
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
  }
}

export default function ClientsTab() {
  const [companies, setCompanies] = useState<CompanyResponse[]>([])
  const [leftSearch, setLeftSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CompanyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)

  const [companySheet, setCompanySheet] = useState<'add' | 'edit' | null>(null)
  const [branchSheet, setBranchSheet] = useState<'add' | 'edit' | null>(null)
  const [editingBranch, setEditingBranch] = useState<BranchResponse | null>(null)
  const [saving, setSaving] = useState(false)

  const [coName, setCoName] = useState('')
  const [coGst, setCoGst] = useState('')
  const [coIndustry, setCoIndustry] = useState('')
  const [coNotes, setCoNotes] = useState('')

  const [bf, setBf] = useState(emptyBranchForm)

  const loadList = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const rows = await clientsApi.searchCompanies(undefined, 400)
      setCompanies(rows)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const d = await clientsApi.getCompany(id)
      setDetail(d)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const filtered = useMemo(() => {
    const s = leftSearch.trim().toLowerCase()
    if (!s) return companies
    return companies.filter(
      (c) =>
        c.company_name.toLowerCase().includes(s) ||
        (c.industry || '').toLowerCase().includes(s) ||
        (c.gst_number || '').toLowerCase().includes(s),
    )
  }, [companies, leftSearch])

  function openAddCompany() {
    setCoName('')
    setCoGst('')
    setCoIndustry('')
    setCoNotes('')
    setBf({
      ...emptyBranchForm(),
      branch_name: 'Head Office',
    })
    setCompanySheet('add')
  }

  function openEditCompany() {
    if (!detail) return
    setCoName(detail.company_name)
    setCoGst(detail.gst_number ?? '')
    setCoIndustry(detail.industry ?? '')
    setCoNotes('')
    setCompanySheet('edit')
  }

  function openAddBranch() {
    if (!detail) return
    setEditingBranch(null)
    setBf({ ...emptyBranchForm(), branch_name: '' })
    setBranchSheet('add')
  }

  function openEditBranch(b: BranchResponse) {
    setEditingBranch(b)
    setBf({
      branch_name: b.branch_name,
      contact_name: b.contact_name ?? '',
      designation: b.designation ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      city: b.city,
      state: b.state ?? '',
      pincode: b.pincode ?? '',
      address_line1: b.address_line1 ?? '',
      country: b.country || 'India',
    })
    setBranchSheet('edit')
  }

  async function submitCompanySheet() {
    if (!coName.trim()) return
    setSaving(true)
    try {
      if (companySheet === 'add') {
        if (!bf.city.trim() || !bf.branch_name.trim()) {
          setErr('Branch name and city are required')
          setSaving(false)
          return
        }
        const payload: CreateCompanyRequestPayload = {
          company_name: coName.trim(),
          gst_number: coGst.trim() || null,
          industry: coIndustry.trim() || null,
          notes: coNotes.trim() || null,
          branch_name: bf.branch_name.trim(),
          contact_name: bf.contact_name.trim() || null,
          designation: bf.designation.trim() || null,
          phone: bf.phone.trim() || null,
          email: bf.email.trim() || null,
          city: bf.city.trim(),
          state: bf.state.trim() || null,
          pincode: bf.pincode.trim() || null,
          address_line1: bf.address_line1.trim() || null,
          country: bf.country.trim() || 'India',
        }
        const created = await clientsApi.createCompany(payload)
        setCompanySheet(null)
        await loadList()
        setSelectedId(created.id)
      } else if (companySheet === 'edit' && detail) {
        await clientsApi.updateCompany(detail.id, {
          company_name: coName.trim(),
          gst_number: coGst.trim() || null,
          industry: coIndustry.trim() || null,
          notes: coNotes.trim() || null,
        })
        setCompanySheet(null)
        await loadList()
        await loadDetail(detail.id)
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function submitBranchSheet() {
    if (!detail || !bf.branch_name.trim() || !bf.city.trim()) return
    setSaving(true)
    try {
      if (branchSheet === 'add') {
        await clientsApi.addBranch(detail.id, {
          branch_name: bf.branch_name.trim(),
          contact_name: bf.contact_name.trim() || null,
          designation: bf.designation.trim() || null,
          phone: bf.phone.trim() || null,
          email: bf.email.trim() || null,
          city: bf.city.trim(),
          state: bf.state.trim() || null,
          pincode: bf.pincode.trim() || null,
          address_line1: bf.address_line1.trim() || null,
          country: bf.country.trim() || 'India',
        })
      } else if (branchSheet === 'edit' && editingBranch) {
        await clientsApi.updateBranch(detail.id, editingBranch.id, {
          branch_name: bf.branch_name.trim(),
          contact_name: bf.contact_name.trim() || null,
          designation: bf.designation.trim() || null,
          phone: bf.phone.trim() || null,
          email: bf.email.trim() || null,
          city: bf.city.trim(),
          state: bf.state.trim() || null,
          pincode: bf.pincode.trim() || null,
          address_line1: bf.address_line1.trim() || null,
          country: bf.country.trim() || 'India',
        })
      }
      setBranchSheet(null)
      await loadList()
      await loadDetail(detail.id)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDeactivateBranch(b: BranchResponse) {
    if (!detail) return
    if (!confirm(`Deactivate branch "${b.branch_name}"?`)) return
    try {
      await clientsApi.deactivateBranch(detail.id, b.id)
      await loadList()
      await loadDetail(detail.id)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function onReactivateBranch(b: BranchResponse) {
    if (!detail) return
    try {
      await clientsApi.updateBranch(detail.id, b.id, { is_active: true })
      await loadList()
      await loadDetail(detail.id)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function onDeactivateCompany() {
    if (!detail) return
    if (!confirm('Deactivate this company?')) return
    try {
      await clientsApi.updateCompany(detail.id, { is_active: false })
      setSelectedId(null)
      await loadList()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const activeBranches = (detail?.branches ?? []).filter((b) => b.is_active)
  const inactiveBranches = (detail?.branches ?? []).filter((b) => !b.is_active)

  return (
    <div className="flex min-h-[560px] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 rounded-xl border border-surface-border bg-white p-4 shadow-sm lg:w-[320px]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-gray-900">
            Companies{' '}
            <span className="rounded-full bg-surface-page px-2 py-0.5 text-[11px] text-surface-muted">
              {companies.length}
            </span>
          </h2>
        </div>
        <Input
          placeholder="Search companies…"
          value={leftSearch}
          onChange={(e) => setLeftSearch(e.target.value)}
          className="mb-3 h-9"
        />
        <Button type="button" size="sm" className="mb-3 w-full bg-brand-green-500 hover:bg-brand-green-600" onClick={openAddCompany}>
          + Add Company
        </Button>
        {err && <p className="mb-2 text-[12px] text-red-600">{err}</p>}
        <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-[13px] text-surface-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-surface-muted">No companies</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors',
                  selectedId === c.id
                    ? 'border-l-2 border-l-brand-green-500 bg-brand-green-50'
                    : 'hover:bg-surface-page',
                  !c.is_active && 'opacity-60',
                )}
              >
                <p className="text-[14px] font-semibold text-gray-900">{c.company_name}</p>
                {c.industry ? (
                  <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                    {c.industry}
                  </span>
                ) : null}
                <p className="mt-1 text-[12px] text-surface-muted">
                  {c.branch_count} branches · {c.total_enquiry_count} enquiries
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 rounded-xl border border-surface-border bg-white p-5 shadow-sm">
        {!selectedId || !detail ? (
          <p className="text-[14px] text-surface-muted">Select a company to view branches and details.</p>
        ) : detailLoading ? (
          <p className="text-[14px] text-surface-muted">Loading…</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-gray-900">{detail.company_name}</h2>
                {detail.gst_number ? (
                  <p className="mt-1 font-mono text-[13px] text-surface-muted">GST {detail.gst_number}</p>
                ) : null}
                {detail.industry ? (
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                    {detail.industry}
                  </span>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  {detail.erp_code ? (
                    <span className="rounded-md border border-surface-border bg-surface-page px-2 py-0.5 font-mono text-[12px]">
                      ERP {detail.erp_code}
                    </span>
                  ) : null}
                  {detail.is_erp_synced ? (
                    <span className="text-[11px] text-brand-green-600">Synced</span>
                  ) : null}
                  <span className="text-surface-muted">{detail.total_enquiry_count} total enquiries</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={openEditCompany}>
                  Edit Company
                </Button>
                <button
                  type="button"
                  className="text-[12px] text-red-600 underline-offset-2 hover:underline"
                  onClick={onDeactivateCompany}
                >
                  Deactivate
                </button>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-gray-900">
                  Branches <span className="text-surface-muted">({detail.branches?.length ?? 0})</span>
                </h3>
                <Button type="button" size="sm" variant="outline" onClick={openAddBranch}>
                  + Add Branch
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[...activeBranches, ...inactiveBranches].map((b) => (
                  <div
                    key={b.id}
                    className={cn(
                      'rounded-lg border p-4 text-[13px]',
                      b.is_active ? 'border-surface-border' : 'border-dashed border-surface-border bg-gray-50 text-surface-muted',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                        <Building2 className="size-4 shrink-0 text-brand-navy-500" />
                        {b.branch_name}
                        {b.is_headquarters ? (
                          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-brand-gold-100 px-2 py-0.5 text-[10px] font-medium text-brand-navy-700">
                            <Star className="size-3" /> Primary
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-gray-800">{b.contact_name || '—'}</p>
                    {b.designation ? <p className="text-surface-muted">{b.designation}</p> : null}
                    {b.phone ? (
                      <p className="mt-1 flex items-center gap-1.5 text-surface-muted">
                        <Phone className="size-3.5" /> {b.phone}
                      </p>
                    ) : null}
                    {b.email ? (
                      <p className="flex items-center gap-1.5 text-surface-muted">
                        <Mail className="size-3.5" /> {b.email}
                      </p>
                    ) : null}
                    <p className="mt-1 flex items-start gap-1.5 text-surface-muted">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {[b.address_line1, [b.city, b.state].filter(Boolean).join(', '), b.pincode]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                    <p className="mt-2 text-[12px] text-surface-muted">{b.enquiry_count} enquiries</p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {b.is_active ? (
                        <>
                          <Button type="button" variant="ghost" size="sm" onClick={() => openEditBranch(b)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => onDeactivateBranch(b)}
                          >
                            Deactivate
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => onReactivateBranch(b)}>
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {detail.recent_enquiries && detail.recent_enquiries.length > 0 ? (
              <div className="rounded-lg border border-surface-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] font-medium text-gray-900"
                  onClick={() => setRecentOpen((o) => !o)}
                >
                  Recent Enquiries
                  {recentOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {recentOpen ? (
                  <div className="border-t border-surface-border px-4 py-2">
                    <ul className="space-y-2 text-[13px]">
                      {detail.recent_enquiries.map((r) => (
                        <li key={r.enquiry_id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-surface-muted">{r.created_at?.slice(0, 10)}</span>
                          <span>{r.branch_name || '—'}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">{r.status}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/enquiries?company_id=${detail.id}`}
                      className="mt-2 inline-block text-[13px] font-medium text-brand-green-600 hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <Sheet open={companySheet !== null} onOpenChange={(o) => !o && setCompanySheet(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>{companySheet === 'add' ? 'Add Company' : 'Edit Company'}</SheetTitle>
            <SheetDescription>
              {companySheet === 'add'
                ? 'Create the company and its first branch.'
                : 'Update company-level fields. Manage branches from the detail view.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-1">
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">Company Name *</label>
              <Input className="mt-1" value={coName} onChange={(e) => setCoName(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">GST Number</label>
              <Input className="mt-1 font-mono" value={coGst} onChange={(e) => setCoGst(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">Industry</label>
              <Select
                value={coIndustry || '__none__'}
                onValueChange={(v) => setCoIndustry(!v || v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {CLIENT_INDUSTRY_OPTIONS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">Notes</label>
              <Textarea className="mt-1 min-h-[72px]" value={coNotes} onChange={(e) => setCoNotes(e.target.value)} />
            </div>
            {companySheet === 'add' ? (
              <div className="rounded-lg bg-surface-page p-4">
                <p className="mb-3 text-[12px] font-semibold text-gray-900">First branch</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium uppercase text-surface-muted">Branch Name *</label>
                    <Input className="mt-1" value={bf.branch_name} onChange={(e) => setBf({ ...bf, branch_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium uppercase text-surface-muted">Contact</label>
                      <Input className="mt-1" value={bf.contact_name} onChange={(e) => setBf({ ...bf, contact_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase text-surface-muted">Designation</label>
                      <Input className="mt-1" value={bf.designation} onChange={(e) => setBf({ ...bf, designation: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium uppercase text-surface-muted">Phone</label>
                      <Input className="mt-1" value={bf.phone} onChange={(e) => setBf({ ...bf, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase text-surface-muted">Email</label>
                      <Input className="mt-1" value={bf.email} onChange={(e) => setBf({ ...bf, email: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium uppercase text-surface-muted">City *</label>
                    <Input className="mt-1" value={bf.city} onChange={(e) => setBf({ ...bf, city: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium uppercase text-surface-muted">State</label>
                      <Input className="mt-1" value={bf.state} onChange={(e) => setBf({ ...bf, state: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase text-surface-muted">Pincode</label>
                      <Input className="mt-1" value={bf.pincode} onChange={(e) => setBf({ ...bf, pincode: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium uppercase text-surface-muted">Address</label>
                    <Textarea className="mt-1 min-h-[60px]" value={bf.address_line1} onChange={(e) => setBf({ ...bf, address_line1: e.target.value })} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <SheetFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setCompanySheet(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={submitCompanySheet}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={branchSheet !== null} onOpenChange={(o) => !o && setBranchSheet(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>{branchSheet === 'add' ? 'Add Branch' : 'Edit Branch'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 px-1">
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">Branch Name *</label>
              <Input className="mt-1" value={bf.branch_name} onChange={(e) => setBf({ ...bf, branch_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium uppercase text-surface-muted">Contact</label>
                <Input className="mt-1" value={bf.contact_name} onChange={(e) => setBf({ ...bf, contact_name: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase text-surface-muted">Designation</label>
                <Input className="mt-1" value={bf.designation} onChange={(e) => setBf({ ...bf, designation: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium uppercase text-surface-muted">Phone</label>
                <Input className="mt-1" value={bf.phone} onChange={(e) => setBf({ ...bf, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase text-surface-muted">Email</label>
                <Input className="mt-1" value={bf.email} onChange={(e) => setBf({ ...bf, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">City *</label>
              <Input className="mt-1" value={bf.city} onChange={(e) => setBf({ ...bf, city: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium uppercase text-surface-muted">State</label>
                <Input className="mt-1" value={bf.state} onChange={(e) => setBf({ ...bf, state: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase text-surface-muted">Pincode</label>
                <Input className="mt-1" value={bf.pincode} onChange={(e) => setBf({ ...bf, pincode: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase text-surface-muted">Address</label>
              <Textarea className="mt-1 min-h-[60px]" value={bf.address_line1} onChange={(e) => setBf({ ...bf, address_line1: e.target.value })} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setBranchSheet(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={submitBranchSheet}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
