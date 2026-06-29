'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import EditEnquiryProductNotesDialog from '@/components/enquiries/EditEnquiryProductNotesDialog'
import { Button } from '@/components/ui/button'
import {
  parseProductNotesFromParsedData,
  productNoteHierarchyLabel,
  productNotePrimaryLabel,
} from '@/lib/enquiryMasterNotes'

type Props = {
  enquiryId: string
  parsed: Record<string, unknown> | null | undefined
}

export default function EnquiryProductNotesPanel({ enquiryId, parsed }: Props) {
  const productNotes = parseProductNotesFromParsedData(parsed)
  const [editOpen, setEditOpen] = useState(false)

  if (productNotes.length === 0) return null

  return (
    <>
      <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-gray-900">Notes for products</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-[12px] text-surface-muted hover:text-gray-900"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        <ul className="mt-3 space-y-3">
          {productNotes.map((note, index) => {
            const hierarchy = productNoteHierarchyLabel(note)
            return (
              <li
                key={`${index}-${note.family}-${note.category}-${note.subCategory}`}
                className="rounded-lg border border-[#E8EBE4] bg-[#FAFAF8] px-3 py-2.5"
              >
                <p className="text-[13px] font-medium text-gray-900">
                  Product {index + 1}: {productNotePrimaryLabel(note)}
                </p>
                {hierarchy ? (
                  <p className="mt-0.5 text-[12px] text-surface-muted">{hierarchy}</p>
                ) : null}
                {note.details ? (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                    {note.details}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <EditEnquiryProductNotesDialog
        enquiryId={enquiryId}
        open={editOpen}
        onOpenChange={setEditOpen}
        initialNotes={productNotes}
      />
    </>
  )
}
