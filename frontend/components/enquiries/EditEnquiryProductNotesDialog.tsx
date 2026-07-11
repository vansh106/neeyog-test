'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import ProductNotesEditor from '@/components/enquiries/ProductNotesEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { enquiriesApi } from '@/lib/api'
import {
  createEmptyProductNote,
  parseProductNotesFromParsedData,
  serializeProductNotes,
  storedProductNotesToEntries,
  type ProductNoteEntry,
  type StoredEnquiryProductNote,
} from '@/lib/enquiryMasterNotes'

type Props = {
  enquiryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialNotes: StoredEnquiryProductNote[]
}

export default function EditEnquiryProductNotesDialog({
  enquiryId,
  open,
  onOpenChange,
  initialNotes,
}: Props) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ProductNoteEntry[]>(() =>
    initialNotes.length > 0 ? storedProductNotesToEntries(initialNotes) : [createEmptyProductNote()],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(
      initialNotes.length > 0 ? storedProductNotesToEntries(initialNotes) : [createEmptyProductNote()],
    )
    setError(null)
  }, [open, enquiryId])

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await enquiriesApi.updateProductNotes(enquiryId, {
        productNotes: serializeProductNotes(draft),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enquiry', enquiryId] }),
        queryClient.invalidateQueries({ queryKey: ['enquiries'] }),
      ])
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save product notes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,820px)] flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit product notes</DialogTitle>
          <DialogDescription>
            Update family, category, and sub-category for each product. Changes are saved to this
            enquiry.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          <ProductNotesEditor productNotes={draft} onProductNotesChange={setDraft} />
        </div>

        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

        <DialogFooter className="mt-2 shrink-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="bg-brand-green-600 hover:bg-brand-green-700"
            onClick={() => void handleSave()}
          >
            {busy ? 'Saving…' : 'Save notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
