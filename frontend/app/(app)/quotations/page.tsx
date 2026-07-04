'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, FileText } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import ArchiveRecordDialog from '@/components/listing/ArchiveRecordDialog'
import QuotationLineStatusColumn from '@/components/quotations/QuotationLineStatusColumn'
import QuotationListingFilters from '@/components/quotations/QuotationListingFilters'
import ListingItemDescriptionsCell from '@/components/listing/ListingItemDescriptionsCell'
import ListingCategoryCell from '@/components/listing/ListingCategoryCell'
import ListingPagination from '@/components/listing/ListingPagination'
import QuotationListDateEditor, {
  formatQuotationListDate,
} from '@/components/quotations/QuotationListDateEditor'
import { useQuotationsListingDataset } from '@/lib/queries'
import {
  collectQuotationFilterOptions,
  DEFAULT_QUOTATION_FILTERS,
  filterQuotationsLocal,
  quotationFiltersActive,
  quotationPoBounds,
  type LocalQuotationFilters,
} from '@/lib/filterQuotationsLocal'
import { archivedListingRowClass } from '@/lib/archiveFilter'
import { quotationsApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import { listingPageSlice, listingSerialNumber } from '@/lib/listingPagination'
import type { QuotationListItem } from '@/types'

const COL_COUNT = 12

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
  const [filters, setFilters] = useState<LocalQuotationFilters>(DEFAULT_QUOTATION_FILTERS)
  const [archiveTarget, setArchiveTarget] = useState<QuotationListItem | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: quotations, isPending } = useQuotationsListingDataset(LISTING_FETCH_LIMIT)
  const allRows: QuotationListItem[] = quotations ?? []

  const poBounds = useMemo(() => quotationPoBounds(allRows), [allRows])
  const filterOptions = useMemo(() => collectQuotationFilterOptions(allRows), [allRows])

  useEffect(() => {
    setFilters((prev) => {
      if (prev.poBoundsMin === poBounds.min && prev.poBoundsMax === poBounds.max) return prev
      return {
        ...prev,
        poBoundsMin: poBounds.min,
        poBoundsMax: poBounds.max,
        poAmountMin: poBounds.min,
        poAmountMax: poBounds.max,
      }
    })
  }, [poBounds.min, poBounds.max])

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

  const list = useMemo(() => filterQuotationsLocal(allRows, filters), [allRows, filters])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const pagedList = useMemo(() => listingPageSlice(list, page), [list, page])
  const totalValue = list.reduce((sum, q) => sum + (q.subtotal ?? q.total_amount), 0)

  const clearFilters = () => {
    setFilters({
      ...DEFAULT_QUOTATION_FILTERS,
      poBoundsMin: poBounds.min,
      poBoundsMax: poBounds.max,
      poAmountMin: poBounds.min,
      poAmountMax: poBounds.max,
    })
  }

  const hasActiveFilters = quotationFiltersActive(filters)

  return (
    <PageShell title="Quotations">
      <QuotationListingFilters
        filters={filters}
        onChange={setFilters}
        categoryOptions={filterOptions.categories}
        userOptions={filterOptions.users}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1420px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                <th className="min-w-[44px] whitespace-nowrap px-3 py-3">S.No.</th>
                <th className="min-w-[120px] whitespace-nowrap px-3 py-3">Quote / Enq</th>
                <th className="min-w-[72px] whitespace-nowrap px-3 py-3">Date</th>
                <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Client</th>
                <th className="min-w-[130px] whitespace-nowrap px-3 py-3">Category / Sub-Category</th>
                <th className="min-w-[160px] whitespace-nowrap px-3 py-3">Item Description</th>
                <th className="min-w-[88px] whitespace-nowrap px-3 py-3 text-right">Quote ₹</th>
                <th className="min-w-[72px] whitespace-nowrap px-3 py-3 text-right">PO ₹</th>
                <th className="min-w-[140px] whitespace-nowrap px-3 py-3">Status</th>
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
                {pagedList.map((q, index) => (
                  <tr
                    key={q.quotation_id}
                    className={cn(
                      'border-b border-[#E2E6DC] text-[13px] transition-colors',
                      archivedListingRowClass(q.is_archived),
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-[13px] text-surface-muted">
                      {listingSerialNumber(page, index, undefined, list.length)}
                    </td>
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
                        descriptionLines={q.item_desc_lines}
                        fallbackDescShort={q.item_desc_short}
                      />
                    </td>
                    <td className="max-w-[220px] px-3 py-3 align-top">
                      <ListingItemDescriptionsCell
                        lines={q.item_desc_lines}
                        fallbackShort={q.item_desc_short}
                        categoryLines={q.category_lines}
                        category={q.category_label || q.primary_category}
                        subCategory={q.sub_category}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-right font-mono text-brand-green-600">
                      {formatCurrency(q.subtotal ?? q.total_amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-right font-mono text-gray-900">
                      {q.po_total_amount != null && q.po_total_amount > 0
                        ? formatCurrency(q.po_total_amount)
                        : '—'}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationLineStatusColumn q={q} />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <QuotationListDateEditor
                        quotationId={q.quotation_id}
                        field="next_follow_up_date"
                        value={q.next_follow_up_date}
                        note={q.next_follow_up_note}
                        history={q.follow_up_history}
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
          <div className="border-t border-[#E2E6DC] bg-[#F9FAF7]">
            {list.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-surface-muted">
                No rows match your filters ({allRows.length} quotation{allRows.length === 1 ? '' : 's'} loaded).
              </p>
            ) : (
              <p className="border-b border-[#ECEEE8] px-4 py-3 font-mono text-[13px] text-brand-green-600">
                {list.length} quotation{list.length === 1 ? '' : 's'}
                {list.length !== allRows.length ? ` of ${allRows.length} loaded` : ''} — Total value:{' '}
                {formatCurrency(totalValue)}
              </p>
            )}
            {list.length > 0 ? (
              <ListingPagination
                page={page}
                totalItems={list.length}
                onPageChange={setPage}
                className="border-t-0 bg-transparent"
              />
            ) : null}
            {allRows.length >= LISTING_FETCH_LIMIT && (
              <p className="px-4 pb-3 text-[11px] text-surface-muted">
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
