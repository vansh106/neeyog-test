'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PurchaseOrderDetailView from '@/components/purchase-orders/PurchaseOrderDetailView'
import PurchaseOrderFinancialEditor from '@/components/purchase-orders/PurchaseOrderFinancialEditor'
import PurchaseOrderOverviewEditor from '@/components/purchase-orders/PurchaseOrderOverviewEditor'
import PurchaseOrderClientEditor from '@/components/purchase-orders/PurchaseOrderClientEditor'
import PurchaseOrderQuotedLinesEditor from '@/components/purchase-orders/PurchaseOrderQuotedLinesEditor'
import QuotationLineItemsEditor from '@/components/quotations/QuotationLineItemsEditor'
import { CreatePOButton } from '@/components/purchase-orders/CreatePurchaseOrderDialog'
import { purchaseOrdersApi } from '@/lib/api'
import { usePurchaseOrder, useQuotation } from '@/lib/queries'
import {
  manualLineItemsToAssembledProducts,
  quotationLinesToFallbackManualItems,
} from '@/lib/quotationPrefillAssembly'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { AssembledProduct, PurchaseOrder } from '@/types'

const PO_EDIT_DIALOG_CLASS =
  'flex max-h-[92vh] w-[calc(100vw-20rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2.5rem)]'

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''
  const queryClient = useQueryClient()
  const canEdit = useAuthStore((s) => s.hasPermission(Permissions.CREATE_PURCHASE_ORDERS))
  const canCreatePO = useAuthStore((s) => s.hasPermission(Permissions.CREATE_PURCHASE_ORDERS))

  const { data: po, isPending, isError } = usePurchaseOrder(id)
  const { data: linkedQuotation, isPending: quotationLoading } = useQuotation(po?.quotation_id ?? '')

  const [overviewOpen, setOverviewOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [financialOpen, setFinancialOpen] = useState(false)
  const [quotedLinesOpen, setQuotedLinesOpen] = useState(false)
  const [manualLinesOpen, setManualLinesOpen] = useState(false)
  const [editSession, setEditSession] = useState(0)

  const prefillAssembledProducts = useMemo(() => {
    if (!po?.line_items) return []
    const built = manualLineItemsToAssembledProducts(
      quotationLinesToFallbackManualItems(po.line_items),
    )
    return built.map((p) => JSON.parse(JSON.stringify(p)) as AssembledProduct)
  }, [po?.line_items, editSession])

  const handlePoSaved = useCallback(
    (updated: PurchaseOrder) => {
      queryClient.setQueryData(['purchase-order', id], updated)
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    [queryClient, id],
  )

  const openProductsEditor = useCallback(() => {
    if (!po) return
    setEditSession((n) => n + 1)
    if (po.po_type === 'quoted') {
      setQuotedLinesOpen(true)
    } else {
      setManualLinesOpen(true)
    }
  }, [po])

  if (isPending) {
    return (
      <PageShell title="Purchase Order">
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </PageShell>
    )
  }

  if (isError || !po) {
    return (
      <PageShell title="Purchase Order">
        <EmptyState
          icon={ClipboardList}
          title="PO not found"
          description="This purchase order may have been removed."
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title={po.po_number}
      subtitle={`${po.client_name} · ${formatCurrency(po.total_amount)}${po.so_number ? ` · ${po.so_number}` : ''}`}
      actions={
        po.quotation_id && canCreatePO ? (
          <CreatePOButton fixedQuotationId={po.quotation_id} className="hidden sm:inline-flex" />
        ) : null
      }
    >
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
        <Link href="/purchase-orders" className="text-brand-green-600 hover:underline">
          Purchase Orders
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono text-brand-gold-500">{po.po_number}</span>
      </nav>

      <div className="space-y-6">
        <PurchaseOrderDetailView
          po={po}
          canEdit={canEdit}
          onEditOverview={() => setOverviewOpen(true)}
          onEditClient={() => setClientOpen(true)}
          onEditProducts={openProductsEditor}
          onEditFinancial={() => setFinancialOpen(true)}
        />
      </div>

      <Dialog open={financialOpen} onOpenChange={setFinancialOpen}>
        <DialogContent className={PO_EDIT_DIALOG_CLASS}>
          <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
            <DialogTitle>Edit financial summary</DialogTitle>
            <DialogDescription>
              Adjust P&amp;F, freight, and taxes. Changes apply to this purchase order&apos;s totals.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <PurchaseOrderFinancialEditor
              po={po}
              onSaved={(updated) => {
                handlePoSaved(updated)
                setFinancialOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <PurchaseOrderOverviewEditor
        open={overviewOpen}
        onOpenChange={setOverviewOpen}
        po={po}
        onSaved={handlePoSaved}
      />

      {po.po_type === 'non_quoted' && (
        <PurchaseOrderClientEditor
          open={clientOpen}
          onOpenChange={setClientOpen}
          po={po}
          onSaved={handlePoSaved}
        />
      )}

      {po.po_type === 'quoted' && (
        <PurchaseOrderQuotedLinesEditor
          open={quotedLinesOpen}
          onOpenChange={setQuotedLinesOpen}
          po={po}
          quotation={linkedQuotation}
          quotationLoading={quotationLoading}
          onSaved={handlePoSaved}
        />
      )}

      {po.po_type === 'non_quoted' && (
        <Dialog open={manualLinesOpen} onOpenChange={setManualLinesOpen}>
          <DialogContent className={PO_EDIT_DIALOG_CLASS}>
            <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
              <DialogTitle>Edit products</DialogTitle>
              <DialogDescription>
                Add, remove, or reconfigure products on this manually created purchase order.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <QuotationLineItemsEditor
                key={`${po.po_id}-edit-${editSession}`}
                prefillRevision={editSession}
                initialAssembledProducts={prefillAssembledProducts}
                onCancel={() => setManualLinesOpen(false)}
                onSaved={() => {
                  void queryClient.refetchQueries({ queryKey: ['purchase-order', id] })
                  setManualLinesOpen(false)
                }}
                saveHandler={async (lineItems) => {
                  const updated = await purchaseOrdersApi.update<PurchaseOrder>(po.po_id, {
                    manual_line_items: lineItems,
                  })
                  handlePoSaved(updated)
                }}
                saveLabel="Save products"
                title="Products"
                description="Edit lines, then save to refresh PO totals."
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  )
}
