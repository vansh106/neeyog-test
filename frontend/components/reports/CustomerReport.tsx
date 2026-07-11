'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Loader2,
  Search,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { CustomerReportRow } from '@/lib/api'
import {
  CUSTOMER_TIER_PILL,
  type CustomerTier,
  stalenessLevel,
} from '@/lib/customerTier'
import { exportCustomerReport, type CustomerReportExportFormat } from '@/lib/exportCustomerReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { metricMinMax, winRateHeatmapClass } from '@/lib/reportHeatmap'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'customer_name'
  | 'enquiry_count'
  | 'quote_count'
  | 'quoted_value'
  | 'po_count'
  | 'po_value'
  | 'win_rate_pct'
  | 'last_activity_date'
  | 'primary_source_label'
  | 'primary_category'
  | 'customer_tier'

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
  return dir === 'asc' ? <ArrowUp className="size-3 text-emerald-700" /> : <ArrowDown className="size-3 text-emerald-700" />
}

function sortRows(rows: CustomerReportRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (typeof a[sortKey] === 'number' && typeof b[sortKey] === 'number') {
      return ((a[sortKey] as number) - (b[sortKey] as number)) * factor
    }
    return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function CustomerReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.customer
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('__all__')
  const [sourceFilter, setSourceFilter] = useState('__all__')
  const [sortKey, setSortKey] = useState<SortKey>('po_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const filteredRows = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (tierFilter !== '__all__' && row.customer_tier !== tierFilter) return false
      if (sourceFilter !== '__all__' && row.primary_source_key !== sourceFilter) return false
      if (q && !row.customer_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search, tierFilter, sourceFilter])

  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir])
  const winRateRange = useMemo(() => metricMinMax(sortedRows, 'win_rate_pct'), [sortedRows])

  const footer = useMemo(() => {
    const totalPo = sortedRows.reduce((s, r) => s + r.po_value, 0)
    const rates = sortedRows.filter((r) => r.quoted_value > 0).map((r) => r.win_rate_pct)
    return {
      customer_count: sortedRows.length,
      total_po_value: Math.round(totalPo * 100) / 100,
      avg_win_rate: rates.length ? Math.round((rates.reduce((s, v) => s + v, 0) / rates.length) * 10) / 10 : 0,
    }
  }, [sortedRows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'customer_name' ? 'asc' : 'desc')
    }
  }

  async function handleExport(format: CustomerReportExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportCustomerReport(data, sortedRows, format)
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
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#EEF0EA] text-gray-700">
            <Users className="size-3.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Customer Report</h2>
            <p className="text-[11px] text-surface-muted">
              {footer.customer_count} customers · {formatCompactINR(footer.total_po_value)} PO value
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

      <div className="space-y-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[180px] flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-surface-muted" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer name…" className="h-8 bg-white pl-7 text-[12px]" />
            </div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Tier</span>
            <Select value={tierFilter} onValueChange={(v) => setTierFilter(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[110px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Source</span>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sources</SelectItem>
                {(data?.source_channels ?? []).map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {isError && <p className="px-4 py-6 text-center text-[12px] text-red-700">{error instanceof Error ? error.message : 'Failed to load.'}</p>}
      {isPending && (
        <div className="space-y-1 px-4 py-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      )}

      {data && !isPending && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-[12px]">
            <thead className="sticky top-0 bg-[#F3F4F0]">
              <tr className="border-b border-[#E2E6DC]">
                {head('Customer', 'customer_name')}
                {head('Tier', 'customer_tier')}
                {head('Enquiries', 'enquiry_count', 'right')}
                {head('Quotes sent', 'quote_count', 'right')}
                {head('Quoted value', 'quoted_value', 'right')}
                {head('POs', 'po_count', 'right')}
                {head('PO value', 'po_value', 'right')}
                {head('Win rate', 'win_rate_pct', 'right')}
                {head('Last activity', 'last_activity_date', 'right')}
                {head('Source', 'primary_source_label')}
                {head('Category', 'primary_category')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-surface-muted">No customers match filters.</td></tr>
              )}
              {sortedRows.map((row) => {
                const stale = stalenessLevel(row.last_activity_date)
                const tier = row.customer_tier as CustomerTier
                return (
                  <tr key={row.customer_key} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                    <td className="max-w-[180px] truncate px-2 py-1.5 font-medium text-gray-900" title={row.customer_name}>{row.customer_name}</td>
                    <td className="px-2 py-1.5">
                      <span className={cn('inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold', CUSTOMER_TIER_PILL[tier] ?? CUSTOMER_TIER_PILL.low)}>
                        {row.customer_tier_label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.enquiry_count}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.quote_count}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" title={formatCurrency(row.quoted_value)}>{formatCompactINR(row.quoted_value)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.po_count}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium" title={formatCurrency(row.po_value)}>{formatCompactINR(row.po_value)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={cn('inline-flex min-w-[2.5rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', winRateHeatmapClass(row.win_rate_pct, winRateRange.min, winRateRange.max))}>
                        {row.win_rate_pct}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <span className={cn('inline-flex items-center justify-end gap-1', stale === 'warn' && 'text-amber-800', stale === 'alert' && 'text-red-800 font-medium')}>
                        {(stale === 'warn' || stale === 'alert') && <AlertTriangle className="size-3 shrink-0" aria-hidden />}
                        {formatListDate(row.last_activity_date)}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-1.5" title={row.primary_source_label}>{row.primary_source_label}</td>
                    <td className="max-w-[120px] truncate px-2 py-1.5" title={row.primary_category}>{row.primary_category}</td>
                  </tr>
                )
              })}
            </tbody>
            {sortedRows.length > 0 && (
              <tfoot className="border-t-2 border-[#D8DDD3] bg-[#F0F3EB] font-semibold">
                <tr>
                  <td className="px-2 py-2.5">All customers ({footer.customer_count})</td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right tabular-nums">{sortedRows.reduce((s, r) => s + r.enquiry_count, 0)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{sortedRows.reduce((s, r) => s + r.quote_count, 0)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCompactINR(sortedRows.reduce((s, r) => s + r.quoted_value, 0))}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{sortedRows.reduce((s, r) => s + r.po_count, 0)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCompactINR(footer.total_po_value)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{footer.avg_win_rate}% avg</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
