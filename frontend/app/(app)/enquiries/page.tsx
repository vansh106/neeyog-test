'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Inbox } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import EnquiryListingFiltersPanel from '@/components/enquiries/EnquiryListingFilters'
import EnquiryListDateEditor from '@/components/enquiries/EnquiryListDateEditor'
import { enquirySourceBadgeClass, formatEnquirySourceLabel } from '@/lib/enquirySource'
import { useEnquiriesListingDataset } from '@/lib/queries'
import { formatQuotationListDate } from '@/components/quotations/QuotationListDateEditor'
import {
  collectEnquiryFilterOptions,
  defaultEnquiryListingDraft,
  filterEnquiriesLocal,
  INITIAL_APPLIED_ENQUIRY_FILTERS,
  type EnquiryListingFilters,
} from '@/lib/filterEnquiriesLocal'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { EnquiryListItem } from '@/types'

type Pipeline = 'all' | 'complete' | 'incomplete' | 'pending' | 'failed'

const PENDING_STATUSES = ['received', 'parsing', 'matching', 'quoting'] as const

/** Backend validates `limit` ≤ 500 on GET /api/enquiries/ */
const LISTING_FETCH_LIMIT = 500
const COL_COUNT = 10

function TableSkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2E6DC] bg-white">
          {Array.from({ length: COL_COUNT }).map((__, j) => (
            <td key={j} className="px-3 py-3">
              <Skeleton className="h-4 w-full max-w-[100px]" />
            </td>
          ))}
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

    return list
  }, [scopedRows, appliedFilters, pipeline])

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
        <EnquiryListingFiltersPanel
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
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                  <th className="min-w-[100px] whitespace-nowrap px-3 py-3">Enq No.</th>
                  <th className="min-w-[88px] whitespace-nowrap px-3 py-3">Source</th>
                  <th className="min-w-[72px] whitespace-nowrap px-3 py-3">Date</th>
                  <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Client</th>
                  <th className="min-w-[160px] whitespace-nowrap px-3 py-3">Items Desc</th>
                  <th className="min-w-[72px] whitespace-nowrap px-3 py-3">Age</th>
                  <th className="min-w-[120px] whitespace-nowrap px-3 py-3">Status</th>
                  <th className="min-w-[100px] whitespace-nowrap px-3 py-3">Quote Number</th>
                  <th className="min-w-[88px] whitespace-nowrap px-3 py-3">User</th>
                  <th className="min-w-[110px] whitespace-nowrap px-3 py-3">Next follow-up</th>
                </tr>
              </thead>
              {isPending ? (
                <TableSkeletonRows />
              ) : rows.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={COL_COUNT} className="p-0">
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
                  {rows.map((e: EnquiryListItem) => (
                    <tr
                      key={e.enquiry_id}
                      className="border-b border-[#E2E6DC] bg-white text-[13px] transition-colors hover:bg-[#F4F5F0]"
                    >
                      <td className="px-3 py-3 align-top font-mono text-[12px]">
                        <Link
                          href={`/enquiries/${e.enquiry_id}`}
                          className="text-brand-gold-500 hover:underline"
                        >
                          {(e.enquiry_number || '').trim() || e.enquiry_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
                            enquirySourceBadgeClass(e.source),
                          )}
                        >
                          {formatEnquirySourceLabel(e.source)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-gray-900">
                        {formatQuotationListDate(e.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top text-[13px] text-surface-foreground">
                        {(e.client_org_name ?? '').trim() || '—'}
                      </td>
                      <td
                        className="max-w-[200px] truncate px-3 py-3 align-top text-[12px] text-surface-muted"
                        title={e.item_desc_short || ''}
                      >
                        {e.item_desc_short || '—'}
                      </td>
                      <td className="px-3 py-3 align-top text-surface-muted" title={e.created_at}>
                        <span className="block text-[13px]">{formatRelativeTime(e.created_at)}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-[12px]">
                        {e.quote_number && e.quotation_id ? (
                          <Link
                            href={`/quotations/${e.quotation_id}`}
                            className="text-brand-navy-600 hover:underline"
                          >
                            {e.quote_number}
                          </Link>
                        ) : (
                          <span className="text-surface-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] text-surface-muted">
                        {e.created_by_name || '—'}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <EnquiryListDateEditor
                          enquiryId={e.enquiry_id}
                          value={e.next_follow_up_date}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
