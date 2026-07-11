'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Flag,
  Loader2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import DashboardKpiCard from '@/components/dashboard/DashboardKpiCard'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AvgPoValueDimension, AvgPoValueRow } from '@/lib/api'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import {
  exportAvgPoValueReport,
  type AvgPoValueExportFormat,
} from '@/lib/exportAvgPoValueReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'dimension_name'
  | 'po_count'
  | 'total_po_value'
  | 'avg_po_value'
  | 'min_po_value'
  | 'max_po_value'
  | 'value_range'

type SortDir = 'asc' | 'desc'

const DIMENSION_LABELS: Record<AvgPoValueDimension, string> = {
  customer: 'By Customer',
  product: 'By Product',
  category: 'By Category',
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className="size-3 text-emerald-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-emerald-700" aria-hidden />
  )
}

function sortRows(rows: AvgPoValueRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'dimension_name') {
      return a.dimension_name.localeCompare(b.dimension_name, undefined, { sensitivity: 'base' }) * factor
    }
    return (a[sortKey] - b[sortKey]) * factor
  })
}

export default function AvgPoValueReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.avg_po_value
  const [dimension, setDimension] = useState<AvgPoValueDimension>('customer')
  const [sortKey, setSortKey] = useState<SortKey>('avg_po_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const block = data?.dimensions[dimension]
  const sortedRows = useMemo(
    () => sortRows(block?.rows ?? [], sortKey, sortDir),
    [block?.rows, sortKey, sortDir],
  )
  const summary = block?.summary

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'dimension_name' ? 'asc' : 'desc')
    }
  }

  async function handleExport(format: AvgPoValueExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportAvgPoValueReport(data, sortedRows, dimension, format)
    } finally {
      setExportBusy(false)
    }
  }

  function sortableHead(label: string, key: SortKey, align: 'left' | 'right' = 'right') {
    return (
      <th className={cn('px-2 py-2', align === 'right' ? 'text-right' : 'text-left')}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 font-semibold uppercase tracking-wide',
            align === 'right' && 'ml-auto',
          )}
          onClick={() => toggleSort(key)}
        >
          {label}
          <SortIcon active={sortKey === key} dir={sortDir} />
        </button>
      </th>
    )
  }

  if (isError) {
    return <p className="px-4 py-6 text-[13px] text-red-600">{error?.message ?? 'Failed to load report'}</p>
  }

  return (
    <PermissionGate permission={Permissions.REPORTS_VIEW}>
      <div className="rounded-xl border border-[#E2E6DC] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E6DC] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Avg PO Value</h2>
            <p className="text-[12px] text-surface-muted">
              Average order value by customer, product, or Masters category
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E2E6DC] bg-white px-3 text-[12px] font-medium hover:bg-[#FAFAF8]"
              disabled={exportBusy || !data || sortedRows.length === 0}
            >
              {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('xlsx')}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="border-b border-[#E2E6DC] px-4 py-3">
          <Tabs value={dimension} onValueChange={(v) => setDimension(v as AvgPoValueDimension)}>
            <TabsList className="h-9 bg-[#F3F4F0]">
              {(Object.keys(DIMENSION_LABELS) as AvgPoValueDimension[]).map((d) => (
                <TabsTrigger key={d} value={d} className="text-[12px]">
                  {DIMENSION_LABELS[d]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {summary && !isPending && (
          <div className="grid gap-3 border-b border-[#E2E6DC] p-4 sm:grid-cols-3">
            <DashboardKpiCard
              title="Overall avg PO value"
              primaryValue={formatCurrency(summary.overall_avg_po_value)}
            />
            <DashboardKpiCard
              title="Total PO count"
              primaryValue={summary.total_po_count.toLocaleString('en-IN')}
            />
            <DashboardKpiCard
              title="Total won value"
              primaryValue={formatCompactINR(summary.total_won_value)}
              secondaryText={formatCurrency(summary.total_won_value)}
            />
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
            <table className="w-full min-w-[880px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#F3F4F0]">
                <tr className="border-b border-[#E2E6DC]">
                  {sortableHead('Name', 'dimension_name', 'left')}
                  {sortableHead('PO count', 'po_count')}
                  {sortableHead('Total value', 'total_po_value')}
                  {sortableHead('Avg value', 'avg_po_value')}
                  {sortableHead('Min', 'min_po_value')}
                  {sortableHead('Max', 'max_po_value')}
                  {sortableHead('Range', 'value_range')}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-surface-muted">
                      No purchase orders in this period.
                    </td>
                  </tr>
                )}
                {sortedRows.map((row) => (
                  <tr
                    key={row.dimension_name}
                    className={cn(
                      'border-b border-[#F0F1ED] hover:bg-[#F8F9F6]',
                      row.outlier === 'high' && 'bg-emerald-50/50',
                      row.outlier === 'low' && 'bg-amber-50/40',
                    )}
                  >
                    <td className="max-w-[220px] px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                        {row.outlier === 'high' && (
                          <Flag className="size-3 shrink-0 text-emerald-600" aria-label="High avg outlier" />
                        )}
                        {row.outlier === 'low' && (
                          <Flag className="size-3 shrink-0 text-amber-600" aria-label="Low avg outlier" />
                        )}
                        <span className="truncate" title={row.dimension_name}>
                          {row.dimension_name}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.po_count.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" title={formatCurrency(row.total_po_value)}>
                      {formatCompactINR(row.total_po_value)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="relative min-w-[100px] overflow-hidden rounded-md border border-[#ECEEE8] px-2 py-1">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500/15"
                          style={{ width: `${Math.max(row.avg_bar_pct, 4)}%` }}
                          aria-hidden
                        />
                        <span className="relative font-mono font-medium tabular-nums text-gray-900">
                          {formatCompactINR(row.avg_po_value)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-surface-muted">
                      {formatCompactINR(row.min_po_value)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-surface-muted">
                      {formatCompactINR(row.max_po_value)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCompactINR(row.value_range)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isFetching && !isPending && (
          <p className="border-t border-[#E2E6DC] px-4 py-2 text-[11px] text-emerald-700">Refreshing…</p>
        )}
      </div>
    </PermissionGate>
  )
}
