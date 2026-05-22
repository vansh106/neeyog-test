'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Download, Eye, FileText, Inbox } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import EnquiryListingFilters from '@/components/enquiries/EnquiryListingFilters'
import { useEnquiriesListingDataset, useQuotations } from '@/lib/queries'
import { erpExportUrl } from '@/lib/api'
import {
  collectEnquiryFilterOptions,
  defaultEnquiryListingDraft,
  filterEnquiriesLocal,
  INITIAL_APPLIED_ENQUIRY_FILTERS,
  type EnquiryListingFilters,
} from '@/lib/filterEnquiriesLocal'
import { formatRelativeTime, cn, truncateId } from '@/lib/utils'
import type { EnquiryListItem } from '@/types'

type Pipeline = 'all' | 'complete' | 'incomplete' | 'pending' | 'failed'

const PENDING_STATUSES = ['received', 'parsing', 'matching', 'quoting'] as const

const FLOW_OPTIONS = [
  { value: 'all', label: 'All flows' },
  { value: 'complete', label: 'Complete' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'ambiguous', label: 'Ambiguous' },
  { value: 'not_found', label: 'Not found' },
]

/** Backend validates `limit` ≤ 500 on GET /api/enquiries/ */
const LISTING_FETCH_LIMIT = 500

function TableSkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2E6DC] bg-white">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-24 rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-16" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-3 w-24" />
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  )
}

export default function EnquiriesPage() {
  const searchParams = useSearchParams()
  const companyFilter = searchParams.get('company_id') || undefined

  const [filterDraft, setFilterDraft] = useState<EnquiryListingFilters>(defaultEnquiryListingDraft)
  const [appliedFilters, setAppliedFilters] =
    useState<EnquiryListingFilters>(INITIAL_APPLIED_ENQUIRY_FILTERS)
  const [showSearchOptions, setShowSearchOptions] = useState(false)
  const [pipeline, setPipeline] = useState<Pipeline>('all')
  const [flowSelect, setFlowSelect] = useState('all')

  const {
    data: scopedRows = [],
    isPending,
    isError,
    error,
    refetch,
  } = useEnquiriesListingDataset(LISTING_FETCH_LIMIT, companyFilter)

  const filterOptions = useMemo(() => collectEnquiryFilterOptions(scopedRows), [scopedRows])

  const rows = useMemo(() => {
    let list = filterEnquiriesLocal(scopedRows, appliedFilters)

    if (pipeline === 'complete') list = list.filter((e) => e.flow_type === 'complete')
    else if (pipeline === 'incomplete') list = list.filter((e) => e.flow_type === 'incomplete')
    else if (pipeline === 'pending') {
      list = list.filter((e) => (PENDING_STATUSES as readonly string[]).includes(e.status))
    } else if (pipeline === 'failed') list = list.filter((e) => e.status === 'failed')

    if (flowSelect !== 'all') list = list.filter((e) => e.flow_type === flowSelect)

    return list
  }, [scopedRows, appliedFilters, pipeline, flowSelect])

  const chipCounts = useMemo(
    () => ({
      all: scopedRows.length,
      complete: scopedRows.filter((e) => e.flow_type === 'complete').length,
      incomplete: scopedRows.filter((e) => e.flow_type === 'incomplete').length,
      pending: scopedRows.filter((e) =>
        (PENDING_STATUSES as readonly string[]).includes(e.status),
      ).length,
      failed: scopedRows.filter((e) => e.status === 'failed').length,
    }),
    [scopedRows],
  )

  const { data: quotationRows = [] } = useQuotations({ limit: 100 })

  const enquiryToQuotationId = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of quotationRows) {
      if (row.enquiry_id) m.set(row.enquiry_id, row.quotation_id)
    }
    return m
  }, [quotationRows])

  const chips: { key: Pipeline; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'complete', label: 'Complete' },
    { key: 'incomplete', label: 'Incomplete' },
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' },
  ]

  const searchOptionsPanel = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {chips.map(({ key, label }) => {
          const active = pipeline === key
          const count = chipCounts[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPipeline(key)}
              className={cn(
                'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                active
                  ? 'bg-brand-green-500 text-white'
                  : 'border border-[#E2E6DC] bg-white text-gray-600',
              )}
            >
              {label}: {count}
            </button>
          )
        })}
      </div>
      <div className="min-w-[140px]">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
          Flow type
        </span>
        <Select value={flowSelect} onValueChange={(v) => setFlowSelect(v ?? 'all')}>
          <SelectTrigger className="h-8 w-full border-[#E2E6DC] bg-white text-[12px]">
            <SelectValue placeholder="Flow" />
          </SelectTrigger>
          <SelectContent>
            {FLOW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <PageShell
      title="Enquiries"
      actions={
        <span className="rounded-full bg-brand-green-500/15 px-2.5 py-1 text-[12px] font-semibold text-brand-green-600 tabular-nums">
          {rows.length}
          {rows.length !== scopedRows.length ? ` / ${scopedRows.length}` : ''}
        </span>
      }
    >
      <div className="space-y-3">
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            Could not load enquiries
            {error instanceof Error && error.message ? `: ${error.message}` : ''}.{' '}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        ) : null}
        <EnquiryListingFilters
          draft={filterDraft}
          onDraftChange={setFilterDraft}
          categoryOptions={filterOptions.categories}
          seriesOptions={filterOptions.series}
          showSearchOptions={showSearchOptions}
          onToggleSearchOptions={() => setShowSearchOptions((v) => !v)}
          onSearch={() => setAppliedFilters({ ...filterDraft })}
          extraOptions={searchOptionsPanel}
        />

        <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Flow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Created by</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              {isPending ? (
                <TableSkeletonRows />
              ) : rows.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState
                        icon={Inbox}
                        title="No enquiries found"
                        description={
                          scopedRows.length > 0
                            ? 'No rows match the current filters — clear date checkboxes or click Search with broader criteria'
                            : 'No enquiries in the system yet, or adjust filters and click Search'
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {rows.map((e: EnquiryListItem) => {
                    const quoteId = enquiryToQuotationId.get(e.enquiry_id)
                    const ext = e as EnquiryListItem & { quotation_id?: string | null }
                    const resolvedQuoteId = quoteId ?? ext.quotation_id ?? null
                    return (
                      <tr
                        key={e.enquiry_id}
                        className="cursor-pointer border-b border-[#E2E6DC] bg-white text-[13px] transition-colors hover:bg-[#F4F5F0]"
                      >
                        <td className="px-4 py-3 text-[13px] text-surface-foreground">
                          {(e.client_org_name ?? '').trim() || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-surface-foreground">
                          {(e.enquiry_number || '').trim() || truncateId(e.enquiry_id)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.flow_type} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="px-4 py-3 text-surface-muted" title={e.created_at}>
                          <span className="block text-[13px]">{formatRelativeTime(e.created_at)}</span>
                        </td>
                        <td className="px-4 py-3 align-top text-surface-muted">
                          {e.created_by_name ? (
                            <span className="block text-[11px] leading-snug text-[#6B7568]">
                              {e.created_by_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#6B7568]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/enquiries/${e.enquiry_id}`}
                              aria-label="View enquiry"
                              className={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon' }),
                                'text-surface-muted',
                              )}
                            >
                              <Eye className="size-4" />
                            </Link>
                            {e.erp_export_available ? (
                              <a
                                href={erpExportUrl(e.enquiry_id)}
                                aria-label="Download ERP Enquiry List"
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                                  'text-surface-muted',
                                )}
                              >
                                <Download className="size-4" />
                              </a>
                            ) : (
                              <span
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                                  'pointer-events-none text-surface-muted opacity-40',
                                )}
                                aria-label="No ERP export"
                              >
                                <Download className="size-4" />
                              </span>
                            )}
                            {resolvedQuoteId ? (
                              <Link
                                href={`/quotations/${resolvedQuoteId}`}
                                aria-label="View quotation"
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                                  'text-surface-muted',
                                )}
                              >
                                <FileText className="size-4" />
                              </Link>
                            ) : (
                              <span
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                                  'pointer-events-none text-surface-muted opacity-40',
                                )}
                                aria-label="No quotation"
                              >
                                <FileText className="size-4" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
