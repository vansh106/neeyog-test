'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Loader2,
  PackageCheck,
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
import type { SoHandoffRow } from '@/lib/api'
import { exportSoHandoffReport, type SoHandoffExportFormat } from '@/lib/exportSoHandoffReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { handoffDaysClass } from '@/lib/reportHeatmap'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { cn, formatCurrency } from '@/lib/utils'

type SoStatusFilter = 'all' | 'created' | 'pending'
type SortKey =
  | 'po_reference'
  | 'customer_name'
  | 'po_value'
  | 'po_date'
  | 'so_created'
  | 'days_to_handoff'
  | 'handoff_owner'
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

function sortRows(rows: SoHandoffRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'po_value') return (a.po_value - b.po_value) * factor
    if (sortKey === 'days_to_handoff') {
      const av = a.days_to_handoff ?? (sortDir === 'asc' ? Infinity : -Infinity)
      const bv = b.days_to_handoff ?? (sortDir === 'asc' ? Infinity : -Infinity)
      return (av - bv) * factor
    }
    if (sortKey === 'so_created') return (Number(a.so_created) - Number(b.so_created)) * factor
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function SoHandoffReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.so_handoff
  const [soStatus, setSoStatus] = useState<SoStatusFilter>('all')
  const [ownerId, setOwnerId] = useState('__all__')
  const [sortKey, setSortKey] = useState<SortKey>('po_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((row) => {
      if (soStatus === 'created' && !row.so_created) return false
      if (soStatus === 'pending' && row.so_created) return false
      if (ownerId !== '__all__') {
        const rid = row.handoff_owner_id ?? '__unassigned__'
        if (rid !== ownerId) return false
      }
      return true
    })
  }, [data, soStatus, ownerId])

  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir])

  const summary = useMemo(() => {
    const total = sortedRows.length
    const created = sortedRows.filter((r) => r.so_created).length
    const days = sortedRows.filter((r) => r.days_to_handoff != null).map((r) => r.days_to_handoff!)
    return {
      total_pos: total,
      pct_so_created: total > 0 ? Math.round((created / total) * 1000) / 10 : 0,
      avg_days_to_handoff: days.length > 0 ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10 : null,
    }
  }, [sortedRows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'po_date' || key === 'po_value' || key === 'days_to_handoff' ? 'desc' : 'asc')
    }
  }

  async function handleExport(format: SoHandoffExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportSoHandoffReport(data, sortedRows, format)
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
            <PackageCheck className="size-3.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">SO Conversion / ERP Handoff</h2>
            <p className="text-[11px] text-surface-muted">
              {summary.total_pos} POs · {summary.pct_so_created}% with SO
              {summary.avg_days_to_handoff != null && ` · avg ${summary.avg_days_to_handoff}d handoff`}
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

      <div className="flex flex-wrap items-end gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">SO status</span>
          <Select value={soStatus} onValueChange={(v) => setSoStatus((v as SoStatusFilter) ?? 'all')}>
            <SelectTrigger className="h-8 w-[130px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Handoff owner</span>
          <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? '__all__')}>
            <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All owners</SelectItem>
              {(data?.handoff_owners ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {isError && <p className="px-4 py-6 text-center text-[12px] text-red-700">{error instanceof Error ? error.message : 'Failed to load.'}</p>}
      {isPending && (
        <div className="space-y-1 px-4 py-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      )}

      {data && !isPending && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[12px]">
            <thead className="sticky top-0 bg-[#F3F4F0]">
              <tr className="border-b border-[#E2E6DC]">
                <th className="w-8 px-2 py-2" />
                {head('PO Ref', 'po_reference')}
                {head('Customer', 'customer_name')}
                {head('Value', 'po_value', 'right')}
                {head('PO Date', 'po_date', 'right')}
                {head('SO Created', 'so_created')}
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-surface-muted">SO Number</th>
                <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-surface-muted">SO Date</th>
                {head('Days', 'days_to_handoff', 'right')}
                {head('Owner', 'handoff_owner')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-surface-muted">No POs in this period.</td></tr>
              )}
              {sortedRows.map((row) => (
                <tr key={row.po_id} className={cn('border-b border-[#F0F1ED] hover:bg-[#F8F9F6]', row.handoff_overdue && 'bg-amber-50/70')}>
                  <td className="px-2 py-1.5 text-center">
                    {row.handoff_overdue && <AlertTriangle className="mx-auto size-3.5 text-amber-600" aria-label="Handoff overdue" />}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px] font-medium">{row.po_reference}</td>
                  <td className="max-w-[160px] truncate px-2 py-1.5" title={row.customer_name}>{row.customer_name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium" title={formatCurrency(row.po_value)}>{formatCompactINR(row.po_value)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatListDate(row.po_date)}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn('inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold', row.so_created ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
                      {row.so_created ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{row.so_number ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatListDate(row.so_creation_date)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={cn('inline-flex min-w-[2rem] justify-center rounded px-1.5 py-0.5 tabular-nums text-[11px]', handoffDaysClass(row.days_to_handoff))}>
                      {row.days_to_handoff != null ? row.days_to_handoff : '—'}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate px-2 py-1.5" title={row.handoff_owner}>{row.handoff_owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
