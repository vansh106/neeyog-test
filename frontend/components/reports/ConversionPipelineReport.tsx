'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  TrendingUp,
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConversionPipelineGroupBy, ConversionPipelineRow } from '@/lib/api'
import {
  exportConversionPipelineReport,
  type ConversionPipelineExportFormat,
} from '@/lib/exportConversionPipelineReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { cn, formatCurrency } from '@/lib/utils'

const PAGE_SIZE = 15

const GROUP_BY_OPTIONS: Array<{ value: ConversionPipelineGroupBy; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'user', label: 'Salesperson' },
  { value: 'category', label: 'Product Category' },
  { value: 'customer', label: 'Customer' },
]

type SortKey =
  | 'group_label'
  | 'enquiry_count'
  | 'quote_count'
  | 'quoted_value'
  | 'po_count'
  | 'po_value'
  | 'conversion_pct'

type SortDir = 'asc' | 'desc'

function formatCount(n: number): string {
  return n.toLocaleString('en-IN')
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className="size-3.5 text-emerald-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5 text-emerald-700" aria-hidden />
  )
}

function sortRows(rows: ConversionPipelineRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function ConversionPipelineReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const [groupBy, setGroupBy] = useState<ConversionPipelineGroupBy>('month')
  const [sortKey, setSortKey] = useState<SortKey>('conversion_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [exportBusy, setExportBusy] = useState(false)

  const data = bundle?.conversion_pipeline[groupBy]

  const sortedRows = useMemo(
    () => (data ? sortRows(data.rows, sortKey, sortDir) : []),
    [data, sortKey, sortDir],
  )

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const threshold = data?.conversion_threshold_pct ?? 30

  function toggleSort(key: SortKey) {
    setPage(1)
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'group_label' ? 'asc' : 'desc')
    }
  }

  function onGroupByChange(value: ConversionPipelineGroupBy | null) {
    if (!value) return
    setGroupBy(value)
    setPage(1)
  }

  async function handleExport(format: ConversionPipelineExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportConversionPipelineReport(data, sortedRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  const groupColumnLabel = data?.group_by_label ?? 'Group'

  const sortableHead = (label: string, key: SortKey, align: 'left' | 'right' = 'right') => (
    <th
      className={cn(
        'cursor-pointer select-none px-3 py-2.5 font-semibold transition-colors hover:bg-[#EEF1EA]',
        align === 'right' ? 'text-right' : 'text-left',
      )}
      onClick={() => toggleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  )

  return (
    <section className="rounded-xl border border-[#E2E6DC] bg-white shadow-sm">
      <header className="border-b border-[#E2E6DC] px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#E8F3EC] text-emerald-800">
                <TrendingUp className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.2px] text-gray-900">
                  Conversion / Pipeline Report
                </h2>
                <p className="text-[12px] text-surface-muted">
                  Enquiry → Quote → PO journey with conversion metrics
                </p>
              </div>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-surface-muted">
              <div>
                <dt className="inline font-medium text-gray-700">Last updated: </dt>
                <dd className="inline">
                  {data ? formatReportGeneratedAt(data.generated_at) : isPending ? 'Loading…' : '—'}
                  {isFetching && !isPending && (
                    <span className="ml-1.5 text-emerald-700">(refreshing)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-gray-700">Records: </dt>
                <dd className="inline tabular-nums">{data?.record_count ?? '—'}</dd>
              </div>
              {data?.scope_label && (
                <div>
                  <dt className="inline font-medium text-gray-700">Scope: </dt>
                  <dd className="inline">{data.scope_label}</dd>
                </div>
              )}
            </dl>
          </div>

          <PermissionGate permission={Permissions.REPORTS_EXPORT}>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                disabled={!data || exportBusy}
              >
                {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleExport('xlsx')}>Download Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExport('csv')}>Download CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PermissionGate>
        </div>
      </header>

      <div className="border-b border-[#ECEEE8] bg-[#FAFAF8] px-5 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-surface-muted">Group by</span>
            <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as ConversionPipelineGroupBy)}>
              <SelectTrigger className="h-9 w-[200px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {isError && (
        <div className="px-5 py-8 text-center text-[13px] text-red-700">
          {error instanceof Error ? error.message : 'Could not load report.'}
        </div>
      )}

      {isPending && (
        <div className="space-y-2 px-5 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {data && !isPending && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-[13px]">
              <thead className="sticky top-0 z-10 bg-[#F7F8F5]">
                <tr className="border-b border-[#E2E6DC] text-left text-[10px] uppercase tracking-wide text-surface-muted">
                  {sortableHead(groupColumnLabel, 'group_label', 'left')}
                  {sortableHead('Enquiries', 'enquiry_count')}
                  {sortableHead('Quotes', 'quote_count')}
                  {sortableHead('Quoted Value', 'quoted_value')}
                  {sortableHead('POs', 'po_count')}
                  {sortableHead('PO Value', 'po_value')}
                  {sortableHead('Conv %', 'conversion_pct')}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-surface-muted">
                      No data for the selected filters.
                    </td>
                  </tr>
                )}
                {pageRows.map((row, idx) => {
                  const lowConversion =
                    row.quoted_value > 0 && row.conversion_pct < threshold
                  return (
                    <tr
                      key={row.row_key}
                      className={cn(
                        'border-b border-[#ECEEE8] transition-colors',
                        idx % 2 === 1 && !lowConversion && 'bg-[#FAFAF8]',
                        lowConversion && 'bg-amber-50/90 hover:bg-amber-50',
                        !lowConversion && 'hover:bg-[#F5F8F4]',
                      )}
                    >
                      <td className="px-3 py-2.5 font-medium text-gray-900">{row.group_label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(row.enquiry_count)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(row.quote_count)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" title={formatCurrency(row.quoted_value)}>
                        {formatCompactINR(row.quoted_value)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(row.po_count)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium" title={formatCurrency(row.po_value)}>
                        {formatCompactINR(row.po_value)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            'inline-flex min-w-[3.25rem] justify-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums',
                            lowConversion
                              ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80'
                              : row.conversion_pct >= threshold
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-gray-100 text-gray-800',
                          )}
                        >
                          {row.conversion_pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {data.totals && (
                <tfoot className="sticky bottom-0 z-10 border-t-2 border-[#D8DDD3] bg-[#F0F3EB] font-semibold text-gray-900">
                  <tr>
                    <td className="px-3 py-3">{data.totals.group_label}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCount(data.totals.enquiry_count)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCount(data.totals.quote_count)}</td>
                    <td className="px-3 py-3 text-right tabular-nums" title={formatCurrency(data.totals.quoted_value)}>
                      {formatCompactINR(data.totals.quoted_value)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCount(data.totals.po_count)}</td>
                    <td className="px-3 py-3 text-right tabular-nums" title={formatCurrency(data.totals.po_value)}>
                      {formatCompactINR(data.totals.po_value)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex min-w-[3.25rem] justify-center rounded-full bg-[#2A6B3C] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white">
                        {data.totals.conversion_pct}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEEE8] px-5 py-3">
            <p className="text-[11px] text-surface-muted">
              Conv % = PO value ÷ quoted value · Rows below {threshold}% conversion are highlighted
            </p>
            {sortedRows.length > PAGE_SIZE && (
              <div className="flex items-center gap-2 text-[12px]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="tabular-nums text-surface-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
