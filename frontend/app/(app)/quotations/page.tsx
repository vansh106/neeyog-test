'use client'

import Link from 'next/link'
import { Download, Eye, FileText } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { useQuotations } from '@/lib/queries'
import { quotationsApi } from '@/lib/api'
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
            <Skeleton className="h-5 w-16 rounded-full" />
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

export default function QuotationsPage() {
  const { data: quotations, isPending } = useQuotations()
  const list: QuotationListItem[] = quotations ?? []
  const totalValue = list.reduce((sum, q) => sum + q.total_amount, 0)

  return (
    <PageShell title="Quotations">
      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F5F0] text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
                <th className="px-4 py-3">Quote Number</th>
                <th className="px-4 py-3">Client Name</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3">Status</th>
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
                      title="No quotations yet"
                      description="Generated quotations will appear here once enquiries are quoted."
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
                    <td className="px-4 py-3">
                      <Link
                        href={`/quotations/${q.quotation_id}`}
                        className="font-mono text-brand-gold-500 hover:underline"
                      >
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{q.client_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-brand-green-600">
                      {formatCurrency(q.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-surface-muted">{formatRelativeTime(q.created_at)}</td>
                    <td className="px-4 py-3">
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
                        <a
                          href={quotationsApi.getPdfUrl(q.quotation_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'inline-flex h-7 gap-1 text-[12px]',
                          )}
                        >
                          <Download className="size-3.5" />
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!isPending && list.length > 0 && (
          <div className="border-t border-[#E2E6DC] bg-[#F9FAF7] px-4 py-3">
            <p className="font-mono text-[13px] text-brand-green-600">
              Showing {list.length} quotation{list.length === 1 ? '' : 's'} — Total value:{' '}
              {formatCurrency(totalValue)}
            </p>
          </div>
        )}
      </div>
    </PageShell>
  )
}
