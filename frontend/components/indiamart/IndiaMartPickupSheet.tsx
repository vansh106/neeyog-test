'use client'

import { useEffect, useState } from 'react'
import { Loader2, HandMetal } from 'lucide-react'

import ManualEntryForm from '@/components/upload/ManualEntryForm'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { indiamartApi } from '@/lib/api'
import type { IndiaMartPickupResponse, IndiaMartPrefillResponse, ManualEnquiryCreateForm } from '@/types'

type Props = {
  queryId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickedUp: (result: IndiaMartPickupResponse) => void
}

export default function IndiaMartPickupSheet({ queryId, open, onOpenChange, onPickedUp }: Props) {
  const [prefill, setPrefill] = useState<IndiaMartPrefillResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pickupError, setPickupError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !queryId) {
      setPrefill(null)
      setLoadError(null)
      setPickupError(null)
      return
    }
    let cancelled = false
    indiamartApi
      .getPrefill<IndiaMartPrefillResponse>(queryId)
      .then((data) => {
        if (cancelled) return
        if (!(data.can_pickup ?? data.can_create_inquiry) && data.linked_enquiry_id) {
          setLoadError('This lead has already been picked up.')
          setPrefill(null)
          return
        }
        setPrefill(data)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled) {
          setPrefill(null)
          setLoadError(e instanceof Error ? e.message : 'Could not load lead details')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, queryId])

  const handlePickup = async (form: ManualEnquiryCreateForm) => {
    if (!queryId || busy) return
    setBusy(true)
    setPickupError(null)
    try {
      const result = await indiamartApi.pickupQuery<IndiaMartPickupResponse>(queryId, {
        ...form,
        source: 'indiamart',
      })
      onPickedUp(result)
      onOpenChange(false)
    } catch (e) {
      setPickupError(e instanceof Error ? e.message : 'Pickup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HandMetal className="size-5 text-brand-green-600" />
            Pick up IndiaMart lead
          </SheetTitle>
          <SheetDescription>
            Review the client details, then pick up to create an enquiry with the IndiaMart source message.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {prefill?.notes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[13px] text-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Source message</p>
              <p className="mt-2 whitespace-pre-wrap">{prefill.notes}</p>
            </div>
          )}

          {loadError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{loadError}</p>
          )}

          {pickupError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{pickupError}</p>
          )}

          {!loadError && prefill && queryId && (
            <ManualEntryForm
              key={queryId}
              stage="client"
              isProcessing={busy}
              onSubmitManual={() => {}}
              onCreateEnquiry={handlePickup}
              prefillNotesFromEnquiry={prefill.notes}
              matcherClientHint={prefill.client_hint}
              initialEnquirySource="indiamart"
              clientStageSubmitLabel="Pick up lead →"
            />
          )}

          {!loadError && !prefill && open && queryId && (
            <div className="flex items-center gap-2 text-[13px] text-surface-muted">
              <Loader2 className="size-4 animate-spin" />
              Loading lead…
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
