'use client'

import { ChevronRight, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Fragment, useMemo, useState } from 'react'

import { formatCompactINR } from '@/lib/formatCompactINR'
import { cn } from '@/lib/utils'
import { usePipelineMonthEnquiries } from '@/lib/queries'
import type { PipelineRegisterResponse } from '@/lib/api'

function convHeatmapClass(pct: number, min: number, max: number): string {
  if (max <= min) return 'bg-emerald-100 text-emerald-900'
  const t = (pct - min) / (max - min)
  if (t < 0.34) return 'bg-red-100 text-red-900'
  if (t < 0.67) return 'bg-amber-100 text-amber-900'
  return 'bg-emerald-200 text-emerald-950'
}

function formatCount(n: number): string {
  return n.toLocaleString('en-IN')
}

type DrillDownProps = {
  year: number
  month: number
  monthLabel: string
  userId?: string
  onClose: () => void
}

function PipelineMonthDrillDown({ year, month, monthLabel, userId, onClose }: DrillDownProps) {
  const router = useRouter()
  const { data, isPending, isError } = usePipelineMonthEnquiries(year, month, userId)

  return (
    <div className="border-t border-[#E2E6DC] bg-[#FAF8F4]/80 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-gray-800">
          Enquiries — {monthLabel} ({data?.count ?? '…'})
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-surface-muted hover:bg-white hover:text-gray-800"
        >
          <X className="size-3.5" aria-hidden />
          Close
        </button>
      </div>

      {isPending && (
        <p className="py-4 text-center text-[12px] text-surface-muted">Loading enquiries…</p>
      )}

      {isError && (
        <p className="py-4 text-center text-[12px] text-red-700">Could not load enquiries for this month.</p>
      )}

      {data && data.items.length === 0 && !isPending && (
        <p className="py-4 text-center text-[12px] text-surface-muted">No enquiries in this month.</p>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#ECEEE8] bg-white">
          <table className="w-full min-w-[480px] text-[12px]">
            <thead>
              <tr className="border-b border-[#ECEEE8] bg-[#F7F8F5] text-left text-[10px] font-semibold uppercase tracking-wide text-surface-muted">
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Quoted</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.enquiry_id}
                  className="cursor-pointer border-b border-[#F3F4F0] last:border-0 hover:bg-[#FAF8F4]"
                  onClick={() => router.push(`/enquiries/${item.enquiry_id}`)}
                >
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-gray-900">{item.subject}</td>
                  <td className="px-3 py-2 capitalize text-surface-muted">{item.status.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-800">
                    {item.quoted_value != null ? formatCompactINR(item.quoted_value) : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-surface-muted">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type Props = {
  data: PipelineRegisterResponse
  userId?: string
  className?: string
}

export default function PipelineRegister({ data, userId, className }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const convRange = data.conversion_range
  const monthlyRows = useMemo(() => data.rows.filter((r) => !r.is_total), [data.rows])
  const totalRow = data.rows.find((r) => r.is_total)

  function toggleRow(rowKey: string, isTotal: boolean) {
    if (isTotal) return
    setExpandedKey((prev) => (prev === rowKey ? null : rowKey))
  }

  return (
    <section
      className={cn(
        'mt-4 rounded-xl border border-[#E2E6DC] bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-[#E2E6DC] px-4 py-3 sm:px-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Pipeline register ({data.fy_label})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#F7F8F5]">
            <tr className="border-b border-[#E2E6DC] text-left text-[10px] font-semibold uppercase tracking-wide text-surface-muted">
              <th className="w-8 px-2 py-2.5" aria-hidden />
              <th className="px-3 py-2.5">Month</th>
              <th className="px-3 py-2.5 text-right">Enq (nos)</th>
              <th className="px-3 py-2.5 text-right">Qtd nos</th>
              <th className="px-3 py-2.5 text-right">Qtd ₹</th>
              <th className="px-3 py-2.5 text-right">PO nos</th>
              <th className="px-3 py-2.5 text-right">PO ₹</th>
              <th className="px-3 py-2.5 text-right">Conv %</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map((row, idx) => {
              const isExpanded = expandedKey === row.row_key
              return (
                <Fragment key={row.row_key}>
                  <tr
                    className={cn(
                      'border-b border-[#ECEEE8] transition-colors',
                      idx % 2 === 1 && 'bg-[#FAFAF8]',
                      !row.is_total && 'cursor-pointer hover:bg-[#F0F7F2]',
                      isExpanded && 'bg-[#F0F7F2]',
                    )}
                    onClick={() => toggleRow(row.row_key, row.is_total)}
                  >
                    <td className="px-2 py-2.5 text-surface-muted">
                      <ChevronRight
                        className={cn('size-4 transition-transform', isExpanded && 'rotate-90')}
                        aria-hidden
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.month_label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(row.enquiry_count)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(row.quote_count)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {formatCompactINR(row.quoted_value)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(row.po_count)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {formatCompactINR(row.po_value)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          'inline-flex min-w-[3rem] justify-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums',
                          convHeatmapClass(row.conversion_pct, convRange.min, convRange.max),
                        )}
                      >
                        {row.conversion_pct}%
                      </span>
                    </td>
                  </tr>
                  {isExpanded && row.year != null && row.month != null && (
                    <tr key={`${row.row_key}-drill`}>
                      <td colSpan={8} className="p-0">
                        <PipelineMonthDrillDown
                          year={row.year}
                          month={row.month}
                          monthLabel={row.month_label}
                          userId={userId}
                          onClose={() => setExpandedKey(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}

            {totalRow && (
              <tr className="border-t-2 border-[#D8DDD3] bg-[#F3F5F0] font-semibold text-gray-900">
                <td className="px-2 py-3" />
                <td className="px-3 py-3">{totalRow.month_label}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCount(totalRow.enquiry_count)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCount(totalRow.quote_count)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCompactINR(totalRow.quoted_value)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCount(totalRow.po_count)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCompactINR(totalRow.po_value)}</td>
                <td className="px-3 py-3 text-right">
                  <span
                    className={cn(
                      'inline-flex min-w-[3rem] justify-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums',
                      convHeatmapClass(totalRow.conversion_pct, convRange.min, convRange.max),
                    )}
                  >
                    {totalRow.conversion_pct}%
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[#ECEEE8] px-4 py-2.5 text-[11px] text-surface-muted sm:px-5">
        Conv % = PO value ÷ quoted value (cohort basis) · click a row to drill into enquiries
      </p>
    </section>
  )
}
