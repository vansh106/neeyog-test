'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { quotationsApi } from '@/lib/api'
import { buildDefaultTerms } from '@/lib/quotationPdfDefaults'
import type { Quotation } from '@/types'

export type QuotationTermTemplate = {
  id: string
  body: string
  sort_order: number
  created_at: string | null
}

type Props = {
  quotation: Quotation
  disabled?: boolean
  onSaved: (quotation: Quotation) => void
}

function normalizeTerm(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export default function QuotationTermsEditor({ quotation, disabled = false, onSaved }: Props) {
  const [masterTerms, setMasterTerms] = useState<QuotationTermTemplate[]>([])
  const [masterLoading, setMasterLoading] = useState(true)
  const [masterError, setMasterError] = useState<string | null>(null)
  const [selectedTerms, setSelectedTerms] = useState<string[]>(() => {
    const ov = quotation.pdf_display_overrides?.terms_items
    return ov && ov.length > 0 ? [...ov] : buildDefaultTerms(quotation)
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newTermBody, setNewTermBody] = useState('')
  const [creatingTerm, setCreatingTerm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const loadMasterTerms = useCallback(async () => {
    setMasterLoading(true)
    setMasterError(null)
    try {
      const res = await quotationsApi.listTermsMaster<{ items: QuotationTermTemplate[] }>()
      setMasterTerms(res.items ?? [])
    } catch (e: unknown) {
      setMasterError(e instanceof Error ? e.message : 'Failed to load terms')
      setMasterTerms([])
    } finally {
      setMasterLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMasterTerms()
  }, [loadMasterTerms])

  useEffect(() => {
    const ov = quotation.pdf_display_overrides?.terms_items
    setSelectedTerms(ov && ov.length > 0 ? [...ov] : buildDefaultTerms(quotation))
    setDirty(false)
    setSaveError(null)
  }, [quotation])

  const selectedSet = useMemo(() => new Set(selectedTerms.map(normalizeTerm)), [selectedTerms])

  const availableTerms = useMemo(
    () => masterTerms.filter((t) => !selectedSet.has(normalizeTerm(t.body))),
    [masterTerms, selectedSet],
  )

  const addTerm = (body: string) => {
    const text = body.trim()
    if (!text) return
    setSelectedTerms((prev) => {
      if (prev.some((t) => normalizeTerm(t) === normalizeTerm(text))) return prev
      return [...prev, text]
    })
    setDirty(true)
    setSaveError(null)
  }

  const removeTerm = (index: number) => {
    setSelectedTerms((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
    setSaveError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const existingOverrides = quotation.pdf_display_overrides ?? {}
      const updated = await quotationsApi.updatePdfDisplay<Quotation>(quotation.quotation_id, {
        pdf_display_overrides: {
          ...existingOverrides,
          terms_items: selectedTerms,
        },
      })
      setDirty(false)
      onSaved(updated)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save terms')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTerm = async () => {
    const text = newTermBody.trim()
    if (!text) {
      setCreateError('Enter term text')
      return
    }
    setCreatingTerm(true)
    setCreateError(null)
    try {
      const created = await quotationsApi.createTermMaster<QuotationTermTemplate>({ body: text })
      setMasterTerms((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
      setNewTermBody('')
      setAddModalOpen(false)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create term')
    } finally {
      setCreatingTerm(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              Terms &amp; conditions
            </p>
            <p className="mt-1 text-[13px] text-surface-muted">
              Choose which terms appear on this quotation. Add from the master list or create new terms.
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </div>

        {saveError && <p className="mt-3 text-[13px] text-red-600">{saveError}</p>}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-h-[280px] flex-col rounded-lg border border-[#E2E6DC]">
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E6DC] px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8A9488]">
                Available terms
              </p>
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-[#E2E6DC] text-[12px]"
                  onClick={() => {
                    setNewTermBody('')
                    setCreateError(null)
                    setAddModalOpen(true)
                  }}
                >
                  <Plus className="size-3.5" />
                  Add new term
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {masterLoading ? (
                <p className="text-[13px] text-surface-muted">Loading terms…</p>
              ) : masterError ? (
                <p className="text-[13px] text-red-600">{masterError}</p>
              ) : availableTerms.length === 0 ? (
                <p className="text-[13px] text-surface-muted">All master terms are already added.</p>
              ) : (
                <ul className="space-y-2">
                  {availableTerms.map((term) => (
                    <li
                      key={term.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-[#E2E6DC] bg-[#FAFBF8] px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 text-[13px] leading-snug text-gray-800">{term.body}</p>
                      {!disabled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 border-[#E2E6DC] px-2 text-[11px]"
                          onClick={() => addTerm(term.body)}
                        >
                          Add
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-[280px] flex-col rounded-lg border border-[#E2E6DC]">
            <div className="border-b border-[#E2E6DC] px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8A9488]">
                Selected for this quotation
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {selectedTerms.length === 0 ? (
                <p className="text-[13px] text-surface-muted">No terms selected yet.</p>
              ) : (
                <ol className="space-y-2">
                  {selectedTerms.map((term, index) => (
                    <li
                      key={`${index}-${normalizeTerm(term).slice(0, 40)}`}
                      className="flex items-start justify-between gap-3 rounded-md border border-[#E2E6DC] bg-white px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 text-[13px] leading-snug text-gray-800">
                        <span className="mr-2 font-semibold text-[#8A9488]">{index + 1}.</span>
                        {term}
                      </p>
                      {!disabled && (
                        <button
                          type="button"
                          aria-label="Remove term"
                          className="shrink-0 rounded p-1 text-[#8A9488] hover:bg-[#F4F5F0] hover:text-red-600"
                          onClick={() => removeTerm(index)}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add new term</DialogTitle>
            <DialogDescription>
              This term is saved to the master list and can be reused on other quotations.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={newTermBody}
            onChange={(e) => setNewTermBody(e.target.value)}
            placeholder="Enter term text…"
            rows={4}
            disabled={creatingTerm}
          />
          {createError && <p className="text-[13px] text-red-600">{createError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={creatingTerm}
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={creatingTerm} onClick={() => void handleCreateTerm()}>
              {creatingTerm ? 'Saving…' : 'Save term'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
