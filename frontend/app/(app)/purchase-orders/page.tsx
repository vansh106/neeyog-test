'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Download, Eye, Plus, Search, ClipboardList } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CreatePurchaseOrderDialog from '@/components/purchase-orders/CreatePurchaseOrderDialog'
import ArchivePurchaseOrderDialog from '@/components/purchase-orders/ArchivePurchaseOrderDialog'
import { usePurchaseOrdersListingDataset } from '@/lib/queries'
import { downloadPurchaseOrderPdf, purchaseOrdersApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import type { PurchaseOrderListItem } from '@/types'

function formatPoDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient()
  const canCreate = useAuthStore((s) => s.hasPermission(Permissions.CREATE_PURCHASE_ORDERS))
  const canArchive = useAuthStore((s) => s.hasPermission(Permissions.DELETE_PURCHASE_ORDERS))
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<PurchaseOrderListItem | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const { data, isPending } = usePurchaseOrdersListingDataset(2000)
  const rows = data ?? []

  const archiveMut = useMutation({
    mutationFn: (poId: string) => purchaseOrdersApi.archive<{ po_id: string; archived: boolean }>(poId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      setArchiveTarget(null)
      setArchiveError(null)
    },
    onError: (e: unknown) => {
      setArchiveError(e instanceof Error ? e.message : 'Failed to archive purchase order')
    },
  })

  const list = useMemo(() => {
    return rows.filter((po) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const blob = `${po.po_number} ${po.client_name} ${po.quote_number ?? ''} ${po.item_desc_short}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      if (clientFilter && !po.client_name.toLowerCase().includes(clientFilter.toLowerCase())) return false
      if (typeFilter === 'quoted' && po.po_type !== 'quoted') return false
      if (typeFilter === 'non_quoted' && po.po_type !== 'non_quoted') return false
      return true
    })
  }, [rows, search, clientFilter, typeFilter])

  const totalValue = list.reduce((sum, po) => sum + po.total_amount, 0)

  return (
    <PageShell
      title="Purchase Orders"
      subtitle="Customer purchase orders — linked to quotations or created manually."
      actions={
        canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create PO
          </Button>
        ) : null
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9488]" />
          <Input
            className="pl-9"
            placeholder="Search PO, client, quote…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          className="w-44"
          placeholder="Client name"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
        />
        <select
          className="h-10 rounded-md border border-[#E2E6DC] bg-white px-3 text-[13px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          <option value="quoted">Quoted</option>
          <option value="non_quoted">Non-quoted</option>
        </select>
      </div>

      <div className="mb-3 text-[13px] text-surface-muted">
        {list.length} PO{list.length === 1 ? '' : 's'} · Total {formatCurrency(totalValue)}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E2E6DC] bg-white">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead className="bg-[#FAFAF8] text-[11px] uppercase tracking-wide text-[#8A9488]">
            <tr>
              <th className="px-4 py-3">PO no / date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type / quote ref</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Item desc</th>
              <th className="px-4 py-3 text-right">PO ₹</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-[#E2E6DC]">
                  <td colSpan={8} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
            {!isPending && list.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={ClipboardList}
                    title="No purchase orders"
                    description="Create your first PO to get started."
                  />
                </td>
              </tr>
            )}
            {list.map((po) => (
              <PoRow
                key={po.po_id}
                po={po}
                pdfBusy={pdfBusyId === po.po_id}
                canArchive={canArchive}
                onDownload={async () => {
                  setPdfBusyId(po.po_id)
                  try {
                    await downloadPurchaseOrderPdf(po.po_id, `${po.po_number}.pdf`)
                  } finally {
                    setPdfBusyId(null)
                  }
                }}
                onArchive={() => {
                  setArchiveError(null)
                  setArchiveTarget(po)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <CreatePurchaseOrderDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ArchivePurchaseOrderDialog
        po={archiveTarget}
        open={archiveTarget != null}
        onOpenChange={(next) => {
          if (!next && !archiveMut.isPending) {
            setArchiveTarget(null)
            setArchiveError(null)
          }
        }}
        busy={archiveMut.isPending}
        error={archiveError}
        onConfirm={() => {
          if (!archiveTarget) return
          archiveMut.mutate(archiveTarget.po_id)
        }}
      />
    </PageShell>
  )
}

function PoRow({
  po,
  pdfBusy,
  canArchive,
  onDownload,
  onArchive,
}: {
  po: PurchaseOrderListItem
  pdfBusy: boolean
  canArchive: boolean
  onDownload: () => void
  onArchive: () => void
}) {
  return (
    <tr className="border-t border-[#E2E6DC] hover:bg-[#FAFAF8]/80">
      <td className="px-4 py-3">
        <Link href={`/purchase-orders/${po.po_id}`} className="font-medium text-brand-navy-700 hover:underline">
          {po.po_number}
        </Link>
        <p className="text-[12px] text-surface-muted">{formatPoDate(po.created_at)}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{po.client_name}</p>
        {po.client_company && <p className="text-[12px] text-surface-muted">{po.client_company}</p>}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium capitalize text-gray-900">
          {po.po_type === 'quoted' ? 'Quoted' : 'Non-quoted'}
        </p>
        {po.quote_number && po.quotation_id ? (
          <Link
            href={`/quotations/${po.quotation_id}`}
            className="text-[12px] text-brand-navy-600 hover:underline"
          >
            {po.quote_number}
          </Link>
        ) : (
          <span className="text-[12px] text-surface-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">{po.primary_category}</td>
      <td className="max-w-[180px] truncate px-4 py-3 text-[12px] text-surface-muted" title={po.item_desc_short}>
        {po.item_desc_short}
      </td>
      <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(po.total_amount)}</td>
      <td className="px-4 py-3 text-[12px] text-surface-muted">{po.created_by_name || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Link
            href={`/purchase-orders/${po.po_id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-8 w-8')}
            aria-label="View PO"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={pdfBusy} onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
          {canArchive ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 text-surface-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              aria-label={`Archive ${po.po_number}`}
              onClick={onArchive}
            >
              <Archive className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
