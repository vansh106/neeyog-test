'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ManualClientDetailsSection from '@/components/clients/ManualClientDetailsSection'
import { purchaseOrdersApi } from '@/lib/api'
import { useManualClientPicker } from '@/lib/manualClientPicker'
import type { PurchaseOrder } from '@/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  po: PurchaseOrder
  onSaved: (po: PurchaseOrder) => void
}

export default function PurchaseOrderClientEditor({ open, onOpenChange, po, onSaved }: Props) {
  const clientPicker = useManualClientPicker()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      clientPicker.reset()
      return
    }
    clientPicker.setCompanyQuery(po.client_company || po.client_name || '')
    setError(null)
    // Only re-init when dialog opens for a PO
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, po.po_id])

  async function handleSave() {
    if (!clientPicker.validate()) {
      setError('Please select or add a client')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const client = clientPicker.getSnapshot()
      const updated = await purchaseOrdersApi.update<PurchaseOrder>(po.po_id, {
        client_name: client.client_name,
        client_company: client.client_company,
        client_email: client.client_email,
        client_phone: client.client_phone,
        client_employee_id: client.client_employee_id,
      })
      onSaved(updated)
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#E2E6DC] px-6 py-4 text-left">
          <DialogTitle>Edit client</DialogTitle>
          <DialogDescription>
            Change the client on this manually created purchase order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 rounded-lg border border-[#E2E6DC] bg-[#FAFAF8] p-3 text-[13px]">
            <p className="text-surface-muted">Current</p>
            <p className="mt-1 font-medium text-gray-900">{po.client_company || po.client_name}</p>
            {po.client_name && po.client_company && po.client_name !== po.client_company ? (
              <p className="text-surface-muted">{po.client_name}</p>
            ) : null}
          </div>
          <ManualClientDetailsSection {...clientPicker} disabled={saving} />
          {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}
        </div>

        <DialogFooter className="border-t border-[#E2E6DC] px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save client'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
