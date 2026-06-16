'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PurchaseOrderListItem } from '@/types'

type Props = {
  po: PurchaseOrderListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  busy?: boolean
  error?: string | null
}

export default function DeletePurchaseOrderDialog({
  po,
  open,
  onOpenChange,
  onConfirm,
  busy = false,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete purchase order?</DialogTitle>
          <DialogDescription>
            {po ? (
              <>
                <span className="font-medium text-gray-900">{po.po_number}</span> for{' '}
                <span className="font-medium text-gray-900">{po.client_name}</span> will be permanently
                deleted. This action cannot be undone.
              </>
            ) : (
              'This purchase order will be permanently deleted.'
            )}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={busy || !po} onClick={onConfirm}>
            {busy ? 'Deleting…' : 'Delete PO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
