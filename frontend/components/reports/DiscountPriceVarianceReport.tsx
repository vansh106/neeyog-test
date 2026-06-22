'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Loader2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PermissionGate } from '@/components/auth/PermissionGate'
import DashboardKpiCard from '@/components/dashboard/DashboardKpiCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { DiscountPriceVarianceRow } from '@/lib/api'
import { useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import {
  approvalStatusLabel,
  approvalStatusPillClass,
  DISCOUNT_BAND_OPTIONS,
  discountPctCellClass,
  type DiscountBand,
  variancePctCellClass,
} from '@/lib/discountVariance'
import {
  exportDiscountPriceVarianceReport,
  type DiscountPriceVarianceExportFormat,
} from '@/lib/exportDiscountPriceVarianceReport'
import { formatCompactINR } from '@/lib/formatCompactINR'
import { Permissions } from '@/lib/permissions'
import { cn, formatCurrency } from '@/lib/utils'

type SortKey =
  | 'reference'
  | 'customer_name'
  | 'product'
  | 'list_price'
  | 'quoted_price'
  | 'final_po_price'
  | 'discount_pct'
  | 'variance_pct'
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

function sortRows(rows: DiscountPriceVarianceRow[], sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortKey === 'discount_pct' || sortKey === 'variance_pct' || sortKey === 'list_price' || sortKey === 'quoted_price' || sortKey === 'final_po_price') {
      return (a[sortKey] - b[sortKey]) * factor
    }
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor
  })
}

export default function DiscountPriceVarianceReport() {
  const { bundle, isPending, isError, error, isFetching } = useReportsBundleContext()
  const data = bundle?.discount_price_variance
  const [salespersonId, setSalespersonId] = useState('__all__')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [discountBand, setDiscountBand] = useState<DiscountBand | '__all__'>('__all__')
  const [sortKey, setSortKey] = useState<SortKey>('discount_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [exportBusy, setExportBusy] = useState(false)

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((row) => {
      if (salespersonId !== '__all__') {
        const rowId = row.salesperson_id ?? '__unassigned__'
        if (rowId !== salespersonId) return false
      }
      if (categoryFilter !== '__all__' && row.category !== categoryFilter) return false
      if (discountBand !== '__all__' && row.discount_band !== discountBand) return false
      return true
    })
  }, [data, salespersonId, categoryFilter, discountBand])

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  )

  const summary = useMemo(() => {
    const discounted = filteredRows.filter((r) => r.discount_pct > 0)
    const avg =
      discounted.length > 0
        ? discounted.reduce((s, r) => s + r.discount_pct, 0) / discounted.length
        : 0
    return {
      avg_discount_pct: Math.round(avg * 100) / 100,
      total_discount_value: Math.round(discounted.reduce((s, r) => s + r.discount_value, 0) * 100) / 100,
      discounted_deal_count: discounted.length,
    }
  }, [filteredRows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'discount_pct' || key === 'final_po_price' ? 'desc' : 'asc')
    }
  }

  async function handleExport(format: DiscountPriceVarianceExportFormat) {
    if (!data) return
    setExportBusy(true)
    try {
      exportDiscountPriceVarianceReport(data, sortedRows, format)
    } finally {
      setExportBusy(false)
    }
  }

  function sortableHead(label: string, key: SortKey, align: 'left' | 'right' = 'left') {
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
            <h2 className="text-[15px] font-semibold text-gray-900">Discount / Price Variance</h2>
            <p className="text-[12px] text-surface-muted">
              List vs quoted vs final PO pricing — margin and discount discipline
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

        <div className="flex flex-wrap items-end gap-3 border-b border-[#E2E6DC] px-4 py-3">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Salesperson</span>
            <Select value={salespersonId} onValueChange={(v) => setSalespersonId(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[160px] bg-white text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {(data?.salespeople ?? []).map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Category</span>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? '__all__')}>
              <SelectTrigger className="h-8 w-[160px] bg-white text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {(data?.categories ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase text-surface-muted">Discount band</span>
            <Select
              value={discountBand}
              onValueChange={(v) => setDiscountBand((v ?? '__all__') as DiscountBand | '__all__')}
            >
              <SelectTrigger className="h-8 w-[160px] bg-white text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_BAND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        {!isPending && (
          <div className="grid gap-3 border-b border-[#E2E6DC] p-4 sm:grid-cols-3">
            <DashboardKpiCard
              title="Average discount %"
              primaryValue={`${summary.avg_discount_pct}%`}
            />
            <DashboardKpiCard
              title="Total discount value"
              primaryValue={formatCompactINR(summary.total_discount_value)}
              secondaryText={formatCurrency(summary.total_discount_value)}
            />
            <DashboardKpiCard
              title="Deals with discount"
              primaryValue={summary.discounted_deal_count.toLocaleString('en-IN')}
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
            <table className="w-full min-w-[1100px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#F3F4F0]">
                <tr className="border-b border-[#E2E6DC]">
                  {sortableHead('PO / Quote', 'reference')}
                  {sortableHead('Customer', 'customer_name')}
                  {sortableHead('Product', 'product')}
                  {sortableHead('List ₹', 'list_price', 'right')}
                  {sortableHead('Quoted ₹', 'quoted_price', 'right')}
                  {sortableHead('Final PO ₹', 'final_po_price', 'right')}
                  {sortableHead('Discount %', 'discount_pct', 'right')}
                  {sortableHead('Variance %', 'variance_pct', 'right')}
                  {sortableHead('Salesperson', 'salesperson')}
                  <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide">Approval</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-surface-muted">
                      No POs in this period match your filters.
                    </td>
                  </tr>
                )}
                {sortedRows.map((row) => (
                  <tr key={row.po_id} className="border-b border-[#F0F1ED] hover:bg-[#F8F9F6]">
                    <td className="px-2 py-1.5">
                      <p className="font-mono font-medium text-gray-900">{row.reference}</p>
                      {row.quote_ref !== '—' && (
                        <p className="font-mono text-[11px] text-surface-muted">{row.quote_ref}</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{row.customer_name}</td>
                    <td className="max-w-[180px] truncate px-2 py-1.5" title={row.product}>
                      {row.product}
                      <p className="text-[11px] text-surface-muted">{row.category}</p>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatCurrency(row.list_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatCurrency(row.quoted_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                      {formatCurrency(row.final_po_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={cn(
                          'inline-flex min-w-[3rem] justify-center rounded px-1.5 py-0.5 font-mono tabular-nums text-[11px] font-semibold',
                          discountPctCellClass(row.discount_pct),
                        )}
                      >
                        {row.discount_pct}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={cn(
                          'inline-flex min-w-[3rem] justify-center rounded px-1.5 py-0.5 font-mono tabular-nums text-[11px] font-semibold',
                          variancePctCellClass(row.variance_pct),
                        )}
                      >
                        {row.variance_pct > 0 ? `−${row.variance_pct}` : row.variance_pct}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-surface-muted">{row.salesperson}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                          approvalStatusPillClass(row.approval_status),
                        )}
                      >
                        {approvalStatusLabel(row.approval_status)}
                      </span>
                    </td>
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
