'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Eye, Plus, ClipboardList } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import CreatePurchaseOrderDialog from '@/components/purchase-orders/CreatePurchaseOrderDialog'
import DeletePurchaseOrderDialog from '@/components/purchase-orders/DeletePurchaseOrderDialog'
import EnterPoSoNumberDialog from '@/components/purchase-orders/EnterPoSoNumberDialog'
import PurchaseOrderListingFilters from '@/components/purchase-orders/PurchaseOrderListingFilters'
import ListingPagination from '@/components/listing/ListingPagination'
import { usePurchaseOrdersListingDataset } from '@/lib/queries'
import {
  collectPurchaseOrderFilterOptions,
  DEFAULT_PO_FILTERS,
  filterPurchaseOrdersLocal,
  purchaseOrderAmountBounds,
  purchaseOrderFiltersActive,
  type LocalPurchaseOrderFilters,
} from '@/lib/filterPurchaseOrdersLocal'
import ListingExportButton from '@/components/listing/ListingExportButton'
import { exportPurchaseOrdersListingExcel } from '@/lib/exportPurchaseOrdersListing'
import { purchaseOrdersApi } from '@/lib/api'
import { invalidateQuotationCrmCaches } from '@/lib/invalidateQuotationCrmCaches'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import { listingPageSlice, listingSerialNumber } from '@/lib/listingPagination'
import type { PurchaseOrderListItem } from '@/types'

const PO_LIST_COL_COUNT = 10

function formatPoDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function formatSoDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const d = iso.slice(0, 10)
  const parsed = new Date(`${d}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SO_ENTRY_DEADLINE_MS = 24 * 60 * 60 * 1000

function isSoDateMissing(soDate?: string | null): boolean {
  return !soDate?.trim()
}

function isSoDateEntryOverdue(createdAt: string, soDate?: string | null): boolean {
  if (!isSoDateMissing(soDate)) return false
  const createdMs = new Date(createdAt).getTime()
  if (Number.isNaN(createdMs)) return false
  return Date.now() - createdMs >= SO_ENTRY_DEADLINE_MS
}

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient()
  const canCreate = useAuthStore((s) => s.hasPermission(Permissions.CREATE_PURCHASE_ORDERS))
  const canDelete = useAuthStore((s) => s.hasPermission(Permissions.DELETE_PURCHASE_ORDERS))
  const [createOpen, setCreateOpen] = useState(false)
  const [soEntryTarget, setSoEntryTarget] = useState<PurchaseOrderListItem | null>(null)
  const [filters, setFilters] = useState<LocalPurchaseOrderFilters>(DEFAULT_PO_FILTERS)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data, isPending } = usePurchaseOrdersListingDataset(2000)
  const rows = data ?? []

  const amountBounds = useMemo(() => purchaseOrderAmountBounds(rows), [rows])
  const filterOptions = useMemo(() => collectPurchaseOrderFilterOptions(rows), [rows])

  useEffect(() => {
    setFilters((prev) => {
      if (prev.boundsMin === amountBounds.min && prev.boundsMax === amountBounds.max) return prev
      return {
        ...prev,
        boundsMin: amountBounds.min,
        boundsMax: amountBounds.max,
        amountMin: amountBounds.min,
        amountMax: amountBounds.max,
      }
    })
  }, [amountBounds.min, amountBounds.max])

  const deleteMut = useMutation({
    mutationFn: (poId: string) => purchaseOrdersApi.delete<{ po_id: string; deleted: boolean }>(poId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      if (deleteTarget?.quotation_id) {
        await invalidateQuotationCrmCaches(queryClient)
      }
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (e: unknown) => {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete purchase order')
    },
  })

  const list = useMemo(() => filterPurchaseOrdersLocal(rows, filters), [rows, filters])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const pagedList = useMemo(() => listingPageSlice(list, page), [list, page])

  const totalValue = list.reduce((sum, po) => sum + po.subtotal, 0)

  const clearFilters = () => {
    setFilters({
      ...DEFAULT_PO_FILTERS,
      boundsMin: amountBounds.min,
      boundsMax: amountBounds.max,
      amountMin: amountBounds.min,
      amountMax: amountBounds.max,
    })
  }

  const hasActiveFilters = purchaseOrderFiltersActive(filters)

  return (
    <PageShell
      title="Purchase Orders"
      subtitle="Customer purchase orders — linked to quotations or created manually."
      actions={
        <div className="flex items-center gap-2">
          <ListingExportButton
            dialogTitle="Export purchase orders"
            dialogDescription="Choose a time period. Multi-line POs use the same row color per order."
            onExport={(range) => exportPurchaseOrdersListingExcel(list, range)}
            disabled={isPending || list.length === 0}
          />
          {canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create PO
            </Button>
          ) : null}
        </div>
      }
    >
      <PurchaseOrderListingFilters
        filters={filters}
        onChange={setFilters}
        categoryOptions={filterOptions.categories}
        userOptions={filterOptions.users}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="mb-3 text-[13px] text-surface-muted">
        {list.length} PO{list.length === 1 ? '' : 's'} · Total {formatCurrency(totalValue)}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E2E6DC] bg-white">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead className="bg-[#FAFAF8] text-[11px] uppercase tracking-wide text-[#8A9488]">
            <tr>
              <th className="px-4 py-3">S.No.</th>
              <th className="px-4 py-3">PO no / date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type / quote ref</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Item desc</th>
              <th className="px-4 py-3 text-right">PO ₹</th>
              <th className="px-4 py-3">SO no.</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-[#E2E6DC]">
                  <td colSpan={PO_LIST_COL_COUNT} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
            {!isPending && list.length === 0 && (
              <tr>
                <td colSpan={PO_LIST_COL_COUNT}>
                  <EmptyState
                    icon={ClipboardList}
                    title={hasActiveFilters ? 'No matching purchase orders' : 'No purchase orders'}
                    description={
                      hasActiveFilters
                        ? 'Try adjusting search or filters.'
                        : 'Create your first PO to get started.'
                    }
                  />
                </td>
              </tr>
            )}
            {pagedList.map((po, index) => (
              <PoRow
                key={po.po_id}
                po={po}
                serialNumber={listingSerialNumber(page, index, undefined, list.length)}
                canDelete={canDelete}
                canEnterSo={canCreate}
                onEnterSo={() => setSoEntryTarget(po)}
                onDelete={() => {
                  setDeleteError(null)
                  setDeleteTarget(po)
                }}
              />
            ))}
          </tbody>
        </table>
        {!isPending && list.length > 0 ? (
          <ListingPagination page={page} totalItems={list.length} onPageChange={setPage} />
        ) : null}
      </div>

      <CreatePurchaseOrderDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EnterPoSoNumberDialog
        po={soEntryTarget}
        open={soEntryTarget != null}
        onOpenChange={(next) => {
          if (!next) setSoEntryTarget(null)
        }}
      />

      <DeletePurchaseOrderDialog
        po={deleteTarget}
        open={deleteTarget != null}
        onOpenChange={(next) => {
          if (!next && !deleteMut.isPending) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        busy={deleteMut.isPending}
        error={deleteError}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteMut.mutate(deleteTarget.po_id)
        }}
      />
    </PageShell>
  )
}

function PoRow({
  po,
  serialNumber,
  canDelete,
  canEnterSo,
  onEnterSo,
  onDelete,
}: {
  po: PurchaseOrderListItem
  serialNumber: number
  canDelete: boolean
  canEnterSo: boolean
  onEnterSo: () => void
  onDelete: () => void
}) {
  const soDateMissing = isSoDateMissing(po.so_date)
  const soDateOverdue = isSoDateEntryOverdue(po.created_at, po.so_date)
  const soDateLabel = formatSoDate(po.so_date)

  return (
    <tr className="border-t border-[#E2E6DC] hover:bg-[#FAFAF8]/80">
      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-surface-muted">{serialNumber}</td>
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
      <td className="px-4 py-3 text-right">
        <p className="font-mono font-medium">{formatCurrency(po.subtotal)}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-mono text-[12px] text-gray-900">
          {po.so_number || <span className="text-surface-muted">—</span>}
        </p>
        {soDateLabel && (
          <p className="mt-0.5 text-[11px] text-surface-muted">{soDateLabel}</p>
        )}
        {soDateMissing &&
          (canEnterSo ? (
            <button
              type="button"
              onClick={onEnterSo}
              className={cn(
                'mt-0.5 text-left text-[11px] font-medium leading-snug underline-offset-2 hover:underline',
                soDateOverdue ? 'text-red-600' : 'text-brand-navy-600',
              )}
            >
              Enter SO date
            </button>
          ) : (
            <p
              className={cn(
                'mt-0.5 text-[11px] font-medium leading-snug',
                soDateOverdue ? 'text-red-600' : 'text-surface-muted',
              )}
            >
              Enter SO date
            </p>
          ))}
      </td>
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
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 text-surface-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              aria-label={`Delete ${po.po_number}`}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
