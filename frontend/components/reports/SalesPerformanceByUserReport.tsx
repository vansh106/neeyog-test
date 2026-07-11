'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Loader2,
  Trophy,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { SalesPerformanceUserRow } from '@/lib/api'
import {
  exportSalesPerformanceReport,
  type SalesPerformanceExportFormat,
} from '@/lib/exportSalesPerformanceReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { formatResponseHours } from '@/lib/formatResponseHours'
import { Permissions } from '@/lib/permissions'
import { metricMinMax, responseTimeHeatmapClass, winRateHeatmapClass } from '@/lib/reportHeatmap'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'salesperson_name'
  | 'enquiry_count'
  | 'quote_count'
  | 'quoted_value'
  | 'po_count'
  | 'won_value'
  | 'win_rate_pct'
  | 'avg_response_hours'

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className="size-3 text-emerald-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-emerald-700" aria-hidden />
  )
}

function sortRows(rows: SalesPerformanceUserRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'avg_response_hours') {
      const av = a.avg_response_hours ?? (sortDir === 'asc' ? Infinity : -Infinity)
      const bv = b.avg_response_hours ?? (sortDir === 'asc' ? Infinity : -Infinity)
      return (av - bv) * factor
    }
    if (typeof a[sortKey] === 'number' && typeof b[sortKey] === 'number') {
      return ((a[sortKey] as number) - (b[sortKey] as number)) * factor
    }
    return String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, { sensitivity: 'base' }) * factor
  })
}

function rankLabel(rank: number): string {
  return `#${rank}`
}

function rankClass(rank: number): string {
  if (rank === 1) return 'text-amber-700 font-bold'
  if (rank === 2) return 'text-slate-600 font-semibold'
  if (rank === 3) return 'text-amber-900/80 font-semibold'
  return 'text-surface-muted font-medium'
}

export default function SalesPerformanceByUserReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.sales_performance_by_user
  const [sortKey, setSortKey] = useState<SortKey>('won_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const sortedRows = useMemo(
    () => (data ? sortRows(data.rows, sortKey, sortDir) : []),
    [data, sortKey, sortDir],
  )

  const maxWonValue = useMemo(
    () => Math.max(...sortedRows.map((r) => r.won_value), 0),
    [sortedRows],
  )

  const winRateRange = useMemo(() => metricMinMax(sortedRows, 'win_rate_pct'), [sortedRows])
  const responseRange = useMemo(() => metricMinMax(sortedRows, 'avg_response_hours'), [sortedRows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'salesperson_name' ? 'asc' : 'desc')
    }
  }

  async function handleExport(format: SalesPerformanceExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportSalesPerformanceReport(data, sortedRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  const sortableHead = (label: string, key: SortKey, align: 'left' | 'right' = 'right') => (
    <th
      className={cn(
        'cursor-pointer select-none px-2 py-2 font-semibold text-[10px] uppercase tracking-wide text-surface-muted transition-colors hover:bg-[#ECEEE8]',
        align === 'right' ? 'text-right' : 'text-left',
      )}
      onClick={() => toggleSort(key)}
    >
      <span className={cn('inline-flex items-center gap-0.5', align === 'right' && 'justify-end w-full')}>
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  )

  return (
    <section className="rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-[#E2E6DC] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#EEF0EA] text-amber-800">
            <Trophy className="size-3.5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Sales Performance by User</h2>
            <p className="text-[11px] text-surface-muted">
              Leaderboard · {data?.scope_label ?? '…'} · {data?.record_count ?? 0} salespeople
              {isFetching && !isPending && <span className="ml-1 text-emerald-700">↻</span>}
            </p>
          </div>
        </div>
        <PermissionGate permission={Permissions.REPORTS_EXPORT}>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg border border-input bg-transparent px-2.5 text-[12px] font-medium transition-colors hover:bg-muted disabled:opacity-50"
              disabled={!data || exportBusy || sortedRows.length === 0}
            >
              {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport('xlsx')}>Download Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('csv')}>Download CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PermissionGate>
      </header>

      {isError && (
        <div className="px-4 py-6 text-center text-[12px] text-red-700">
          {error instanceof Error ? error.message : 'Could not load report.'}
        </div>
      )}

      {isPending && (
        <div className="space-y-1 px-4 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {data && !isPending && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#F3F4F0]">
              <tr className="border-b border-[#E2E6DC]">
                <th className="w-10 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Rank</th>
                {sortableHead('Salesperson', 'salesperson_name', 'left')}
                {sortableHead('Enquiries', 'enquiry_count')}
                {sortableHead('Quotes', 'quote_count')}
                {sortableHead('Quoted ₹', 'quoted_value')}
                {sortableHead('POs', 'po_count')}
                {sortableHead('Won ₹', 'won_value', 'right')}
                {sortableHead('Win %', 'win_rate_pct')}
                {sortableHead('Avg response', 'avg_response_hours')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-surface-muted">
                    No sales activity in this period.
                  </td>
                </tr>
              )}
              {sortedRows.map((row, idx) => {
                const rank = idx + 1
                const barPct = maxWonValue > 0 ? (row.won_value / maxWonValue) * 100 : 0
                return (
                  <tr key={row.user_id} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                    <td className={cn('px-2 py-1.5 tabular-nums text-[11px]', rankClass(rank))}>
                      {rankLabel(rank)}
                    </td>
                    <td className="px-2 py-1.5 font-medium text-gray-900">{row.salesperson_name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.enquiry_count.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.quote_count.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" title={formatCurrency(row.quoted_value)}>
                      {formatCompactINR(row.quoted_value)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.po_count.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex min-w-[88px] flex-col items-end gap-0.5">
                        <span className="font-semibold tabular-nums text-gray-900" title={formatCurrency(row.won_value)}>
                          {formatCompactINR(row.won_value)}
                        </span>
                        <div className="h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-[#EEF1EA]">
                          <div
                            className="h-full rounded-full bg-[#2A6B3C] transition-all"
                            style={{ width: `${Math.max(barPct, row.won_value > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={cn(
                          'inline-flex min-w-[2.75rem] justify-center rounded px-1.5 py-0.5 tabular-nums text-[11px] font-semibold',
                          winRateHeatmapClass(row.win_rate_pct, winRateRange.min, winRateRange.max),
                        )}
                      >
                        {row.win_rate_pct}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {row.avg_response_hours != null ? (
                        <span
                          className={cn(
                            'inline-flex min-w-[2.5rem] justify-center rounded px-1.5 py-0.5 tabular-nums text-[11px] font-semibold',
                            responseTimeHeatmapClass(
                              row.avg_response_hours,
                              responseRange.min,
                              responseRange.max,
                            ),
                          )}
                        >
                          {formatResponseHours(row.avg_response_hours)}
                        </span>
                      ) : (
                        <span className="text-surface-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {data.totals && sortedRows.length > 0 && (
              <tfoot className="border-t-2 border-[#D8DDD3] bg-[#F0F3EB] font-semibold text-gray-900">
                <tr>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5">{data.totals.salesperson_name}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.enquiry_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.quote_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCompactINR(data.totals.quoted_value)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.po_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCompactINR(data.totals.won_value)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.win_rate_pct}%</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {data.totals.avg_response_hours != null
                      ? formatResponseHours(data.totals.avg_response_hours)
                      : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
