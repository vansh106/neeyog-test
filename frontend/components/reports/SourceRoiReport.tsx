'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Flag,
  Loader2,
  Radio,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { SourceRoiRow } from '@/lib/api'
import {
  exportSourceRoiReport,
  type SourceRoiExportFormat,
} from '@/lib/exportSourceRoiReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { metricMinMax, winRateHeatmapClass } from '@/lib/reportHeatmap'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'source_label'
  | 'enquiry_count'
  | 'quote_count'
  | 'quoted_value'
  | 'po_count'
  | 'won_value'
  | 'win_rate_pct'
  | 'revenue_share_pct'

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className="size-3 text-emerald-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-emerald-700" aria-hidden />
  )
}

function sortRows(rows: SourceRoiRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (typeof a[sortKey] === 'number' && typeof b[sortKey] === 'number') {
      return ((a[sortKey] as number) - (b[sortKey] as number)) * factor
    }
    return String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function SourceRoiReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.source_roi
  const [sortKey, setSortKey] = useState<SortKey>('won_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const sortedRows = useMemo(
    () => (data ? sortRows(data.rows, sortKey, sortDir) : []),
    [data, sortKey, sortDir],
  )

  const winRateRange = useMemo(() => metricMinMax(sortedRows, 'win_rate_pct'), [sortedRows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'source_label' ? 'asc' : 'desc')
    }
  }

  async function handleExport(format: SourceRoiExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportSourceRoiReport(data, sortedRows, format)
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
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#EEF0EA] text-gray-700">
            <Radio className="size-3.5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Source ROI Report</h2>
            <p className="text-[11px] text-surface-muted">
              Acquisition channel performance · {data?.scope_label ?? '…'}
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
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {data && !isPending && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#F3F4F0]">
              <tr className="border-b border-[#E2E6DC]">
                {sortableHead('Source', 'source_label', 'left')}
                {sortableHead('Enquiries', 'enquiry_count')}
                {sortableHead('Quotes', 'quote_count')}
                {sortableHead('Quoted ₹', 'quoted_value')}
                {sortableHead('POs', 'po_count')}
                {sortableHead('Won ₹', 'won_value')}
                {sortableHead('Win %', 'win_rate_pct')}
                {sortableHead('Revenue share', 'revenue_share_pct')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-surface-muted">
                    No channel activity in this period.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => (
                <tr
                  key={row.source_key}
                  className={cn(
                    'border-b border-[#F0F1ED] hover:bg-[#F8F9F6]',
                    row.is_highest_win_rate && 'bg-emerald-50/60',
                    row.is_lowest_win_rate && 'bg-red-50/50',
                  )}
                >
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                      {row.is_highest_win_rate && (
                        <Flag className="size-3 shrink-0 text-emerald-600" aria-label="Highest win rate" />
                      )}
                      {row.is_lowest_win_rate && (
                        <Flag className="size-3 shrink-0 text-red-500" aria-label="Lowest win rate" />
                      )}
                      {row.source_label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.enquiry_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.quote_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" title={formatCurrency(row.quoted_value)}>
                    {formatCompactINR(row.quoted_value)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.po_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium" title={formatCurrency(row.won_value)}>
                    {formatCompactINR(row.won_value)}
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
                  <td className="px-2 py-1.5">
                    <div className="relative min-w-[100px] overflow-hidden rounded-md border border-[#ECEEE8] px-2 py-1">
                      <div
                        className="absolute inset-y-0 left-0 opacity-15"
                        style={{
                          width: `${Math.max(row.revenue_share_pct, 2)}%`,
                          backgroundColor: row.bar_color,
                        }}
                        aria-hidden
                      />
                      <span className="relative tabular-nums font-semibold text-gray-900">
                        {row.revenue_share_pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {data.totals && sortedRows.length > 0 && (
              <tfoot className="border-t-2 border-[#D8DDD3] bg-[#F0F3EB] font-semibold text-gray-900">
                <tr>
                  <td className="px-2 py-2.5">{data.totals.source_label}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.enquiry_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.quote_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCompactINR(data.totals.quoted_value)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.po_count.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCompactINR(data.totals.won_value)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{data.totals.win_rate_pct}%</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
