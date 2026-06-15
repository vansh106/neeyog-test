'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Download, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import PurchaseOrderFormatPreview from '@/components/purchase-orders/PurchaseOrderFormatPreview'
import { CreatePOButton } from '@/components/purchase-orders/CreatePurchaseOrderDialog'
import { usePurchaseOrder } from '@/lib/queries'
import { downloadPurchaseOrderPdf } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''
  const { data: po, isPending, isError } = usePurchaseOrder(id)
  const [pdfBusy, setPdfBusy] = useState(false)

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
      subtitle={`${po.client_name} · ${formatCurrency(po.total_amount)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {po.quotation_id && (
            <CreatePOButton fixedQuotationId={po.quotation_id} className="hidden sm:inline-flex" />
          )}
          <Button
            variant="outline"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true)
              try {
                await downloadPurchaseOrderPdf(po.po_id, `${po.po_number}.pdf`)
              } finally {
                setPdfBusy(false)
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      }
    >
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-surface-muted">
        <Link href="/purchase-orders" className="text-brand-green-600 hover:underline">
          Purchase Orders
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono text-brand-gold-500">{po.po_number}</span>
      </nav>

      <div className="mb-4 grid gap-3 rounded-xl border border-[#E2E6DC] bg-[#FFF8E7] p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase text-[#8A9488]">Type</p>
          <p className="font-medium">{po.po_type === 'quoted' ? 'Quoted' : 'Non-quoted'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#8A9488]">Quote ref</p>
          {po.quote_number && po.quotation_id ? (
            <Link href={`/quotations/${po.quotation_id}`} className="font-medium text-brand-navy-700 hover:underline">
              {po.quote_number}
            </Link>
          ) : (
            <p>—</p>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#8A9488]">Category</p>
          <p className="font-medium">{po.primary_category}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#8A9488]">Created by</p>
          <p className="font-medium">{po.created_by_name || '—'}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E2E6DC] bg-[#F4F5F0] p-4 sm:p-6">
        <PurchaseOrderFormatPreview po={po} />
      </div>
    </PageShell>
  )
}
