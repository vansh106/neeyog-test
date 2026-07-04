'use client'

import { UserPlus, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { clientsApi } from '@/lib/api'
import {
  BRANCH_PRIMARY_CONTACT,
  isValidEmail,
  type ManualClientPickerState,
} from '@/lib/manualClientPicker'
import { CLIENT_INDUSTRY_OPTIONS } from '@/types'

const SELECT_EMPTY = '__none__'

type Props = ManualClientPickerState & {
  disabled?: boolean
}

export default function ManualClientDetailsSection({
  disabled = false,
  clientMode,
  setClientMode,
  newClient,
  setNewClient,
  companyQuery,
  setCompanyQuery,
  companyMenuOpen,
  setCompanyMenuOpen,
  mergedCompanyOptions,
  selectedCompany,
  setSelectedCompany,
  selectedBranchId,
  setSelectedBranchId,
  selectedBranch,
  showAddBranch,
  setShowAddBranch,
  addBranchSaving,
  setAddBranchSaving,
  inlineBranch,
  setInlineBranch,
  errors,
  branchEmployees,
  setBranchEmployees,
  employeesLoading,
  selectedClientEmployeeId,
  setSelectedClientEmployeeId,
  quoteContactSelectLabel,
  inlineNewEmployeeAddressCode,
  setInlineNewEmployeeAddressCode,
  inlineNewEmployeeName,
  setInlineNewEmployeeName,
  inlineNewEmployeePhone,
  setInlineNewEmployeePhone,
  inlineNewEmployeeEmail,
  setInlineNewEmployeeEmail,
  inlineNewEmployeeDepartment,
  setInlineNewEmployeeDepartment,
  inlineNewEmployeeDesignation,
  setInlineNewEmployeeDesignation,
  addEmployeeSaving,
  setAddEmployeeSaving,
  addEmployeeErr,
  setAddEmployeeErr,
  newClientQuoteEmployeeAddressCode,
  setNewClientQuoteEmployeeAddressCode,
  newClientQuoteEmployeeName,
  setNewClientQuoteEmployeeName,
  newClientQuoteEmployeePhone,
  setNewClientQuoteEmployeePhone,
  newClientQuoteEmployeeEmail,
  setNewClientQuoteEmployeeEmail,
  newClientQuoteEmployeeDepartment,
  setNewClientQuoteEmployeeDepartment,
  newClientQuoteEmployeeDesignation,
  setNewClientQuoteEmployeeDesignation,
}: Props) {
  return (
    <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-navy-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">Client Details</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
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
            disabled={disabled}
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
              disabled={disabled}
              onChange={(e) => {
                setCompanyQuery(e.target.value)
                setCompanyMenuOpen(true)
              }}
              onFocus={() => setCompanyMenuOpen(true)}
              placeholder="Type to search…"
              className={cn('h-10', errors.client && 'border-red-300')}
            />
            {companyMenuOpen && !disabled && (
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
                        disabled={disabled}
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
                      disabled={disabled}
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
                          disabled={disabled}
                          value={inlineBranch.branch_name}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, branch_name: e.target.value })}
                        />
                        <Input
                          placeholder="City *"
                          disabled={disabled}
                          value={inlineBranch.city}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, city: e.target.value })}
                        />
                        <Input
                          placeholder="Contact"
                          disabled={disabled}
                          value={inlineBranch.contact_name}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, contact_name: e.target.value })}
                        />
                        <Input
                          placeholder="Designation"
                          disabled={disabled}
                          value={inlineBranch.designation}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, designation: e.target.value })}
                        />
                        <Input
                          placeholder="Phone"
                          disabled={disabled}
                          value={inlineBranch.phone}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, phone: e.target.value })}
                        />
                        <Input
                          placeholder="Email"
                          disabled={disabled}
                          value={inlineBranch.email}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, email: e.target.value })}
                        />
                        <Input
                          placeholder="State *"
                          disabled={disabled}
                          value={inlineBranch.state}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, state: e.target.value })}
                          className="sm:col-span-1"
                        />
                        <Input
                          placeholder="Pincode"
                          disabled={disabled}
                          value={inlineBranch.pincode}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, pincode: e.target.value })}
                        />
                        <Textarea
                          placeholder="Address"
                          disabled={disabled}
                          className="min-h-[56px] sm:col-span-2"
                          value={inlineBranch.address_line1}
                          onChange={(e) => setInlineBranch({ ...inlineBranch, address_line1: e.target.value })}
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={disabled || addBranchSaving}
                          onClick={async () => {
                            if (!inlineBranch.branch_name.trim() || !inlineBranch.city.trim() || !inlineBranch.state.trim()) return
                            setAddBranchSaving(true)
                            try {
                              await clientsApi.addBranch(selectedCompany.id, {
                                branch_name: inlineBranch.branch_name.trim(),
                                contact_name: inlineBranch.contact_name.trim() || null,
                                designation: inlineBranch.designation.trim() || null,
                                phone: inlineBranch.phone.trim() || null,
                                email: inlineBranch.email.trim() || null,
                                city: inlineBranch.city.trim(),
                                state: inlineBranch.state.trim(),
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => setShowAddBranch(false)}
                        >
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
                      disabled={disabled}
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
                    {[
                      selectedBranch.address_line1,
                      [selectedBranch.city, selectedBranch.state].filter(Boolean).join(', '),
                      selectedBranch.pincode,
                    ]
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
                        disabled={disabled || employeesLoading}
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
                            disabled={disabled}
                            onChange={(e) => setInlineNewEmployeeAddressCode(e.target.value)}
                            placeholder="Address Code"
                            className="h-9 text-[13px]"
                          />
                          <Input
                            value={inlineNewEmployeeName}
                            disabled={disabled}
                            onChange={(e) => setInlineNewEmployeeName(e.target.value)}
                            placeholder="Person Name *"
                            className="h-9 text-[13px]"
                          />
                          <Input
                            value={inlineNewEmployeePhone}
                            disabled={disabled}
                            onChange={(e) => setInlineNewEmployeePhone(e.target.value)}
                            placeholder="Contact No."
                            className="h-9 text-[13px]"
                          />
                          <Input
                            value={inlineNewEmployeeEmail}
                            disabled={disabled}
                            onChange={(e) => setInlineNewEmployeeEmail(e.target.value)}
                            placeholder="Email"
                            type="email"
                            className="h-9 text-[13px]"
                          />
                          <Input
                            value={inlineNewEmployeeDepartment}
                            disabled={disabled}
                            onChange={(e) => setInlineNewEmployeeDepartment(e.target.value)}
                            placeholder="Department"
                            className="h-9 text-[13px]"
                          />
                          <Input
                            value={inlineNewEmployeeDesignation}
                            disabled={disabled}
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
                            disabled ||
                            addEmployeeSaving ||
                            !inlineNewEmployeeName.trim() ||
                            (inlineNewEmployeeEmail.trim() !== '' &&
                              !isValidEmail(inlineNewEmployeeEmail.trim()))
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
                                e instanceof Error
                                  ? e.message
                                  : 'Could not save contact — try again.',
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
                  disabled={disabled}
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
                    disabled={disabled}
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
                    disabled={disabled}
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
                  disabled={disabled}
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
                  disabled={disabled}
                  onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                  className={cn('mt-1 h-10', errors.contact_name && 'border-red-300')}
                />
                {errors.contact_name && <p className="text-[12px] text-red-600">{errors.contact_name}</p>}
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Designation</div>
                <Input
                  value={newClient.designation}
                  disabled={disabled}
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
                  disabled={disabled}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className={cn('mt-1 h-10', errors.phone && 'border-red-300')}
                />
                {errors.phone && <p className="text-[12px] text-red-600">{errors.phone}</p>}
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Email</div>
                <Input
                  value={newClient.email}
                  disabled={disabled}
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
                    disabled={disabled}
                    onChange={(e) => setNewClientQuoteEmployeeAddressCode(e.target.value)}
                    className="h-9 text-[13px]"
                    placeholder="Address Code"
                  />
                  <Input
                    value={newClientQuoteEmployeeName}
                    disabled={disabled}
                    onChange={(e) => setNewClientQuoteEmployeeName(e.target.value)}
                    className="h-9 text-[13px]"
                    placeholder="Person Name"
                  />
                  <Input
                    value={newClientQuoteEmployeePhone}
                    disabled={disabled}
                    onChange={(e) => setNewClientQuoteEmployeePhone(e.target.value)}
                    className="h-9 text-[13px]"
                    placeholder="Contact No."
                  />
                  <Input
                    value={newClientQuoteEmployeeEmail}
                    disabled={disabled}
                    onChange={(e) => setNewClientQuoteEmployeeEmail(e.target.value)}
                    className="h-9 text-[13px]"
                    placeholder="Email"
                    type="email"
                  />
                  <Input
                    value={newClientQuoteEmployeeDepartment}
                    disabled={disabled}
                    onChange={(e) => setNewClientQuoteEmployeeDepartment(e.target.value)}
                    className="h-9 text-[13px]"
                    placeholder="Department"
                  />
                  <Input
                    value={newClientQuoteEmployeeDesignation}
                    disabled={disabled}
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
                  disabled={disabled}
                  onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                  className={cn('mt-1 h-10', errors.city && 'border-red-300')}
                />
                {errors.city && <p className="text-[12px] text-red-600">{errors.city}</p>}
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                  State<span className="text-red-600"> *</span>
                </div>
                <Input
                  value={newClient.state}
                  disabled={disabled}
                  onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                  className={cn('mt-1 h-10', errors.state && 'border-red-300')}
                />
                {errors.state && <p className="text-[12px] text-red-600">{errors.state}</p>}
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Pincode</div>
                <Input
                  value={newClient.pincode}
                  disabled={disabled}
                  onChange={(e) => setNewClient({ ...newClient, pincode: e.target.value })}
                  className="mt-1 h-10"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">Address</div>
                <Textarea
                  value={newClient.address_line1}
                  disabled={disabled}
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
  )
}
