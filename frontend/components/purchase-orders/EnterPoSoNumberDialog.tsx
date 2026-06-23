'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { purchaseOrdersApi } from '@/lib/api'
import type { PurchaseOrderListItem } from '@/types'

type Props = {
  po: PurchaseOrderListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EnterPoSoNumberDialog({ po, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [soNumber, setSoNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !po) return
    setSoNumber(po.so_number ?? '')
    setError(null)
  }, [open, po])

  async function handleSave() {
    if (!po) return
    const trimmed = soNumber.trim()
    if (!trimmed) {
      setError('Enter an SO number.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await purchaseOrdersApi.update(po.po_id, { so_number: trimmed })
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save SO number')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter SO number</DialogTitle>
          <DialogDescription>
            {po ? (
              <>
                {po.po_number}
                {po.client_name ? ` · ${po.client_name}` : ''}
              </>
            ) : (
              'Add the sales order number for this purchase order.'
            )}
          </DialogDescription>
        </DialogHeader>

        <label className="block text-[12px]">
          <span className="text-surface-muted">SO number</span>
          <Input
            className="mt-1 font-mono"
            value={soNumber}
            onChange={(e) => setSoNumber(e.target.value)}
            placeholder="e.g. SO-332"
            disabled={saving || !po}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSave()
              }
            }}
          />
        </label>

        {error && <p className="text-[13px] text-red-600">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !po}>
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
