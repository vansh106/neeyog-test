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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { purchaseOrdersApi } from '@/lib/api'
import type { PurchaseOrder } from '@/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  po: PurchaseOrder
  onSaved: (po: PurchaseOrder) => void
}

export default function PurchaseOrderOverviewEditor({ open, onOpenChange, po, onSaved }: Props) {
  const [soNumber, setSoNumber] = useState(po.so_number ?? '')
  const [soDate, setSoDate] = useState('')
  const [notes, setNotes] = useState(po.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSoNumber(po.so_number ?? '')
    setSoDate(po.so_date?.slice(0, 10) ?? '')
    setNotes(po.notes ?? '')
    setError(null)
  }, [open, po])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await purchaseOrdersApi.update<PurchaseOrder>(po.po_id, {
        so_number: soNumber.trim() || undefined,
        so_date: soDate.trim() || null,
        notes: notes.trim() || undefined,
      })
      onSaved(updated)
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit order details</DialogTitle>
          <DialogDescription>Update SO number, SO date, and internal notes for this purchase order.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block text-[12px]">
            <span className="text-surface-muted">SO number (optional)</span>
            <Input
              className="mt-1"
              value={soNumber}
              onChange={(e) => setSoNumber(e.target.value)}
              placeholder="e.g. SO-332"
              disabled={saving}
            />
          </label>
          <label className="block text-[12px]">
            <span className="text-surface-muted">SO date (optional)</span>
            <Input
              type="date"
              className="mt-1"
              value={soDate}
              onChange={(e) => setSoDate(e.target.value)}
              disabled={saving}
            />
          </label>
          <label className="block text-[12px]">
            <span className="text-surface-muted">Notes (optional)</span>
            <Textarea
              className="mt-1 min-h-[100px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this PO…"
              disabled={saving}
            />
          </label>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>

        <DialogFooter>
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
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
