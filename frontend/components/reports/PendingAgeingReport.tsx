'use client'

import { ChevronDown, ChevronRight, Clock, Download, Loader2 } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { PendingAgeingRow } from '@/lib/api'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import {
  exportPendingAgeingReport,
  type PendingAgeingExportFormat,
} from '@/lib/exportPendingAgeingReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import {
  AGEING_BUCKET_ORDER,
  AGEING_CELL_CLASS,
  NEXT_ACTION_CLASS,
  STAGE_PILL,
  type AgeingBucketKey,
  type PipelineStageKey,
} from '@/lib/pendingAgeing'
import { Permissions } from '@/lib/permissions'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'
import { cn, formatCurrency } from '@/lib/utils'

function formatListDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function nextActionLabel(row: PendingAgeingRow): string {
  if (!row.next_action_due) return 'No date'
  return formatListDate(row.next_action_due)
}

export default function PendingAgeingReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.pending_ageing

  const [salespersonId, setSalespersonId] = useState('__all__')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [stageFilter, setStageFilter] = useState('__all__')
  const [bucketFilter, setBucketFilter] = useState('__all__')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [exportBusy, setExportBusy] = useState(false)

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((row) => {
      if (salespersonId !== '__all__') {
        const rowId = row.salesperson_id ?? '__unassigned__'
        if (rowId !== salespersonId) return false
      }
      if (categoryFilter !== '__all__' && row.category !== categoryFilter) return false
      if (stageFilter !== '__all__' && row.stage_key !== stageFilter) return false
      if (bucketFilter !== '__all__' && row.ageing_bucket_key !== bucketFilter) return false
      return true
    })
  }, [data, salespersonId, categoryFilter, stageFilter, bucketFilter])

  const summary = useMemo(() => {
    const totalValue = filteredRows.reduce((s, r) => s + r.quoted_value, 0)
    const avgAge =
      filteredRows.length > 0
        ? Math.round((filteredRows.reduce((s, r) => s + r.age_days, 0) / filteredRows.length) * 10) / 10
        : 0
    return {
      total_open_value: Math.round(totalValue * 100) / 100,
      item_count: filteredRows.length,
      avg_age_days: avgAge,
    }
  }, [filteredRows])

  const bucketGroups = useMemo(() => {
    return AGEING_BUCKET_ORDER.map((key) => {
      const rows = filteredRows.filter((r) => r.ageing_bucket_key === key)
      const meta = data?.bucket_summaries.find((b) => b.bucket_key === key)
      return {
        key,
        label: meta?.bucket_label ?? key,
        rows,
        count: rows.length,
        total_value: Math.round(rows.reduce((s, r) => s + r.quoted_value, 0) * 100) / 100,
      }
    }).filter((g) => g.count > 0 || bucketFilter === '__all__')
  }, [filteredRows, data, bucketFilter])

  function toggleBucket(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleExport(format: PendingAgeingExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportPendingAgeingReport(data, filteredRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
      <header className="flex flex-col gap-2 border-b border-[#E2E6DC] px-4 py-3 lg:flex-row lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#EEF0EA] text-gray-700">
            <Clock className="size-3.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Pending &amp; Ageing Report</h2>
            <p className="text-[11px] text-surface-muted">
              Open pipeline as of {data ? formatListDate(data.as_of_date) : '—'}
              {data && <> · updated {formatReportGeneratedAt(data.generated_at)}</>}
              {isFetching && !isPending && <span className="ml-1 text-emerald-700">↻</span>}
            </p>
          </div>
        </div>
        <PermissionGate permission={Permissions.REPORTS_EXPORT}>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={!data || exportBusy || filteredRows.length === 0}
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
        <div className="flex flex-wrap gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
          {[
            { label: 'Open value', value: formatCompactINR(summary.total_open_value) },
            { label: 'Open items', value: String(summary.item_count) },
            { label: 'Avg age', value: `${summary.avg_age_days}d` },
          ].map((chip) => (
            <div
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E6DC] bg-white px-2.5 py-1 text-[11px]"
            >
              <span className="text-surface-muted">{chip.label}</span>
              <span className="font-semibold tabular-nums text-gray-900">{chip.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
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
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Stage</span>
          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v ?? '__all__')}>
            <SelectTrigger className="h-8 w-[130px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {(data?.stages ?? []).map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase text-surface-muted">Ageing</span>
          <Select value={bucketFilter} onValueChange={(v) => setBucketFilter(v ?? '__all__')}>
            <SelectTrigger className="h-8 w-[130px] bg-white text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All buckets</SelectItem>
              {(data?.ageing_buckets ?? []).map((b) => (
                <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
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
          <table className="w-full min-w-[1100px] border-collapse text-[12px]">
            <thead className="sticky top-0 bg-[#F3F4F0]">
              <tr className="border-b border-[#E2E6DC] text-[10px] font-semibold uppercase tracking-wide text-surface-muted">
                <th className="px-2 py-2 text-left">Reference</th>
                <th className="px-2 py-2 text-left">Customer</th>
                <th className="px-2 py-2 text-left">Product</th>
                <th className="px-2 py-2 text-right">Value</th>
                <th className="px-2 py-2 text-left">Stage</th>
                <th className="px-2 py-2 text-right">Created</th>
                <th className="px-2 py-2 text-right">Last activity</th>
                <th className="px-2 py-2 text-right">Age</th>
                <th className="px-2 py-2 text-left">Salesperson</th>
                <th className="px-2 py-2 text-left">Next action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-surface-muted">
                    No open items match filters.
                  </td>
                </tr>
              )}
              {bucketGroups.map((group) => {
                const isCollapsed = collapsed.has(group.key)
                if (group.count === 0) return null
                return (
                  <Fragment key={group.key}>
                    <tr
                      className="cursor-pointer border-b border-[#E2E6DC] bg-[#ECEEE8] hover:bg-[#E4E7E0]"
                      onClick={() => toggleBucket(group.key)}
                    >
                      <td colSpan={10} className="px-2 py-2 font-semibold text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          {isCollapsed ? (
                            <ChevronRight className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="size-3.5" aria-hidden />
                          )}
                          {group.label}
                          <span className="font-normal text-surface-muted">
                            · {group.count} items · {formatCompactINR(group.total_value)} at risk
                          </span>
                        </span>
                      </td>
                    </tr>
                    {!isCollapsed &&
                      group.rows.map((row) => (
                        <tr key={row.item_id} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                          <td className="px-2 py-1.5 font-mono text-[11px] font-medium">{row.reference}</td>
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
                            {row.quoted_value > 0 ? formatCompactINR(row.quoted_value) : '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold',
                                STAGE_PILL[row.stage_key as PipelineStageKey],
                              )}
                            >
                              {row.stage_label}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatListDate(row.created_date)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatListDate(row.last_activity_date)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <span
                              className={cn(
                                'inline-flex min-w-[2rem] justify-center rounded px-1.5 py-0.5 tabular-nums',
                                AGEING_CELL_CLASS[row.ageing_bucket_key as AgeingBucketKey],
                              )}
                            >
                              {row.age_days}d
                            </span>
                          </td>
                          <td className="max-w-[110px] truncate px-2 py-1.5" title={row.salesperson}>
                            {row.salesperson}
                          </td>
                          <td
                            className={cn(
                              'px-2 py-1.5 tabular-nums',
                              NEXT_ACTION_CLASS[row.next_action_urgency],
                            )}
                          >
                            {nextActionLabel(row)}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
