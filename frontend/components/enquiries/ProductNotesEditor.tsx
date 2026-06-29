'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  buildEnquiryNotesFromProductNotes,
  createEmptyProductNote,
  getMasterNotesCategories,
  getMasterNotesFamilies,
  getMasterNotesSubCategories,
  type ProductNoteEntry,
} from '@/lib/enquiryMasterNotes'

export const productNoteSelectClass =
  'mt-1 h-9 w-full rounded-md border border-[#E2E6DC] bg-white px-2.5 text-[13px] text-gray-900 disabled:cursor-not-allowed disabled:opacity-50'

function ProductNoteCard({
  entry,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  entry: ProductNoteEntry
  index: number
  canRemove: boolean
  onChange: (next: ProductNoteEntry) => void
  onRemove: () => void
}) {
  const categories = getMasterNotesCategories(entry.family)
  const subCategories = getMasterNotesSubCategories(entry.family, entry.category)
  const hasSubCategories = subCategories.length > 0

  return (
    <div className="rounded-lg border border-surface-border bg-[#FAFAF8] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-gray-900">Product {index + 1}</h3>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-[12px] text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-[11px]">
          <span className="font-medium uppercase tracking-wide text-[#8A9488]">Family</span>
          <select
            className={productNoteSelectClass}
            value={entry.family}
            onChange={(e) =>
              onChange({
                ...entry,
                family: e.target.value,
                category: '',
                subCategory: '',
              })
            }
          >
            <option value="">Select family…</option>
            {getMasterNotesFamilies().map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[11px]">
          <span className="font-medium uppercase tracking-wide text-[#8A9488]">Category</span>
          <select
            className={productNoteSelectClass}
            value={entry.category}
            disabled={!entry.family}
            onChange={(e) =>
              onChange({
                ...entry,
                category: e.target.value,
                subCategory: '',
              })
            }
          >
            <option value="">{entry.family ? 'Select category…' : 'Choose family first'}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[11px]">
          <span className="font-medium uppercase tracking-wide text-[#8A9488]">Sub-category</span>
          <select
            className={productNoteSelectClass}
            value={entry.subCategory}
            disabled={!entry.family || !entry.category || !hasSubCategories}
            onChange={(e) => onChange({ ...entry, subCategory: e.target.value })}
          >
            <option value="">
              {!entry.category
                ? 'Choose category first'
                : hasSubCategories
                  ? 'Select sub-category…'
                  : 'None for this category'}
            </option>
            {subCategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-[11px]">
        <span className="font-medium uppercase tracking-wide text-[#8A9488]">Product details</span>
        <Textarea
          value={entry.details}
          onChange={(e) => onChange({ ...entry, details: e.target.value })}
          className="mt-1 min-h-[72px] text-[13px]"
          placeholder="Size, qty, MOC, delivery, or any requirement for this product…"
        />
      </label>
    </div>
  )
}

type Props = {
  productNotes: ProductNoteEntry[]
  onProductNotesChange: (next: ProductNoteEntry[]) => void
  showPreview?: boolean
  className?: string
}

export default function ProductNotesEditor({
  productNotes,
  onProductNotesChange,
  showPreview = false,
  className,
}: Props) {
  const combinedPreview = buildEnquiryNotesFromProductNotes(productNotes)

  function updateEntry(id: string, next: ProductNoteEntry) {
    onProductNotesChange(productNotes.map((e) => (e.id === id ? next : e)))
  }

  function removeEntry(id: string) {
    const next = productNotes.filter((e) => e.id !== id)
    onProductNotesChange(next.length > 0 ? next : [createEmptyProductNote()])
  }

  function addEntry() {
    onProductNotesChange([...productNotes, createEmptyProductNote()])
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-dashed"
          onClick={addEntry}
        >
          <Plus className="size-4" />
          Add product note
        </Button>
      </div>

      <div className="space-y-3">
        {productNotes.map((entry, index) => (
          <ProductNoteCard
            key={entry.id}
            entry={entry}
            index={index}
            canRemove={productNotes.length > 1}
            onChange={(next) => updateEntry(entry.id, next)}
            onRemove={() => removeEntry(entry.id)}
          />
        ))}
      </div>

      {showPreview && combinedPreview ? (
        <div className="rounded-lg border border-brand-green-200 bg-brand-green-50/60 px-3 py-2 text-[12px] text-gray-800">
          <p className="font-medium text-brand-green-800">Preview</p>
          <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">{combinedPreview}</pre>
        </div>
      ) : null}
    </div>
  )
}
