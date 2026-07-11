'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Loader2,
  Scale,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import DashboardKpiCard from '@/components/dashboard/DashboardKpiCard'
import LostQuoteReasonChart from '@/components/dashboard/LostQuoteReasonChart'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { WinLossAnalysisRow } from '@/lib/api'
import {
  computeWinLossSummary,
  exportWinLossAnalysisReport,
  type WinLossAnalysisExportFormat,
} from '@/lib/exportWinLossAnalysisReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { cn, formatCurrency } from '@/lib/utils'

type OutcomeFilter = 'all' | 'won' | 'lost'

type SortKey =
  | 'customer_name'
  | 'product'
  | 'quoted_value'
  | 'outcome'
  | 'loss_reason'
  | 'salesperson'

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className="size-3 text-emerald-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-emerald-700" aria-hidden />
  )
}

function sortRows(rows: WinLossAnalysisRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'quoted_value') return (a.quoted_value - b.quoted_value) * factor
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function WinLossAnalysisReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.win_loss_analysis
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [lossReasonFilter, setLossReasonFilter] = useState('__all__')
  const [salespersonId, setSalespersonId] = useState('__all__')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [sortKey, setSortKey] = useState<SortKey>('quoted_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const ownerOptions = useMemo(() => {
    if (!data) return []
    const seen = new Map<string, string>()
    for (const row of data.rows) {
      const id = row.salesperson_id ?? '__unassigned__'
      if (!seen.has(id)) seen.set(id, row.salesperson)
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((row) => {
      if (outcomeFilter !== 'all' && row.outcome !== outcomeFilter) return false
      if (lossReasonFilter !== '__all__') {
        if (row.outcome !== 'lost') return false
        if ((row.loss_reason ?? 'Unspecified') !== lossReasonFilter) return false
      }
      if (salespersonId !== '__all__') {
        const rowId = row.salesperson_id ?? '__unassigned__'
        if (rowId !== salespersonId) return false
      }
      if (categoryFilter !== '__all__' && row.category !== categoryFilter) return false
      return true
    })
  }, [data, outcomeFilter, lossReasonFilter, salespersonId, categoryFilter])

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  )

  const summary = useMemo(() => computeWinLossSummary(filteredRows), [filteredRows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'quoted_value' ? 'desc' : 'asc')
    }
  }

  async function handleExport(format: WinLossAnalysisExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportWinLossAnalysisReport(data, sortedRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  const sortableHead = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
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
    <section className="space-y-4">
      <div className="rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-[#E2E6DC] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#EEF0EA] text-gray-700">
              <Scale className="size-3.5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Win/Loss Analysis</h2>
              <p className="text-[11px] text-surface-muted">
                Resolved quotes only (Won / Lost) · {data?.scope_label ?? '…'}
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

        <div className="flex flex-wrap items-end gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Outcome</span>
            <Select value={outcomeFilter} onValueChange={(v) => setOutcomeFilter((v as OutcomeFilter) ?? 'all')}>
              <SelectTrigger className="h-8 w-[120px] bg-white text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Loss reason</span>
            <Select value={lossReasonFilter} onValueChange={(v) => setLossReasonFilter(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[160px] bg-white text-[12px]">
                <SelectValue placeholder="All reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All reasons</SelectItem>
                {(data?.loss_reason_categories ?? []).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Salesperson</span>
            <Select value={salespersonId} onValueChange={(v) => setSalespersonId(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {ownerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Category</span>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {(data?.categories ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-[13px] text-red-700">
          {error instanceof Error ? error.message : 'Could not load report.'}
        </div>
      )}

      {isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {data && !isPending && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <DashboardKpiCard
              title="Total quoted"
              primaryValue={formatCompactINR(summary.total_quoted_value)}
              secondaryText={`${summary.total_quoted_count} quotes`}
            />
            <DashboardKpiCard
              title="Total won"
              primaryValue={formatCompactINR(summary.total_won_value)}
              secondaryText={`${summary.total_won_count} quotes`}
            />
            <DashboardKpiCard
              title="Total lost"
              primaryValue={formatCompactINR(summary.total_lost_value)}
              secondaryText={`${summary.total_lost_count} quotes`}
            />
            <DashboardKpiCard
              title="Win rate (value)"
              primaryValue={`${summary.win_rate_value_pct}%`}
              secondaryText="PO value ÷ quoted"
            />
            <DashboardKpiCard
              title="Win rate (count)"
              primaryValue={`${summary.win_rate_count_pct}%`}
              secondaryText="Won ÷ resolved"
            />
            <DashboardKpiCard
              title="Top loss reason"
              primaryValue={summary.top_loss_reason ?? '—'}
              secondaryText={
                summary.top_loss_reason
                  ? `${summary.top_loss_reason_count} lost quote${summary.top_loss_reason_count === 1 ? '' : 's'}`
                  : 'No losses in view'
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <LostQuoteReasonChart data={summary.loss_reason_breakdown} className="h-full" />

            <div className="rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
              <div className="border-b border-[#E2E6DC] px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-gray-900">Drill-down register</h3>
                <p className="text-[11px] text-surface-muted">
                  {sortedRows.length.toLocaleString('en-IN')} rows · sorted by quoted value
                </p>
              </div>
              <div className="max-h-[min(60vh,560px)] overflow-auto">
                <table className="w-full min-w-[720px] border-collapse text-[12px]">
                  <thead className="sticky top-0 z-10 bg-[#F3F4F0] shadow-[0_1px_0_#E2E6DC]">
                    <tr className="border-b border-[#E2E6DC]">
                      {sortableHead('Customer', 'customer_name')}
                      {sortableHead('Product', 'product')}
                      {sortableHead('Value', 'quoted_value', 'right')}
                      {sortableHead('Outcome', 'outcome')}
                      {sortableHead('Loss reason', 'loss_reason')}
                      {sortableHead('Salesperson', 'salesperson')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-surface-muted">
                          No won or lost quotes match the current filters.
                        </td>
                      </tr>
                    )}
                    {sortedRows.map((row) => (
                      <tr key={row.quotation_id} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                        <td
                          className="max-w-[160px] truncate px-2 py-1.5 font-medium text-gray-900"
                          title={row.customer_name}
                        >
                          {row.customer_name}
                        </td>
                        <td className="max-w-[200px] truncate px-2 py-1.5 text-gray-700" title={row.product}>
                          {row.product}
                        </td>
                        <td
                          className="px-2 py-1.5 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap"
                          title={formatCurrency(row.quoted_value)}
                        >
                          {formatCompactINR(row.quoted_value)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold',
                              row.outcome === 'won'
                                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
                                : 'bg-red-100 text-red-800 ring-1 ring-red-200/80',
                            )}
                          >
                            {row.outcome === 'won' ? 'Won' : 'Lost'}
                          </span>
                        </td>
                        <td
                          className="max-w-[140px] truncate px-2 py-1.5 text-gray-700"
                          title={row.loss_reason_raw ?? undefined}
                        >
                          {row.outcome === 'lost' ? row.loss_reason ?? 'Unspecified' : '—'}
                        </td>
                        <td
                          className="max-w-[120px] truncate px-2 py-1.5 text-gray-700"
                          title={row.salesperson}
                        >
                          {row.salesperson}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
