'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Download, Eye, FileText, Search } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import QuotationListStatusEditor from '@/components/quotations/QuotationListStatusEditor'
import { useQuotationsListingDataset } from '@/lib/queries'
import { downloadQuotationPdf } from '@/lib/api'
import { filterQuotationsLocal } from '@/lib/filterQuotationsLocal'
import {
  QUOTATION_CRM_LABELS,
  QUOTATION_CRM_STATUSES,
  type QuotationCrmStatus,
} from '@/lib/quotationCrmStatus'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { QuotationListItem } from '@/types'

function TableSkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2E6DC] bg-white">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-40" />
          </td>
          <td className="px-4 py-3 text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-16 rounded-md" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  )
}

const LISTING_FETCH_LIMIT = 2000

export default function QuotationsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: quotations, isPending } = useQuotationsListingDataset(LISTING_FETCH_LIMIT)
  const allRows: QuotationListItem[] = quotations ?? []

  const list = useMemo(
    () =>
      filterQuotationsLocal(allRows, {
        search: searchInput,
        clientName: clientFilter,
        status: statusFilter,
        dateFrom,
        dateTo,
      }),
    [allRows, searchInput, clientFilter, statusFilter, dateFrom, dateTo],
  )
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const totalValue = list.reduce((sum, q) => sum + q.total_amount, 0)

  const clearFilters = () => {
    setSearchInput('')
    setClientFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    !!searchInput.trim() ||
    !!clientFilter.trim() ||
    !!statusFilter ||
    !!dateFrom ||
    !!dateTo

  return (
    <PageShell title="Quotations">
      <div className="mb-4 space-y-3 rounded-xl border border-surface-border bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-surface-muted" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search quote number or client…"
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
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" className="h-9 text-[12px]" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                <th className="px-4 py-3">Quote Number</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 min-w-[200px]">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            {isPending ? (
              <TableSkeletonRows />
            ) : list.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={6} className="p-0">
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
                    className="border-b border-[#E2E6DC] bg-white text-[13px] transition-colors hover:bg-[#F4F5F0]"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/quotations/${q.quotation_id}`}
                        className="font-mono text-brand-gold-500 hover:underline"
                      >
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-900">
                      <span className="font-medium">{q.client_name}</span>
                      {q.client_company && (
                        <span className="mt-0.5 block text-[12px] text-surface-muted">{q.client_company}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-mono text-brand-green-600">
                      {formatCurrency(q.total_amount)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <QuotationListStatusEditor q={q} />
                    </td>
                    <td className="px-4 py-3 align-top text-surface-muted" title={q.created_at}>
                      {formatRelativeTime(q.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/quotations/${q.quotation_id}`}
                          aria-label="View quotation"
                          className={cn(
                            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                            'text-surface-muted',
                          )}
                        >
                          <Eye className="size-4" />
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pdfBusyId === q.quotation_id}
                          className="inline-flex h-7 gap-1 text-[12px]"
                          onClick={() => {
                            setPdfBusyId(q.quotation_id)
                            downloadQuotationPdf(q.quotation_id, `${q.quote_number}.pdf`)
                              .catch((e: unknown) => window.alert(e instanceof Error ? e.message : 'Download failed'))
                              .finally(() => setPdfBusyId(null))
                          }}
                        >
                          <Download className="size-3.5" />
                          {pdfBusyId === q.quotation_id ? '…' : 'PDF'}
                        </Button>
                      </div>
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
    </PageShell>
  )
}
