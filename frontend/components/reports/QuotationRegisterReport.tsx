'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileText,
  Loader2,
  Search,
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
import type { QuotationRegisterRow } from '@/lib/api'
import {
  exportQuotationRegisterReport,
  type QuotationRegisterExportFormat,
} from '@/lib/exportQuotationRegisterReport'
import { Permissions } from '@/lib/permissions'
import {
  QUOTATION_REGISTER_STATUSES,
  QUOTATION_REGISTER_STATUS_LABELS,
  QUOTATION_REGISTER_STATUS_PILL,
  type QuotationRegisterDisplayStatus,
  quotationRegisterStatusLabel,
} from '@/lib/quotationRegisterStatus'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'quote_ref'
  | 'date_raised'
  | 'customer_name'
  | 'product'
  | 'quoted_value'
  | 'display_status'
  | 'salesperson'
  | 'expiry_date'

type SortDir = 'asc' | 'desc'

function formatListDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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

function sortRows(rows: QuotationRegisterRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (sortKey === 'quoted_value') return ((av as number) - (bv as number)) * factor
    const as = av == null ? '' : String(av)
    const bs = bv == null ? '' : String(bv)
    return as.localeCompare(bs, undefined, { sensitivity: 'base' }) * factor
  })
}

export default function QuotationRegisterReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.quotation_register
  const [search, setSearch] = useState('')
  const [salespersonId, setSalespersonId] = useState('__all__')
  const [statusFilters, setStatusFilters] = useState<Set<QuotationRegisterDisplayStatus>>(
    () => new Set(QUOTATION_REGISTER_STATUSES),
  )
  const [sortKey, setSortKey] = useState<SortKey>('date_raised')
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
    const q = search.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (!statusFilters.has(row.display_status)) return false
      if (salespersonId !== '__all__') {
        const rowId = row.salesperson_id ?? '__unassigned__'
        if (rowId !== salespersonId) return false
      }
      if (!q) return true
      return (
        row.quote_ref.toLowerCase().includes(q) ||
        row.customer_name.toLowerCase().includes(q)
      )
    })
  }, [data, search, salespersonId, statusFilters])

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  )

  const filteredTotalValue = useMemo(
    () => sortedRows.reduce((sum, r) => sum + r.quoted_value, 0),
    [sortedRows],
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'quote_ref' || key === 'customer_name' ? 'asc' : 'desc')
    }
  }

  function toggleStatus(status: QuotationRegisterDisplayStatus) {
    setStatusFilters((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        if (next.size === 1) return prev
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  async function handleExport(format: QuotationRegisterExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportQuotationRegisterReport(data, sortedRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  const sortableHead = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      className={cn(
        'cursor-pointer select-none px-2 py-1.5 font-semibold text-[10px] uppercase tracking-wide text-surface-muted transition-colors hover:bg-[#ECEEE8]',
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
      <header className="border-b border-[#E2E6DC] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#EEF0EA] text-gray-700">
                <FileText className="size-3.5" aria-hidden />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-gray-900">Quotation Register</h2>
                <p className="text-[11px] text-surface-muted">Flat-list export of all quotations in period</p>
              </div>
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
              <div>
                <dt className="inline text-surface-muted">Showing: </dt>
                <dd className="inline font-semibold tabular-nums text-gray-900">
                  {sortedRows.length.toLocaleString('en-IN')} quotes
                </dd>
              </div>
              <div>
                <dt className="inline text-surface-muted">Quoted value: </dt>
                <dd className="inline font-semibold tabular-nums text-gray-900">
                  {formatCurrency(filteredTotalValue)}
                </dd>
              </div>
              <div>
                <dt className="inline text-surface-muted">Updated: </dt>
                <dd className="inline text-surface-muted">
                  {data ? formatReportGeneratedAt(data.generated_at) : isPending ? '…' : '—'}
                  {isFetching && !isPending && <span className="ml-1 text-emerald-700">↻</span>}
                </dd>
              </div>
            </dl>
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
        </div>
      </header>

      <div className="space-y-2 border-b border-[#ECEEE8] bg-[#FAFAF8] px-4 py-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[180px] flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-surface-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer or quote ref…"
                className="h-8 bg-white pl-7 text-[12px]"
              />
            </div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Salesperson</span>
            <Select value={salespersonId} onValueChange={(v) => setSalespersonId(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[160px] bg-white text-[12px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All salespeople</SelectItem>
                {ownerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted mr-1">Status</span>
          {QUOTATION_REGISTER_STATUSES.map((status) => {
            const active = statusFilters.has(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity',
                  QUOTATION_REGISTER_STATUS_PILL[status],
                  !active && 'opacity-40 line-through',
                )}
              >
                {QUOTATION_REGISTER_STATUS_LABELS[status]}
              </button>
            )
          })}
        </div>
      </div>

      {isError && (
        <div className="px-4 py-6 text-center text-[12px] text-red-700">
          {error instanceof Error ? error.message : 'Could not load register.'}
        </div>
      )}

      {isPending && (
        <div className="space-y-1 px-4 py-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      )}

      {data && !isPending && (
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#F3F4F0] shadow-[0_1px_0_#E2E6DC]">
              <tr className="border-b border-[#E2E6DC]">
                {sortableHead('Quote Ref', 'quote_ref')}
                {sortableHead('Date', 'date_raised')}
                {sortableHead('Customer', 'customer_name')}
                {sortableHead('Product', 'product')}
                {sortableHead('Value', 'quoted_value', 'right')}
                {sortableHead('Status', 'display_status')}
                {sortableHead('Owner', 'salesperson')}
                {sortableHead('Expiry', 'expiry_date', 'right')}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-surface-muted">
                    No quotations match the current filters.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => {
                const warn = row.expiry_warning && row.display_status === 'expiring_soon'
                return (
                  <tr
                    key={row.quotation_id}
                    className={cn(
                      'border-b border-[#F0F1ED] hover:bg-[#F8F9F6]',
                      warn && 'bg-amber-50/80',
                    )}
                  >
                    <td className="px-2 py-1.5 font-mono text-[11px] font-medium text-gray-900">
                      {row.quote_ref}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-gray-700 whitespace-nowrap">
                      {formatListDate(row.date_raised)}
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-1.5 text-gray-900" title={row.customer_name}>
                      {row.customer_name}
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-1.5 text-gray-700" title={row.product}>
                      {row.product}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">
                      {formatCurrency(row.quoted_value)}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold',
                          QUOTATION_REGISTER_STATUS_PILL[row.display_status],
                        )}
                      >
                        {quotationRegisterStatusLabel(row.display_status)}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-1.5 text-gray-700" title={row.salesperson}>
                      {row.salesperson}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                      <span className={cn('inline-flex items-center justify-end gap-1', warn && 'text-amber-800 font-medium')}>
                        {warn && (
                          <AlertTriangle className="size-3 shrink-0 text-amber-600" aria-label="Expiring within 7 days" />
                        )}
                        {formatListDate(row.expiry_date)}
                      </span>
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
