'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

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
import {
  LISTING_EXPORT_RANGE_OPTIONS,
  validateListingExportRange,
  type ListingExportRange,
  type ListingExportRangePreset,
} from '@/lib/listingExportRange'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onExport: (range: ListingExportRange) => Promise<void>
}

function defaultSpecificMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function defaultFromDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function defaultToDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ListingExportDialog({
  open,
  onOpenChange,
  title,
  description = 'Choose a time period for the export. Only records created in that range are included.',
  onExport,
}: Props) {
  const [preset, setPreset] = useState<ListingExportRangePreset>('this_month')
  const [specificMonth, setSpecificMonth] = useState(defaultSpecificMonth)
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPreset('this_month')
    setSpecificMonth(defaultSpecificMonth())
    setFromDate(defaultFromDate())
    setToDate(defaultToDate())
    setBusy(false)
    setError(null)
  }, [open])

  const handleExport = async () => {
    const range: ListingExportRange = {
      preset,
      specificMonth: preset === 'specific_month' ? specificMonth : undefined,
      fromDate: preset === 'specific_date' ? fromDate : undefined,
      toDate: preset === 'specific_date' ? toDate : undefined,
    }
    const validationError = validateListingExportRange(range)
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onExport(range)
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {LISTING_EXPORT_RANGE_OPTIONS.map((opt) => (
            <label
              key={opt.preset}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] transition-colors',
                preset === opt.preset
                  ? 'border-brand-green-400 bg-brand-green-50/50'
                  : 'border-[#E2E6DC] hover:bg-[#FAFAF8]',
              )}
            >
              <input
                type="radio"
                name="export-range"
                className="accent-brand-green-600"
                checked={preset === opt.preset}
                onChange={() => setPreset(opt.preset)}
                disabled={busy}
              />
              <span className="font-medium text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>

        {preset === 'specific_month' && (
          <label className="block text-[12px]">
            <span className="text-surface-muted">Month</span>
            <Input
              type="month"
              className="mt-1"
              value={specificMonth}
              onChange={(e) => setSpecificMonth(e.target.value)}
              disabled={busy}
            />
          </label>
        )}

        {preset === 'specific_date' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px]">
              <span className="text-surface-muted">From date</span>
              <Input
                type="date"
                className="mt-1"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="block text-[12px]">
              <span className="text-surface-muted">To date</span>
              <Input
                type="date"
                className="mt-1"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
        )}

        {error && <p className="text-[13px] text-red-600">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleExport()} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {busy ? 'Exporting…' : 'Download Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
