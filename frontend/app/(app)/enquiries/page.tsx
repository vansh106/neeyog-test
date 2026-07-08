'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Inbox } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import ArchiveRecordDialog from '@/components/listing/ArchiveRecordDialog'
import EnquiryListingFiltersPanel from '@/components/enquiries/EnquiryListingFilters'
import EnquiryListDetailTypeEditor from '@/components/enquiries/EnquiryListDetailTypeEditor'
import EnquiryListQuoteStatusEditor from '@/components/enquiries/EnquiryListQuoteStatusEditor'
import EnquiryListDateEditor from '@/components/enquiries/EnquiryListDateEditor'
import EnquiryListUserAssigner from '@/components/enquiries/EnquiryListUserAssigner'
import ListingItemDescriptionsCell from '@/components/listing/ListingItemDescriptionsCell'
import ListingPagination from '@/components/listing/ListingPagination'
import { enquirySourceBadgeClass, formatEnquirySourceLabel } from '@/lib/enquirySource'
import { useEnquiriesListingDataset, useTeamUsers } from '@/lib/queries'
import { formatQuotationListDate } from '@/components/quotations/QuotationListDateEditor'
import {
  collectEnquiryFilterOptions,
  defaultEnquiryListingDraft,
  filterEnquiriesLocal,
  INITIAL_APPLIED_ENQUIRY_FILTERS,
  type EnquiryListingFilters,
} from '@/lib/filterEnquiriesLocal'
import ListingExportButton from '@/components/listing/ListingExportButton'
import { exportEnquiriesListingExcel } from '@/lib/exportEnquiriesListing'
import {
  ARCHIVE_FILTER_OPTIONS,
  archivedListingRowClass,
  matchesArchiveFilter,
  type ArchiveFilter,
} from '@/lib/archiveFilter'
import { enquiriesApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { formatRelativeTime, cn } from '@/lib/utils'
import { listingPageSlice, listingSerialNumber } from '@/lib/listingPagination'
import type { EnquiryListItem } from '@/types'

type Pipeline = 'all' | 'complete' | 'incomplete' | 'pending' | 'failed'

const PENDING_STATUSES = ['received', 'parsing', 'matching', 'quoting'] as const

/** Backend validates `limit` ≤ 500 on GET /api/enquiries/ */
const LISTING_FETCH_LIMIT = 500
const COL_COUNT = 13

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
  const queryClient = useQueryClient()
  const canArchive = useAuthStore((s) => s.hasPermission(Permissions.DELETE_ENQUIRIES))
  const searchParams = useSearchParams()
  const companyFilter = searchParams.get('company_id') || undefined

  const [filterDraft, setFilterDraft] = useState<EnquiryListingFilters>(defaultEnquiryListingDraft)
  const [appliedFilters, setAppliedFilters] =
    useState<EnquiryListingFilters>(INITIAL_APPLIED_ENQUIRY_FILTERS)
  const [showSearchOptions, setShowSearchOptions] = useState(false)
  const [pipeline, setPipeline] = useState<Pipeline>('all')
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active')
  const [archiveTarget, setArchiveTarget] = useState<EnquiryListItem | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const {
    data: scopedRows = [],
    isPending,
    isError,
    error,
    refetch,
  } = useEnquiriesListingDataset(LISTING_FETCH_LIMIT, companyFilter)

  const { data: teamUsers = [] } = useTeamUsers(false)
  const assignableUsers = useMemo(
    () =>
      (teamUsers as Array<{ id: string; full_name: string; tier: string; is_active: boolean }>)
        .filter((u) => u.is_active && u.tier !== 'superadmin')
        .map((u) => ({ id: u.id, full_name: u.full_name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [teamUsers],
  )

  const archiveMut = useMutation({
    mutationFn: (enquiryId: string) =>
      enquiriesApi.archive<{ enquiry_id: string; is_archived: boolean }>(enquiryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      await queryClient.invalidateQueries({ queryKey: ['quotations'] })
      setArchiveTarget(null)
      setArchiveError(null)
    },
    onError: (e: unknown) => {
      setArchiveError(e instanceof Error ? e.message : 'Failed to archive enquiry')
    },
  })

  const filterOptions = useMemo(() => collectEnquiryFilterOptions(scopedRows), [scopedRows])

  const rows = useMemo(() => {
    let list = filterEnquiriesLocal(scopedRows, appliedFilters, archiveFilter)

    if (pipeline === 'complete') list = list.filter((e) => e.flow_type === 'complete')
    else if (pipeline === 'incomplete') list = list.filter((e) => e.flow_type === 'incomplete')
    else if (pipeline === 'pending') {
      list = list.filter((e) => (PENDING_STATUSES as readonly string[]).includes(e.status))
    } else if (pipeline === 'failed') list = list.filter((e) => e.status === 'failed')

    return list
  }, [scopedRows, appliedFilters, pipeline, archiveFilter])

  useEffect(() => {
    setPage(1)
  }, [appliedFilters, pipeline, archiveFilter, companyFilter])

  const pagedRows = useMemo(() => listingPageSlice(rows, page), [rows, page])

  const archiveScopedRows = useMemo(
    () => scopedRows.filter((e) => matchesArchiveFilter(e.is_archived, archiveFilter)),
    [scopedRows, archiveFilter],
  )

  const chipCounts = useMemo(
    () => ({
      all: archiveScopedRows.length,
      complete: archiveScopedRows.filter((e) => e.flow_type === 'complete').length,
      incomplete: archiveScopedRows.filter((e) => e.flow_type === 'incomplete').length,
      pending: archiveScopedRows.filter((e) =>
        (PENDING_STATUSES as readonly string[]).includes(e.status),
      ).length,
      failed: archiveScopedRows.filter((e) => e.status === 'failed').length,
    }),
    [archiveScopedRows],
  )

  const chips: { key: Pipeline; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'complete', label: 'Complete' },
    { key: 'incomplete', label: 'Not Quoted' },
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
      <div className="flex items-center gap-2">
        <label htmlFor="enq-archive-filter" className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
          Records
        </label>
        <select
          id="enq-archive-filter"
          value={archiveFilter}
          onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)}
          className="h-8 rounded-md border border-[#E2E6DC] bg-white px-2 text-[12px] text-gray-900"
        >
          {ARCHIVE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <PageShell
      title="Enquiries"
      actions={
        <div className="flex items-center gap-2">
          <ListingExportButton
            dialogTitle="Export enquiries"
            dialogDescription="Choose a time period. Each enquiry is exported on its own row with alternating row colors."
            onExport={(range) => exportEnquiriesListingExcel(rows, range)}
            disabled={isPending || rows.length === 0}
          />
          <span className="rounded-full bg-brand-green-500/15 px-2.5 py-1 text-[12px] font-semibold text-brand-green-600 tabular-nums">
            {rows.length}
            {rows.length !== scopedRows.length ? ` / ${scopedRows.length}` : ''}
          </span>
        </div>
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
                  <th className="min-w-[44px] whitespace-nowrap px-3 py-3">S.No.</th>
                  <th className="min-w-[100px] whitespace-nowrap px-3 py-3">Enq No.</th>
                  <th className="min-w-[88px] whitespace-nowrap px-3 py-3">Source</th>
                  <th className="min-w-[108px] whitespace-nowrap px-3 py-3">Enquiry type</th>
                  <th className="min-w-[72px] whitespace-nowrap px-3 py-3">Date</th>
                  <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Client</th>
                  <th className="min-w-[160px] whitespace-nowrap px-3 py-3">Items Desc</th>
                  <th className="min-w-[72px] whitespace-nowrap px-3 py-3">Age</th>
                  <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Quote status</th>
                  <th className="min-w-[100px] whitespace-nowrap px-3 py-3">Quote Number</th>
                  <th className="min-w-[88px] whitespace-nowrap px-3 py-3">User</th>
                  <th className="min-w-[110px] whitespace-nowrap px-3 py-3">Next follow-up</th>
                  <th className="min-w-[72px] whitespace-nowrap px-3 py-3 text-right">Actions</th>
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
                  {pagedRows.map((e: EnquiryListItem, index) => (
                    <tr
                      key={e.enquiry_id}
                      className={cn(
                        'border-b border-[#E2E6DC] text-[13px] transition-colors',
                        archivedListingRowClass(e.is_archived),
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-[13px] text-surface-muted">
                        {listingSerialNumber(page, index, undefined, rows.length)}
                      </td>
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
                      <td className="px-3 py-3 align-top">
                        <EnquiryListDetailTypeEditor
                          enquiryId={e.enquiry_id}
                          value={e.enquiry_detail_type}
                          disabled={Boolean(e.is_archived)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-gray-900">
                        {formatQuotationListDate(e.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top text-[13px] text-surface-foreground">
                        {(e.client_org_name ?? '').trim() || '—'}
                      </td>
                      <td className="max-w-[220px] px-3 py-3 align-top">
                        <ListingItemDescriptionsCell
                          lines={e.item_desc_lines}
                          fallbackShort={e.item_desc_short}
                        />
                      </td>
                      <td className="px-3 py-3 align-top text-surface-muted" title={e.created_at}>
                        <span className="block text-[13px]">{formatRelativeTime(e.created_at)}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <EnquiryListQuoteStatusEditor
                          enquiryId={e.enquiry_id}
                          value={e.enquiry_quote_status}
                          disabled={Boolean(e.is_archived)}
                        />
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
                      <td className="px-3 py-3 align-top">
                        <EnquiryListUserAssigner
                          enquiryId={e.enquiry_id}
                          userId={e.created_by_user_id}
                          userName={e.created_by_name}
                          users={assignableUsers}
                          disabled={Boolean(e.is_archived)}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <EnquiryListDateEditor
                          enquiryId={e.enquiry_id}
                          value={e.next_follow_up_date}
                          note={e.next_follow_up_note}
                          history={e.follow_up_history}
                        />
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        {canArchive && !e.is_archived ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[12px] text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={() => {
                              setArchiveError(null)
                              setArchiveTarget(e)
                            }}
                            aria-label={`Archive enquiry ${e.enquiry_number || e.enquiry_id}`}
                          >
                            <Archive className="mr-1 size-3.5" />
                            Archive
                          </Button>
                        ) : (
                          <span className="text-surface-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {!isPending && rows.length > 0 ? (
            <ListingPagination page={page} totalItems={rows.length} onPageChange={setPage} />
          ) : null}
        </div>
      </div>

      <ArchiveRecordDialog
        open={archiveTarget != null}
        onOpenChange={(next) => {
          if (!next && !archiveMut.isPending) {
            setArchiveTarget(null)
            setArchiveError(null)
          }
        }}
        title="Archive enquiry?"
        description={
          archiveTarget ? (
            <>
              Enquiry{' '}
              <span className="font-medium text-gray-900">
                {(archiveTarget.enquiry_number || '').trim() || archiveTarget.enquiry_id.slice(0, 8)}
              </span>{' '}
              will be archived along with its quotations. Archived records are excluded from
              analytics but remain viewable in the archived list.
            </>
          ) : (
            'This enquiry will be archived.'
          )
        }
        busy={archiveMut.isPending}
        error={archiveError}
        onConfirm={() => {
          if (!archiveTarget) return
          archiveMut.mutate(archiveTarget.enquiry_id)
        }}
      />
    </PageShell>
  )
}
