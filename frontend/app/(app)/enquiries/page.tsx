'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
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
import { useEnquiries, useQuotations } from '@/lib/queries'
import { erpExportUrl, quotationsApi } from '@/lib/api'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { EnquiryListItem, Quotation } from '@/types'

type Pipeline = 'all' | 'complete' | 'incomplete' | 'pending' | 'failed'

const PENDING_STATUSES = ['received', 'parsing', 'matching', 'quoting'] as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
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

const FLOW_OPTIONS = [
  { value: 'all', label: 'All flows' },
  { value: 'complete', label: 'Complete' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'ambiguous', label: 'Ambiguous' },
  { value: 'not_found', label: 'Not found' },
]

function buildTableParams(
  pipeline: Pipeline,
  statusSelect: string,
  flowSelect: string,
): { status?: string; flow_type?: string; limit?: number } {
  const p: { status?: string; flow_type?: string; limit?: number } = { limit: 200 }
  if (statusSelect !== 'all') p.status = statusSelect
  else if (pipeline === 'failed') p.status = 'failed'

  if (flowSelect !== 'all') p.flow_type = flowSelect
  else if (pipeline === 'complete') p.flow_type = 'complete'
  else if (pipeline === 'incomplete') p.flow_type = 'incomplete'

  return p
}

function TableSkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2E6DC] bg-white">
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
  const [pipeline, setPipeline] = useState<Pipeline>('all')
  const [statusSelect, setStatusSelect] = useState('all')
  const [flowSelect, setFlowSelect] = useState('all')

  const { data: countsData = [] } = useEnquiries({ limit: 500 })

  const tableParams = useMemo(
    () => buildTableParams(pipeline, statusSelect, flowSelect),
    [pipeline, statusSelect, flowSelect],
  )

  const { data: tableRaw, isPending } = useEnquiries(
    pipeline === 'pending' ? { limit: 300 } : tableParams,
  )

  const rows = useMemo(() => {
    let list = tableRaw ?? []
    if (pipeline === 'pending') {
      list = list.filter((e) =>
        (PENDING_STATUSES as readonly string[]).includes(e.status),
      )
      if (statusSelect !== 'all') list = list.filter((e) => e.status === statusSelect)
      if (flowSelect !== 'all') list = list.filter((e) => e.flow_type === flowSelect)
    }
    return list
  }, [tableRaw, pipeline, statusSelect, flowSelect])

  const chipCounts = useMemo(
    () => ({
      all: countsData.length,
      complete: countsData.filter((e) => e.flow_type === 'complete').length,
      incomplete: countsData.filter((e) => e.flow_type === 'incomplete').length,
      pending: countsData.filter((e) =>
        (PENDING_STATUSES as readonly string[]).includes(e.status),
      ).length,
      failed: countsData.filter((e) => e.status === 'failed').length,
    }),
    [countsData],
  )

  const { data: quotationRows = [] } = useQuotations({ limit: 100 })

  const detailQueries = useQueries({
    queries: quotationRows.map((q) => ({
      queryKey: ['quotation', q.quotation_id] as const,
      queryFn: () =>
        quotationsApi.getQuotation(q.quotation_id) as unknown as Promise<Quotation>,
      staleTime: 120_000,
    })),
  })

  const enquiryToQuotationId = useMemo(() => {
    const m = new Map<string, string>()
    detailQueries.forEach((q, i) => {
      const d = q.data
      const row = quotationRows[i]
      if (d?.enquiry_id && row) m.set(d.enquiry_id, row.quotation_id)
    })
    return m
  }, [detailQueries, quotationRows])

  const chips: { key: Pipeline; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'complete', label: 'Complete' },
    { key: 'incomplete', label: 'Incomplete' },
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' },
  ]

  const totalBadge = countsData.length

  return (
    <PageShell
      title="Enquiries"
      actions={
        <span className="rounded-full bg-brand-green-500/15 px-2.5 py-1 text-[12px] font-semibold text-brand-green-600 tabular-nums">
          {totalBadge}
        </span>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5 min-w-[160px]">
              <span className="text-[11px] font-medium text-surface-muted">Status</span>
              <Select
                value={statusSelect}
                onValueChange={(v) => setStatusSelect(v ?? 'all')}
              >
                <SelectTrigger className="h-9 w-full rounded-lg border border-[#E2E6DC] bg-white text-[13px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[160px]">
              <span className="text-[11px] font-medium text-surface-muted">Flow type</span>
              <Select
                value={flowSelect}
                onValueChange={(v) => setFlowSelect(v ?? 'all')}
              >
                <SelectTrigger className="h-9 w-full rounded-lg border border-[#E2E6DC] bg-white text-[13px]">
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
        </div>

        <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                  <th className="px-4 py-3">Enquiry ID</th>
                  <th className="px-4 py-3">Flow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              {isPending ? (
                <TableSkeletonRows />
              ) : rows.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState
                        icon={Inbox}
                        title="No enquiries found"
                        description="Try changing the filter or upload a new email"
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
                        <td className="px-4 py-3">
                          <StatusBadge status={e.flow_type} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="px-4 py-3 text-surface-muted">
                          {formatRelativeTime(e.created_at)}
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
