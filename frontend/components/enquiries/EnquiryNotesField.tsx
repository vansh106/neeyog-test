'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  buildEnquiryNotes,
  formatMasterNotesSelections,
  getCategoriesForFamilySelections,
  getMasterNotesFamilies,
  getSubCategoriesForSelections,
  pruneMasterNotesSelections,
  toggleMasterNotesItem,
  type MasterNotesSelections,
} from '@/lib/enquiryMasterNotes'

type Props = {
  selections: MasterNotesSelections
  onSelectionsChange: (next: MasterNotesSelections) => void
  additionalNotes: string
  onAdditionalNotesChange: (next: string) => void
  className?: string
}

function MultiSelectChips({
  label,
  hint,
  options,
  selected,
  onChange,
  disabled = false,
}: {
  label: string
  hint?: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">{label}</div>
        {selected.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-[11px] text-brand-green-700 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-[11px] text-surface-muted">{hint}</p> : null}
      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-surface-border px-3 py-2 text-[12px] text-surface-muted">
          No options available
        </p>
      ) : (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-surface-border bg-surface-page/40 p-2">
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const active = selected.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(toggleMasterNotesItem(selected, option))}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-left text-[12px] font-medium transition-colors',
                    active
                      ? 'border-brand-green-500 bg-brand-green-500 text-white'
                      : 'border-surface-border bg-white text-gray-800 hover:border-brand-green-400 hover:bg-brand-green-50',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-brand-green-100 px-2 py-0.5 text-[11px] font-medium text-brand-green-900"
            >
              {item}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(selected.filter((value) => value !== item))}
                className="rounded-full p-0.5 hover:bg-brand-green-200"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function EnquiryNotesField({
  selections,
  onSelectionsChange,
  additionalNotes,
  onAdditionalNotesChange,
  className,
}: Props) {
  const families = useMemo(() => getMasterNotesFamilies(), [])
  const categories = useMemo(
    () => getCategoriesForFamilySelections(selections.families),
    [selections.families],
  )
  const subCategories = useMemo(
    () => getSubCategoriesForSelections(selections.families, selections.categories),
    [selections.families, selections.categories],
  )

  const structuredPreview = formatMasterNotesSelections(selections)
  const combinedPreview = buildEnquiryNotes(selections, additionalNotes)

  function updateFamilies(nextFamilies: string[]) {
    onSelectionsChange(
      pruneMasterNotesSelections({
        families: nextFamilies,
        categories: selections.categories,
        subCategories: selections.subCategories,
      }),
    )
  }

  function updateCategories(nextCategories: string[]) {
    onSelectionsChange(
      pruneMasterNotesSelections({
        families: selections.families,
        categories: nextCategories,
        subCategories: selections.subCategories,
      }),
    )
  }

  function updateSubCategories(nextSubCategories: string[]) {
    onSelectionsChange({
      ...selections,
      subCategories: nextSubCategories,
    })
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-surface-border bg-white p-5 shadow-sm border-t-2 border-t-brand-green-200',
        className,
      )}
    >
      <h2 className="text-[15px] font-semibold text-gray-900">Notes</h2>
      <p className="mt-1 text-[13px] text-surface-muted">
        Optionally tag the enquiry with one or more product families, categories, and sub-categories from
        masters. Click chips to select multiple.
      </p>

      <div className="mt-4 space-y-4">
        <MultiSelectChips
          label="Family"
          options={families}
          selected={selections.families}
          onChange={updateFamilies}
        />

        <MultiSelectChips
          label="Category"
          hint={
            selections.families.length > 0
              ? `Showing categories for: ${selections.families.join(', ')}`
              : 'Showing all categories — select families above to narrow'
          }
          options={categories}
          selected={selections.categories}
          onChange={updateCategories}
        />

        <MultiSelectChips
          label="Sub-category"
          hint={
            subCategories.length === 0
              ? selections.categories.length > 0
                ? 'No sub-categories for the selected categories'
                : 'Select categories to see sub-categories'
              : selections.families.length > 0 || selections.categories.length > 0
                ? 'Filtered by your family and category selections'
                : 'Showing all sub-categories'
          }
          options={subCategories}
          selected={selections.subCategories}
          onChange={updateSubCategories}
          disabled={subCategories.length === 0}
        />
      </div>

      {structuredPreview ? (
        <div className="mt-3 rounded-lg border border-brand-green-200 bg-brand-green-50/60 px-3 py-2 text-[12px] text-gray-800">
          <p className="font-medium text-brand-green-800">Selected tags</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans">{structuredPreview}</pre>
        </div>
      ) : null}

      <div className="mt-4 space-y-1.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
          Additional notes
        </div>
        <Textarea
          value={additionalNotes}
          onChange={(e) => onAdditionalNotesChange(e.target.value)}
          className="min-h-[90px]"
          placeholder="Free-form notes about the enquiry (requirements, context, follow-ups…)"
        />
      </div>

      {combinedPreview ? (
        <p className="mt-2 text-[11px] text-surface-muted">
          Notes saved with enquiry: {combinedPreview.length > 120 ? `${combinedPreview.slice(0, 120)}…` : combinedPreview}
        </p>
      ) : null}
    </section>
  )
}
