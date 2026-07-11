'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import ListingExportDialog from '@/components/listing/ListingExportDialog'
import type { ListingExportRange } from '@/lib/listingExportRange'

type Props = {
  label?: string
  dialogTitle: string
  dialogDescription?: string
  onExport: (range: ListingExportRange) => Promise<void>
  disabled?: boolean
}

export default function ListingExportButton({
  label = 'Export',
  dialogTitle,
  dialogDescription,
  onExport,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <ListingExportDialog
        open={open}
        onOpenChange={setOpen}
        title={dialogTitle}
        description={dialogDescription}
        onExport={onExport}
      />
    </>
  )
}
