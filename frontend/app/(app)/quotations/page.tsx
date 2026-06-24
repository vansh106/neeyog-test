'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, FileText, Search } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ArchiveRecordDialog from '@/components/listing/ArchiveRecordDialog'
import QuotationLineStatusCell from '@/components/quotations/QuotationLineStatusCell'
import ListingItemDescriptionsCell from '@/components/listing/ListingItemDescriptionsCell'
import ListingCategoryCell from '@/components/listing/ListingCategoryCell'
import QuotationListDateEditor, {
  formatQuotationListDate,
} from '@/components/quotations/QuotationListDateEditor'
import { useQuotationsListingDataset } from '@/lib/queries'
import { filterQuotationsLocal } from '@/lib/filterQuotationsLocal'
import { ARCHIVE_FILTER_OPTIONS, archivedListingRowClass, type ArchiveFilter } from '@/lib/archiveFilter'
import {
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { quotationsApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import type { QuotationListItem } from '@/types'

const COL_COUNT = 14

function TableSkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
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

const LISTING_FETCH_LIMIT = 2000

export default function QuotationsPage() {
  const queryClient = useQueryClient()
  const canArchive = useAuthStore((s) => s.hasPermission(Permissions.DELETE_QUOTATIONS))
  const [searchInput, setSearchInput] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active')
  const [archiveTarget, setArchiveTarget] = useState<QuotationListItem | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const { data: quotations, isPending } = useQuotationsListingDataset(LISTING_FETCH_LIMIT)
  const allRows: QuotationListItem[] = quotations ?? []

  const archiveMut = useMutation({
    mutationFn: (quotationId: string) =>
      quotationsApi.archive<{ quotation_id: string; is_archived: boolean }>(quotationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quotations'] })
      setArchiveTarget(null)
      setArchiveError(null)
    },
    onError: (e: unknown) => {
      setArchiveError(e instanceof Error ? e.message : 'Failed to archive quotation')
    },
  })

  const list = useMemo(
    () =>
      filterQuotationsLocal(allRows, {
        search: searchInput,
        clientName: clientFilter,
        status: statusFilter,
        dateFrom,
        dateTo,
        archive: archiveFilter,
      }),
    [allRows, searchInput, clientFilter, statusFilter, dateFrom, dateTo, archiveFilter],
  )
  const totalValue = list.reduce((sum, q) => sum + q.total_amount, 0)

  const clearFilters = () => {
    setSearchInput('')
    setClientFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setArchiveFilter('active')
  }

  const hasActiveFilters =
    !!searchInput.trim() ||
    !!clientFilter.trim() ||
    !!statusFilter ||
    !!dateFrom ||
    !!dateTo ||
    archiveFilter !== 'active'

  return (
    <PageShell title="Quotations">
      <div className="mb-4 space-y-3 rounded-xl border border-surface-border bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-surface-muted" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search quote, enquiry, client, or item…"
            className="h-10 border-[#E2E6DC] pl-9 text-[13px]"
            aria-label="Search quotations"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label htmlFor="qf-client" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              Client name
            </label>
            <Input
              id="qf-client"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder="Filter by client…"
              className="h-9 border-[#E2E6DC] text-[13px]"
            />
          </div>
          <div className="w-full min-w-[140px] sm:w-40">
            <label htmlFor="qf-status" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              Status
            </label>
            <select
              id="qf-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-[#E2E6DC] bg-white px-2 text-[13px] text-gray-900"
            >
              <option value="">All statuses</option>
              {QUOTATION_CRM_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {QUOTATION_CRM_LABELS[v as QuotationCrmStatus]}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full min-w-[130px] sm:w-36">
            <label htmlFor="qf-from" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              From date
            </label>
            <Input
              id="qf-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 border-[#E2E6DC] text-[13px]"
            />
          </div>
          <div className="w-full min-w-[130px] sm:w-36">
            <label htmlFor="qf-to" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              To date
            </label>
            <Input
              id="qf-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 border-[#E2E6DC] text-[13px]"
            />
          </div>
          <div className="w-full min-w-[130px] sm:w-36">
            <label htmlFor="qf-archive" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              Records
            </label>
            <select
              id="qf-archive"
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)}
              className="h-9 w-full rounded-md border border-[#E2E6DC] bg-white px-2 text-[13px] text-gray-900"
            >
              {ARCHIVE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" className="h-9 text-[12px]" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1680px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                <th className="min-w-[120px] whitespace-nowrap px-3 py-3">Quote / Enq</th>
                <th className="min-w-[72px] whitespace-nowrap px-3 py-3">Date</th>
                <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Client</th>
                <th className="min-w-[130px] whitespace-nowrap px-3 py-3">Category / Sub-Category</th>
                <th className="min-w-[160px] whitespace-nowrap px-3 py-3">Item Description</th>
                <th className="min-w-[88px] whitespace-nowrap px-3 py-3 text-right">Quote ₹</th>
                <th className="min-w-[72px] whitespace-nowrap px-3 py-3 text-right">PO ₹</th>
                <th className="min-w-[120px] whitespace-nowrap px-3 py-3">Ongoing</th>
                <th className="min-w-[120px] whitespace-nowrap px-3 py-3">PO received</th>
                <th className="min-w-[100px] whitespace-nowrap px-3 py-3">Lost</th>
                <th className="min-w-[96px] whitespace-nowrap px-3 py-3">Validity</th>
                <th className="min-w-[110px] whitespace-nowrap px-3 py-3">Next follow-up</th>
                <th className="min-w-[88px] whitespace-nowrap px-3 py-3">User</th>
                <th className="min-w-[72px] whitespace-nowrap px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            {isPending ? (
              <TableSkeletonRows />
            ) : list.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={COL_COUNT} className="p-0">
                    <EmptyState
                      icon={FileText}
                      title={hasActiveFilters ? 'No matching quotations' : 'No quotations yet'}
                      description={
                        hasActiveFilters
                          ? 'Try adjusting search or filters.'
                          : 'Generated quotations will appear here once enquiries are quoted.'
                      }
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {list.map((q) => (
                  <tr
                    key={q.quotation_id}
                    className={cn(
                      'border-b border-[#E2E6DC] text-[13px] transition-colors',
                      archivedListingRowClass(q.is_archived),
                    )}
                  >
                    <td className="px-3 py-3 align-top">
                      <Link
                        href={`/quotations/${q.quotation_id}`}
                        className="font-mono text-brand-gold-500 hover:underline"
                      >
                        {q.quote_number}
                      </Link>
                      {q.enquiry_number ? (
                        <p className="mt-0.5 font-mono text-[12px] text-surface-muted">
                          <span className="mr-0.5 text-[#B0B8AD]" aria-hidden>
                            ↳
                          </span>
                          {q.enquiry_number}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-gray-900">
                      {formatQuotationListDate(q.created_at)}
                    </td>
                    <td className="px-3 py-3 align-top text-gray-900">
                      <span className="font-medium">{q.client_name}</span>
                      {q.client_company && (
                        <span className="mt-0.5 block text-[12px] text-surface-muted">{q.client_company}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-gray-900">
                      <ListingCategoryCell
                        lines={q.category_lines}
                        category={q.category_label || q.primary_category}
                        subCategory={q.sub_category}
                      />
                    </td>
                    <td className="max-w-[220px] px-3 py-3 align-top">
                      <ListingItemDescriptionsCell
                        lines={q.item_desc_lines}
                        fallbackShort={q.item_desc_short}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-right font-mono text-brand-green-600">
                      {formatCurrency(q.total_amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-right font-mono text-gray-900">
                      {q.po_total_amount != null && q.po_total_amount > 0
                        ? formatCurrency(q.po_total_amount)
                        : '—'}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationLineStatusCell q={q} status="ongoing" />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationLineStatusCell q={q} status="po_received" />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationLineStatusCell q={q} status="lost" />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationListDateEditor
                        quotationId={q.quotation_id}
                        field="validity_date"
                        value={q.validity_date}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationListDateEditor
                        quotationId={q.quotation_id}
                        field="next_follow_up_date"
                        value={q.next_follow_up_date}
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-[12px] text-surface-muted">
                      {q.created_by_name || '—'}
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      {canArchive && !q.is_archived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[12px] text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => {
                            setArchiveError(null)
                            setArchiveTarget(q)
                          }}
                          aria-label={`Archive ${q.quote_number}`}
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
        {!isPending && allRows.length > 0 && (
          <div className="border-t border-[#E2E6DC] bg-[#F9FAF7] px-4 py-3">
            {list.length === 0 ? (
              <p className="text-[13px] text-surface-muted">
                No rows match your filters ({allRows.length} quotation{allRows.length === 1 ? '' : 's'} loaded).
              </p>
            ) : (
              <p className="font-mono text-[13px] text-brand-green-600">
                Showing {list.length}
                {list.length !== allRows.length ? ` of ${allRows.length}` : ''} quotation{list.length === 1 ? '' : 's'} —
                Total value: {formatCurrency(totalValue)}
              </p>
            )}
            {allRows.length >= LISTING_FETCH_LIMIT && (
              <p className="mt-1 text-[11px] text-surface-muted">
                Search and filters run instantly on the {LISTING_FETCH_LIMIT} most recent quotations.
              </p>
            )}
          </div>
        )}
      </div>

      <ArchiveRecordDialog
        open={archiveTarget != null}
        onOpenChange={(next) => {
          if (!next && !archiveMut.isPending) {
            setArchiveTarget(null)
            setArchiveError(null)
          }
        }}
        title="Archive quotation?"
        description={
          archiveTarget ? (
            <>
              <span className="font-medium text-gray-900">{archiveTarget.quote_number}</span> for{' '}
              <span className="font-medium text-gray-900">{archiveTarget.client_name}</span> will be
              archived. It will be hidden from analytics and dashboards but remains viewable in the
              archived list.
            </>
          ) : (
            'This quotation will be archived.'
          )
        }
        busy={archiveMut.isPending}
        error={archiveError}
        onConfirm={() => {
          if (!archiveTarget) return
          archiveMut.mutate(archiveTarget.quotation_id)
        }}
      />
    </PageShell>
  )
}
