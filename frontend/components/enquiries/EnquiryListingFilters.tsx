'use client'

import type { ReactNode } from 'react'
import { CircleHelp, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ENQUIRY_SOURCE_OPTIONS } from '@/lib/enquirySource'
import type { EnquiryListingFilters as Filters } from '@/lib/filterEnquiriesLocal'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'received', label: 'Received' },
  { value: 'parsing', label: 'Parsing' },
  { value: 'matching', label: 'Matching' },
  { value: 'quoting', label: 'Quoting' },
  { value: 'awaiting_info', label: 'Awaiting info' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'pending_human_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'failed', label: 'Failed' },
]

type Props = {
  draft: Filters
  onDraftChange: (next: Filters) => void
  categoryOptions: string[]
  seriesOptions: string[]
  showSearchOptions: boolean
  onToggleSearchOptions: () => void
  onSearch: () => void
  extraOptions?: ReactNode
}

function FilterCheckbox({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  'aria-label': string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      className="size-3 shrink-0 rounded border-[#B8BFB4] text-brand-green-600 focus:ring-brand-green-500/30"
    />
  )
}

/** Inline: [checkbox?] label control */
function FilterCell({
  label,
  checkbox,
  children,
  className,
  alignEnd,
}: {
  label: string
  checkbox?: ReactNode
  children: ReactNode
  className?: string
  alignEnd?: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1',
        alignEnd && 'justify-end',
        className,
      )}
    >
      {checkbox ?? <span className="inline-block w-3 shrink-0" aria-hidden />}
      {label.trim() ? (
        <span className="shrink-0 whitespace-nowrap text-[10px] leading-none text-gray-700">
          {label}
        </span>
      ) : null}
      <div className={cn('min-w-0', label.trim() || checkbox ? 'flex-1' : 'w-full')}>
        {children}
      </div>
    </div>
  )
}

function patch(draft: Filters, partial: Partial<Filters>): Filters {
  return { ...draft, ...partial }
}

const inputClass =
  'h-6 w-full min-w-0 border-[#C5C9C0] px-1 py-0 text-[10px] leading-tight disabled:cursor-not-allowed disabled:opacity-50'
const selectTriggerClass = 'h-6 w-full min-w-0 border-[#C5C9C0] px-1 text-[10px] leading-tight'

export default function EnquiryListingFilters({
  draft,
  onDraftChange,
  categoryOptions,
  seriesOptions,
  showSearchOptions,
  onToggleSearchOptions,
  onSearch,
  extraOptions,
}: Props) {
  const set = (partial: Partial<Filters>) => onDraftChange(patch(draft, partial))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch()
    }
  }

  return (
    <div
      className="rounded-lg border border-[#C5C9C0] bg-[#FAFBF8] p-1.5 shadow-sm text-[10px]"
      onKeyDown={handleKeyDown}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[1040px] space-y-1.5">
          <div className="grid grid-cols-7 gap-x-2 gap-y-0">
            <FilterCell
              label="From :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useFromDate}
                  onChange={(v) => set({ useFromDate: v })}
                  aria-label="Filter from date"
                />
              }
            >
              <Input
                type="date"
                value={draft.dateFrom}
                onChange={(e) => set({ dateFrom: e.target.value })}
                disabled={!draft.useFromDate}
                className={inputClass}
              />
            </FilterCell>

            <FilterCell label="Category :">
              <Select value={draft.category} onValueChange={(v) => set({ category: v ?? 'ALL' })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCell>

            <FilterCell
              label="Customer :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useCustomer}
                  onChange={(v) => set({ useCustomer: v })}
                  aria-label="Filter by customer"
                />
              }
            >
              <Input
                value={draft.customer}
                onChange={(e) => set({ customer: e.target.value })}
                disabled={!draft.useCustomer}
                placeholder="Name..."
                className={inputClass}
              />
            </FilterCell>

            <FilterCell
              label="Non Std Cust :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useNonStandardCustomer}
                  onChange={(v) => set({ useNonStandardCustomer: v })}
                  aria-label="Filter non-standard customer"
                />
              }
            >
              <Input
                value={draft.nonStandardCustomer}
                onChange={(e) => set({ nonStandardCustomer: e.target.value })}
                disabled={!draft.useNonStandardCustomer}
                placeholder="Name..."
                className={inputClass}
              />
            </FilterCell>

            <FilterCell
              label="Item Like :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useItemLikeSearch}
                  onChange={(v) => set({ useItemLikeSearch: v })}
                  aria-label="Item like search"
                />
              }
            >
              <Input
                value={draft.itemLikeSearch}
                onChange={(e) => set({ itemLikeSearch: e.target.value })}
                disabled={!draft.useItemLikeSearch}
                placeholder="Like Search..."
                className={inputClass}
              />
            </FilterCell>

            <FilterCell
              label="User Name :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useUserName}
                  onChange={(v) => set({ useUserName: v })}
                  aria-label="Filter by user name"
                />
              }
            >
              <Input
                value={draft.userName}
                onChange={(e) => set({ userName: e.target.value })}
                disabled={!draft.useUserName}
                className={inputClass}
              />
            </FilterCell>

            <FilterCell label="" alignEnd>
              <Button
                type="button"
                variant="outline"
                className="h-6 w-full gap-0.5 border-[#9EB8D9] bg-white px-1.5 text-[10px] leading-none text-[#2563EB] hover:bg-[#EFF6FF]"
                onClick={onToggleSearchOptions}
              >
                <CircleHelp className="size-3 shrink-0" />
                <span className="truncate">Search Option</span>
              </Button>
            </FilterCell>
          </div>

          <div className="grid grid-cols-7 gap-x-2 gap-y-0">
            <FilterCell
              label="To :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useToDate}
                  onChange={(v) => set({ useToDate: v })}
                  aria-label="Filter to date"
                />
              }
            >
              <Input
                type="date"
                value={draft.dateTo}
                onChange={(e) => set({ dateTo: e.target.value })}
                disabled={!draft.useToDate}
                className={inputClass}
              />
            </FilterCell>

            <FilterCell label="Status :">
              <Select value={draft.status} onValueChange={(v) => set({ status: v ?? 'ALL' })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCell>

            <FilterCell
              label="Enquiry No :"
              checkbox={
                <FilterCheckbox
                  checked={draft.useEnquiryNo}
                  onChange={(v) => set({ useEnquiryNo: v })}
                  aria-label="Filter enquiry number"
                />
              }
            >
              <Input
                value={draft.enquiryNo}
                onChange={(e) => set({ enquiryNo: e.target.value })}
                disabled={!draft.useEnquiryNo}
                className={inputClass}
              />
            </FilterCell>

            <FilterCell
              label="Item/No/Desc"
              checkbox={
                <FilterCheckbox
                  checked={draft.useItemNoDesc}
                  onChange={(v) => set({ useItemNoDesc: v })}
                  aria-label="Filter item number or description"
                />
              }
            >
              <Input
                value={draft.itemNoDesc}
                onChange={(e) => set({ itemNoDesc: e.target.value })}
                disabled={!draft.useItemNoDesc}
                placeholder="Name..."
                className={inputClass}
              />
            </FilterCell>

            <FilterCell label="Source :">
              <Select value={draft.source} onValueChange={(v) => set({ source: v ?? 'ALL' })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  {ENQUIRY_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCell>

            <FilterCell label="Series :">
              <Select value={draft.series} onValueChange={(v) => set({ series: v ?? 'ALL' })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  {seriesOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCell>

            <FilterCell label="" alignEnd>
              <Button
                type="button"
                className="h-6 w-full gap-0.5 bg-brand-green-500 px-2 text-[10px] leading-none hover:bg-brand-green-600"
                onClick={onSearch}
              >
                <Search className="size-3 shrink-0" />
                Search
              </Button>
            </FilterCell>
          </div>
        </div>
      </div>

      {showSearchOptions && extraOptions ? (
        <div className="mt-1.5 border-t border-[#E2E6DC] pt-1.5">{extraOptions}</div>
      ) : null}
    </div>
  )
}
