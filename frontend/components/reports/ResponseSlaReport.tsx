'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock,
  Download,
  Loader2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import WeeklyResponseSpeedTrend from '@/components/dashboard/WeeklyResponseSpeedTrend'
import { PermissionGate } from '@/components/auth/PermissionGate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResponseSlaRow } from '@/lib/api'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import {
  exportResponseSlaReport,
  type ResponseSlaExportFormat,
} from '@/lib/exportResponseSlaReport'
import { formatResponseHours } from '@/lib/formatResponseHours'
import { Permissions } from '@/lib/permissions'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'
import {
  DEFAULT_SLA_TARGET_HOURS,
  SLA_MET_PILL,
  SLA_SEVERITY_CELL,
  SLA_TARGET_HOUR_OPTIONS,
  slaMet,
  slaSeverity,
  type SlaTargetHours,
} from '@/lib/slaResponse'
import { cn } from '@/lib/utils'

type SlaStatusFilter = 'all' | 'met' | 'breached'

type SortKey =
  | 'enquiry_ref'
  | 'customer_name'
  | 'category'
  | 'received_at'
  | 'quote_sent_at'
  | 'response_hours'
  | 'salesperson'

type SortDir = 'asc' | 'desc'

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

function sortRows(rows: ResponseSlaRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'response_hours') return (a.response_hours - b.response_hours) * factor
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function ResponseSlaReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.response_sla

  const [slaTargetHours, setSlaTargetHours] = useState<SlaTargetHours>(DEFAULT_SLA_TARGET_HOURS)
  const [salespersonId, setSalespersonId] = useState('__all__')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [slaStatus, setSlaStatus] = useState<SlaStatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('response_hours')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((row) => {
      const met = slaMet(row.response_hours, slaTargetHours)
      if (slaStatus === 'met' && !met) return false
      if (slaStatus === 'breached' && met) return false
      if (salespersonId !== '__all__') {
        const rowId = row.salesperson_id ?? '__unassigned__'
        if (rowId !== salespersonId) return false
      }
      if (categoryFilter !== '__all__' && row.category !== categoryFilter) return false
      return true
    })
  }, [data, slaTargetHours, slaStatus, salespersonId, categoryFilter])

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  )

  const summary = useMemo(() => {
    const total = filteredRows.length
    if (total === 0) {
      return {
        total_enquiries: 0,
        sla_met_pct: 0,
        avg_response_hours: null as number | null,
        worst_response_hours: null as number | null,
      }
    }
    const metCount = filteredRows.filter((r) => slaMet(r.response_hours, slaTargetHours)).length
    const hours = filteredRows.map((r) => r.response_hours)
    return {
      total_enquiries: total,
      sla_met_pct: Math.round((metCount / total) * 1000) / 10,
      avg_response_hours: Math.round((hours.reduce((s, v) => s + v, 0) / total) * 10) / 10,
      worst_response_hours: Math.round(Math.max(...hours) * 10) / 10,
    }
  }, [filteredRows, slaTargetHours])

  const weeklyChartData = useMemo(() => {
    if (!data || filteredRows.length === 0) {
      return { weeks: [], target_hours: slaTargetHours, milestone_week: null, milestone_hours: null }
    }
    const buckets = new Map<string, { label: string; hours: number[] }>()
    for (const row of filteredRows) {
      const received = new Date(row.received_at)
      const weekStart = new Date(received)
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(received.getDate() - ((received.getDay() + 6) % 7))
      const key = weekStart.toISOString().slice(0, 10)
      const label = weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      const bucket = buckets.get(key) ?? { label, hours: [] }
      bucket.hours.push(row.response_hours)
      buckets.set(key, bucket)
    }

    let bestKey: string | null = null
    let bestAvg: number | null = null
    const weeks = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket], index) => {
        const avg = Math.round((bucket.hours.reduce((s, v) => s + v, 0) / bucket.hours.length) * 10) / 10
        if (bestAvg === null || avg < bestAvg) {
          bestAvg = avg
          bestKey = key
        }
        return {
          week_label: bucket.label,
          week: index + 1,
          avg_hours: avg,
          is_milestone: false,
        }
      })

    const milestoneWeek = weeks.find((_, i) => Array.from(buckets.keys()).sort()[i] === bestKey)
    if (milestoneWeek) milestoneWeek.is_milestone = true

    return {
      weeks,
      target_hours: slaTargetHours,
      milestone_week: milestoneWeek?.week ?? null,
      milestone_hours: bestAvg,
    }
  }, [data, filteredRows, slaTargetHours])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'response_hours' ? 'desc' : 'asc')
    }
  }

  async function handleExport(format: ResponseSlaExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportResponseSlaReport(data, sortedRows, slaTargetHours, format)
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
            <Clock className="size-3.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Response Time / SLA Report</h2>
            <p className="text-[11px] text-surface-muted">
              Enquiry-to-quote response compliance
              {data && (
                <>
                  {' '}
                  · updated {formatReportGeneratedAt(data.generated_at)}
                </>
              )}
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
        <div className="flex flex-wrap gap-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
          {[
            { label: 'Enquiries quoted', value: String(summary.total_enquiries) },
            { label: 'SLA met', value: `${summary.sla_met_pct}%` },
            {
              label: 'Avg response',
              value: summary.avg_response_hours != null ? formatResponseHours(summary.avg_response_hours) : '—',
            },
            {
              label: 'Worst response',
              value:
                summary.worst_response_hours != null
                  ? formatResponseHours(summary.worst_response_hours)
                  : '—',
            },
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

      <div className="space-y-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">SLA target</span>
            <Select
              value={String(slaTargetHours)}
              onValueChange={(v) => setSlaTargetHours(Number(v) as SlaTargetHours)}
            >
              <SelectTrigger className="h-8 w-[100px] bg-white text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLA_TARGET_HOUR_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h}h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">SLA status</span>
            <Select value={slaStatus} onValueChange={(v) => setSlaStatus((v as SlaStatusFilter) ?? 'all')}>
              <SelectTrigger className="h-8 w-[120px] bg-white text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="met">Met</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Salesperson</span>
            <Select value={salespersonId} onValueChange={(v) => setSalespersonId(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[150px] bg-white text-[12px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {(data?.salespeople ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Category</span>
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

      {data && !isPending && weeklyChartData.weeks.length > 0 && (
        <div className="border-b border-[#ECEEE8] px-2 py-2">
          <WeeklyResponseSpeedTrend
            data={weeklyChartData}
            className="border-0 shadow-none"
          />
        </div>
      )}

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
                {head('Enquiry', 'enquiry_ref')}
                {head('Customer', 'customer_name')}
                {head('Category', 'category')}
                {head('Received', 'received_at')}
                {head('Quote sent', 'quote_sent_at')}
                {head('Response', 'response_hours', 'right')}
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-surface-muted">
                  SLA
                </th>
                {head('Salesperson', 'salesperson')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-surface-muted">
                    No enquiries match filters.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => {
                const met = slaMet(row.response_hours, slaTargetHours)
                const severity = slaSeverity(row.response_hours, slaTargetHours)
                return (
                  <tr key={row.enquiry_id} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                    <td className="px-2 py-1.5 font-mono text-[11px] font-medium text-gray-900">{row.enquiry_ref}</td>
                    <td className="max-w-[160px] truncate px-2 py-1.5" title={row.customer_name}>
                      {row.customer_name}
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-1.5" title={row.category}>
                      {row.category}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-surface-muted">
                      {formatDateTime(row.received_at)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-surface-muted">
                      {formatDateTime(row.quote_sent_at)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={cn(
                          'inline-flex min-w-[3rem] justify-center rounded px-1.5 py-0.5 tabular-nums',
                          SLA_SEVERITY_CELL[severity],
                        )}
                      >
                        {formatResponseHours(row.response_hours)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold',
                          met ? SLA_MET_PILL.met : SLA_MET_PILL.breached,
                        )}
                      >
                        {met ? 'Met' : 'Breached'}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-1.5" title={row.salesperson}>
                      {row.salesperson}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
