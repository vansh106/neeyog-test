'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Loader2,
  TrendingDown,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import LostQuoteReasonChart from '@/components/dashboard/LostQuoteReasonChart'
import { PermissionGate } from '@/components/auth/PermissionGate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { LostBusinessRow } from '@/lib/api'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import {
  exportLostBusinessReport,
  type LostBusinessExportFormat,
} from '@/lib/exportLostBusinessReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { lossReasonPillClass, STAGE_LOST_PILL } from '@/lib/lostBusiness'
import { Permissions } from '@/lib/permissions'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'quote_ref'
  | 'customer_name'
  | 'product'
  | 'quoted_value'
  | 'loss_date'
  | 'loss_reason'
  | 'salesperson'
  | 'stage_lost_at_label'

type SortDir = 'asc' | 'desc'

function formatListDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className="size-3 text-emerald-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-emerald-700" aria-hidden />
  )
}

function sortRows(rows: LostBusinessRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'quoted_value') return (a.quoted_value - b.quoted_value) * factor
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function LostBusinessReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.lost_business

  const [salespersonId, setSalespersonId] = useState('__all__')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [stageFilter, setStageFilter] = useState('__all__')
  const [lossReasonFilters, setLossReasonFilters] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('quoted_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((row) => {
      if (lossReasonFilters.size > 0) {
        const reason = row.loss_reason ?? 'Unspecified'
        if (!lossReasonFilters.has(reason)) return false
      }
      if (salespersonId !== '__all__') {
        const rowId = row.salesperson_id ?? '__unassigned__'
        if (rowId !== salespersonId) return false
      }
      if (categoryFilter !== '__all__' && row.category !== categoryFilter) return false
      if (stageFilter !== '__all__' && row.stage_lost_at_key !== stageFilter) return false
      return true
    })
  }, [data, lossReasonFilters, salespersonId, categoryFilter, stageFilter])

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  )

  const filteredBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of filteredRows) {
      const reason = row.loss_reason ?? 'Unspecified'
      counts[reason] = (counts[reason] ?? 0) + 1
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const maxCount = sorted[0]?.[1] ?? 0
    return {
      total: filteredRows.length,
      reasons: sorted.map(([reason, count]) => ({
        reason,
        count,
        is_top: count === maxCount && maxCount > 0,
        bar_width_pct: maxCount > 0 ? Math.round((count / maxCount) * 1000) / 10 : 0,
      })),
      insights: data?.loss_reason_breakdown.insights ?? [],
    }
  }, [filteredRows, data])

  const summary = useMemo(() => {
    const total = filteredRows.reduce((s, r) => s + r.quoted_value, 0)
    const reasonCounts: Record<string, number> = {}
    const reasonValues: Record<string, number> = {}
    for (const row of filteredRows) {
      const reason = row.loss_reason ?? 'Unspecified'
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
      reasonValues[reason] = (reasonValues[reason] ?? 0) + row.quoted_value
    }
    const topCount = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]
    const topValue = Object.entries(reasonValues).sort((a, b) => b[1] - a[1])[0]
    return {
      total_lost_value: Math.round(total * 100) / 100,
      loss_count: filteredRows.length,
      avg_deal_size_lost: filteredRows.length ? Math.round((total / filteredRows.length) * 100) / 100 : 0,
      top_loss_reason: topCount?.[0] ?? null,
      top_loss_reason_count: topCount?.[1] ?? 0,
      top_loss_reason_by_value: topValue?.[0] ?? null,
      top_loss_reason_value: topValue ? Math.round(topValue[1] * 100) / 100 : 0,
    }
  }, [filteredRows])

  function toggleLossReason(reason: string) {
    setLossReasonFilters((prev) => {
      const next = new Set(prev)
      if (next.has(reason)) next.delete(reason)
      else next.add(reason)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'quoted_value' ? 'desc' : 'asc')
    }
  }

  async function handleExport(format: LostBusinessExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportLostBusinessReport(data, sortedRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  const head = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      className={cn(
        'cursor-pointer select-none px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-surface-muted hover:bg-[#ECEEE8]',
        align === 'right' && 'text-right',
      )}
      onClick={() => toggleSort(key)}
    >
      <span className={cn('inline-flex items-center gap-0.5', align === 'right' && 'w-full justify-end')}>
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  )

  return (
    <section className="rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
      <header className="flex flex-col gap-2 border-b border-[#E2E6DC] px-4 py-3 lg:flex-row lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-red-50 text-red-800">
            <TrendingDown className="size-3.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Lost Business Report</h2>
            <p className="text-[11px] text-surface-muted">
              {summary.loss_count} losses · {formatCompactINR(summary.total_lost_value)}
              {data && <> · updated {formatReportGeneratedAt(data.generated_at)}</>}
              {isFetching && !isPending && <span className="ml-1 text-emerald-700">↻</span>}
            </p>
          </div>
        </div>
        <PermissionGate permission={Permissions.REPORTS_EXPORT}>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={!data || exportBusy || sortedRows.length === 0}
              className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-input px-2.5 text-[12px] font-medium hover:bg-muted disabled:opacity-50"
            >
              {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('csv')}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PermissionGate>
      </header>

      {data && !isPending && (
        <div className="grid gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total lost value', value: formatCompactINR(summary.total_lost_value) },
            { label: 'Loss count', value: String(summary.loss_count) },
            {
              label: 'Top reason (count)',
              value: summary.top_loss_reason
                ? `${summary.top_loss_reason} (${summary.top_loss_reason_count})`
                : '—',
            },
            {
              label: 'Avg deal lost',
              value: summary.avg_deal_size_lost > 0 ? formatCompactINR(summary.avg_deal_size_lost) : '—',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-[#E2E6DC] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-surface-muted">{item.label}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {data && !isPending && filteredBreakdown.total > 0 && (
        <div className="border-b border-[#ECEEE8] px-2 py-2">
          <LostQuoteReasonChart data={filteredBreakdown} className="border-0 shadow-none" />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Loss reason</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex h-8 w-[160px] items-center justify-between rounded-lg border border-input bg-white px-2.5 text-[12px] font-normal hover:bg-muted"
            >
              {lossReasonFilters.size === 0 ? 'All reasons' : `${lossReasonFilters.size} selected`}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 w-52 overflow-y-auto">
              {(data?.loss_reason_categories ?? []).map((reason) => (
                <DropdownMenuItem
                  key={reason}
                  onClick={() => toggleLossReason(reason)}
                  className={cn(lossReasonFilters.has(reason) && 'bg-[#EEF1EA] font-medium')}
                >
                  {reason}
                  {lossReasonFilters.has(reason) ? ' ✓' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Salesperson</span>
          <Select value={salespersonId} onValueChange={(v) => setSalespersonId(v ?? '__all__')}>
            <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {(data?.salespeople ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Category</span>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? '__all__')}>
            <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {(data?.categories ?? []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Stage lost at</span>
          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v ?? '__all__')}>
            <SelectTrigger className="h-8 w-[140px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {(data?.stages_lost_at ?? []).map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {isError && (
        <p className="px-4 py-6 text-center text-[12px] text-red-700">
          {error instanceof Error ? error.message : 'Failed to load.'}
        </p>
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
          <table className="w-full min-w-[1080px] border-collapse text-[12px]">
            <thead className="sticky top-0 bg-[#F3F4F0]">
              <tr className="border-b border-[#E2E6DC]">
                {head('Quote', 'quote_ref')}
                {head('Customer', 'customer_name')}
                {head('Product', 'product')}
                {head('Value', 'quoted_value', 'right')}
                {head('Loss date', 'loss_date', 'right')}
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-surface-muted">
                  Loss reason
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-surface-muted">
                  Competitor
                </th>
                {head('Stage', 'stage_lost_at_label')}
                {head('Salesperson', 'salesperson')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-surface-muted">
                    No lost quotes match filters.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => (
                <tr key={row.quotation_id} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                  <td className="px-2 py-1.5 font-mono text-[11px] font-medium">{row.quote_ref}</td>
                  <td className="max-w-[140px] truncate px-2 py-1.5" title={row.customer_name}>
                    {row.customer_name}
                  </td>
                  <td className="max-w-[160px] truncate px-2 py-1.5" title={row.product}>
                    {row.product}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums font-medium"
                    title={formatCurrency(row.quoted_value)}
                  >
                    {formatCompactINR(row.quoted_value)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatListDate(row.loss_date)}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold',
                        lossReasonPillClass(row.loss_reason),
                      )}
                      title={row.notes ?? undefined}
                    >
                      {row.loss_reason ?? 'Unspecified'}
                    </span>
                  </td>
                  <td className="max-w-[100px] truncate px-2 py-1.5 text-surface-muted" title={row.competitor ?? undefined}>
                    {row.competitor ?? '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold',
                        STAGE_LOST_PILL[row.stage_lost_at_key] ?? STAGE_LOST_PILL.quoted,
                      )}
                    >
                      {row.stage_lost_at_label}
                    </span>
                  </td>
                  <td className="max-w-[110px] truncate px-2 py-1.5" title={row.salesperson}>
                    {row.salesperson}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
