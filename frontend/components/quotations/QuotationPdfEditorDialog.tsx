'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilePenLine } from 'lucide-react'
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
import QuotationFormatPreview from '@/components/quotations/QuotationFormatPreview'
import { fetchQuotationPdfBlob, quotationsApi } from '@/lib/api'
import { emptySupplementRow } from '@/lib/quotationPdfDefaults'
import {
  buildPdfDisplayOverridesPayload,
  hydratePdfEditorState,
  mergeOverridesForPreview,
  type PdfEditorFormState,
} from '@/lib/quotationPdfPayload'
import type { ClientConfig, EnquiryDetail, Quotation } from '@/types'

function KvEditorSection({
  title,
  hint,
  rows,
  onChange,
}: {
  title: string
  hint?: string
  rows: { label: string; value: string }[]
  onChange: (next: { label: string; value: string }[]) => void
}) {
  return (
    <details className="group rounded-lg border border-[#E2E6DC] bg-white open:bg-[#FAFAF8]">
      <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-semibold text-gray-900">
        {title}
      </summary>
      <div className="space-y-2 border-t border-[#E2E6DC] px-3 py-3">
        {hint ? <p className="text-[11px] text-surface-muted">{hint}</p> : null}
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 border-b border-dashed border-[#E2E6DC] pb-2 sm:grid-cols-[minmax(0,7.5rem)_1fr_auto]"
            >
              <Input
                placeholder="Label"
                value={row.label}
                onChange={(e) =>
                  onChange(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                }
                className="h-9 text-[12px]"
              />
              <Input
                placeholder="Value"
                value={row.value}
                onChange={(e) =>
                  onChange(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                }
                className="h-9 text-[12px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 text-red-600"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#E2E6DC] text-[12px]"
          onClick={() => onChange([...rows, { label: '', value: '' }])}
        >
          Add row
        </Button>
      </div>
    </details>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotationId: string
  quotation: Quotation
  clientConfig: ClientConfig | undefined
  linkedEnquiry: EnquiryDetail | null | undefined
  onSaved: () => Promise<void>
}

export default function QuotationPdfEditorDialog({
  open,
  onOpenChange,
  quotationId,
  quotation,
  clientConfig,
  linkedEnquiry,
  onSaved,
}: Props) {
  const [form, setForm] = useState<PdfEditorFormState>(() =>
    hydratePdfEditorState(quotation, clientConfig, linkedEnquiry),
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [pdfPreviewNonce, setPdfPreviewNonce] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(hydratePdfEditorState(quotation, clientConfig, linkedEnquiry))
      setErr(null)
    }
    wasOpenRef.current = open
  }, [open, quotation, clientConfig, linkedEnquiry])

  const previewQuotation = useMemo(
    () => ({
      ...quotation,
      pdf_display_overrides: mergeOverridesForPreview(quotation, clientConfig, linkedEnquiry, form),
    }),
    [quotation, clientConfig, linkedEnquiry, form],
  )

  const notesPreviewText = form.notesCustom ? form.notesText : null

  useEffect(() => {
    if (!open || !quotationId) {
      setPdfPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      setPdfErr(null)
      setPdfLoading(false)
      return
    }
    let cancelled = false
    setPdfLoading(true)
    setPdfErr(null)
    fetchQuotationPdfBlob(quotationId)
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPdfPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setPdfErr(e instanceof Error ? e.message : 'Preview failed')
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, quotationId, pdfPreviewNonce])

  const save = useCallback(async () => {
    setBusy(true)
    setErr(null)
    try {
      const payload = buildPdfDisplayOverridesPayload(quotation, clientConfig, linkedEnquiry, form)
      await quotationsApi.updatePdfDisplay(quotationId, { pdf_display_overrides: payload })
      setPdfPreviewNonce((n) => n + 1)
      await onSaved()
      onOpenChange(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }, [quotation, clientConfig, linkedEnquiry, form, quotationId, onSaved, onOpenChange])

  const clearAll = useCallback(async () => {
    setBusy(true)
    setErr(null)
    try {
      await quotationsApi.updatePdfDisplay(quotationId, { pdf_display_overrides: null })
      setPdfPreviewNonce((n) => n + 1)
      await onSaved()
      onOpenChange(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to clear')
    } finally {
      setBusy(false)
    }
  }, [quotationId, onSaved, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <div className="border-b border-surface-border px-5 py-4 sm:px-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2">
              <FilePenLine className="size-5 text-brand-green-600" />
              Edit PDF layout & wording
            </DialogTitle>
            <DialogDescription>
              Column widths match the generated PDF (ReportLab). You can add rows in letterhead, company block,
              valuation table (extra lines), terms, and footer. Amounts and catalog lines are unchanged unless you edit
              description/size per line. Save regenerates the PDF; the right panel shows the server PDF (updates after
              save). Below left: live HTML preview.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-surface-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="max-h-[min(70vh,680px)] overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="rounded-lg border border-[#333] bg-white p-2 shadow-sm overflow-x-auto max-h-[220px] overflow-y-auto">
              <QuotationFormatPreview
                quotation={previewQuotation}
                clientConfig={clientConfig}
                linkedEnquiry={linkedEnquiry}
                pdfOverrides={previewQuotation.pdf_display_overrides}
                notesPreviewText={notesPreviewText}
                onOpenHistory={() => {}}
              />
            </div>

            <KvEditorSection
              title="Letterhead — left column"
              hint="Address, website, prepared by, or any custom label/value pairs."
              rows={form.headerLeft}
              onChange={(headerLeft) => setForm((f) => ({ ...f, headerLeft }))}
            />
            <KvEditorSection
              title="Letterhead — right column"
              hint="Date, quotation no., valid until, enquiry ref, etc."
              rows={form.headerRight}
              onChange={(headerRight) => setForm((f) => ({ ...f, headerRight }))}
            />

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">Thank-you banner</summary>
              <div className="border-t border-[#E2E6DC] px-3 py-3">
                <Textarea
                  value={form.thankYouRow}
                  onChange={(e) => setForm((f) => ({ ...f, thankYouRow: e.target.value }))}
                  className="min-h-[56px] text-[12px]"
                />
              </div>
            </details>

            <KvEditorSection
              title="Company — extra lines (left column)"
              hint="Shown under company name / contact on the PDF (e.g. GSTIN, delivery point)."
              rows={form.companyLeftExtra}
              onChange={(companyLeftExtra) => setForm((f) => ({ ...f, companyLeftExtra }))}
            />

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">Company — right column text</summary>
              <div className="border-t border-[#E2E6DC] px-3 py-3">
                <Textarea
                  value={form.companyRightText}
                  onChange={(e) => setForm((f) => ({ ...f, companyRightText: e.target.value }))}
                  className="min-h-[72px] text-[12px]"
                />
              </div>
            </details>

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">
                Valuation — catalog lines (description & size on PDF)
              </summary>
              <div className="max-h-[280px] space-y-3 overflow-y-auto border-t border-[#E2E6DC] px-3 py-3">
                {form.lineEdits.map((row, idx) => (
                  <div key={idx} className="rounded-md border border-[#E2E6DC] bg-[#F9FAF7] p-3">
                    <p className="text-[11px] font-medium text-[#8A9488]">Line {idx + 1}</p>
                    <Textarea
                      className="mt-2 min-h-[64px] text-[12px]"
                      value={row.description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          lineEdits: f.lineEdits.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)),
                        }))
                      }
                    />
                    <Input
                      className="mt-2 h-9 text-[12px]"
                      placeholder="Size"
                      value={row.size}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          lineEdits: f.lineEdits.map((r, i) => (i === idx ? { ...r, size: e.target.value } : r)),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">
                Valuation — extra rows (after lines; display-only)
              </summary>
              <div className="space-y-2 border-t border-[#E2E6DC] px-3 py-3">
                <p className="text-[11px] text-surface-muted">
                  Fixed column widths as in PDF. Leave cells as — or empty; use for notes, spares, or sub-lines.
                </p>
                {form.supplements.map((row, idx) => (
                  <div key={idx} className="space-y-2 border-b border-dashed border-[#E2E6DC] pb-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Input
                        placeholder="Sr"
                        className="h-8 text-[11px]"
                        value={row.sr ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            supplements: f.supplements.map((r, i) =>
                              i === idx ? { ...r, sr: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                      <Input
                        placeholder="Qty"
                        className="h-8 text-[11px]"
                        value={row.qty ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            supplements: f.supplements.map((r, i) =>
                              i === idx ? { ...r, qty: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                      <Input
                        placeholder="Rate"
                        className="h-8 text-[11px]"
                        value={row.rate ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            supplements: f.supplements.map((r, i) =>
                              i === idx ? { ...r, rate: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                      <Input
                        placeholder="Disc"
                        className="h-8 text-[11px]"
                        value={row.disc ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            supplements: f.supplements.map((r, i) =>
                              i === idx ? { ...r, disc: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                    </div>
                    <Textarea
                      placeholder="Description"
                      className="min-h-[44px] text-[12px]"
                      value={row.description ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          supplements: f.supplements.map((r, i) =>
                            i === idx ? { ...r, description: e.target.value } : r,
                          ),
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Size"
                        className="h-8 text-[11px]"
                        value={row.size ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            supplements: f.supplements.map((r, i) =>
                              i === idx ? { ...r, size: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                      <Input
                        placeholder="Total"
                        className="h-8 text-[11px]"
                        value={row.total ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            supplements: f.supplements.map((r, i) =>
                              i === idx ? { ...r, total: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-600"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          supplements: f.supplements.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Remove row
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#E2E6DC] text-[12px]"
                  onClick={() => setForm((f) => ({ ...f, supplements: [...f.supplements, emptySupplementRow()] }))}
                >
                  Add valuation row
                </Button>
              </div>
            </details>

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">Terms and conditions</summary>
              <div className="space-y-2 border-t border-[#E2E6DC] px-3 py-3">
                {form.termsItems.map((t, i) => (
                  <Textarea
                    key={i}
                    className="min-h-[48px] text-[12px]"
                    value={t}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        termsItems: f.termsItems.map((x, j) => (j === i ? e.target.value : x)),
                      }))
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#E2E6DC] text-[12px]"
                  onClick={() => setForm((f) => ({ ...f, termsItems: [...f.termsItems, ''] }))}
                >
                  Add term
                </Button>
              </div>
            </details>

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">Notes (PDF-only)</summary>
              <div className="border-t border-[#E2E6DC] px-3 py-3 space-y-2">
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={form.notesCustom}
                    onChange={(e) => setForm((f) => ({ ...f, notesCustom: e.target.checked }))}
                  />
                  Custom notes block on PDF
                </label>
                {form.notesCustom ? (
                  <Textarea
                    value={form.notesText}
                    onChange={(e) => setForm((f) => ({ ...f, notesText: e.target.value }))}
                    className="min-h-[80px] text-[12px]"
                  />
                ) : null}
              </div>
            </details>

            <details className="rounded-lg border border-[#E2E6DC] bg-white">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">Footer</summary>
              <div className="space-y-2 border-t border-[#E2E6DC] px-3 py-3">
                <label className="text-[11px] font-medium text-surface-muted">Contact line</label>
                <Textarea
                  className="min-h-[56px] text-[12px]"
                  value={form.footerContact}
                  onChange={(e) => setForm((f) => ({ ...f, footerContact: e.target.value }))}
                />
                <label className="text-[11px] font-medium text-surface-muted">Thank-you line</label>
                <Input
                  className="h-9 text-[12px]"
                  value={form.footerThanks}
                  onChange={(e) => setForm((f) => ({ ...f, footerThanks: e.target.value }))}
                />
                <label className="text-[11px] font-medium text-surface-muted">Disclaimer</label>
                <Textarea
                  className="min-h-[48px] text-[12px]"
                  value={form.footerDisclaimer}
                  onChange={(e) => setForm((f) => ({ ...f, footerDisclaimer: e.target.value }))}
                />
              </div>
            </details>

            {err ? <p className="text-[13px] text-red-600">{err}</p> : null}
          </div>

          <div className="flex min-h-[280px] flex-col bg-surface-page lg:max-h-[min(70vh,680px)]">
            <p className="shrink-0 border-b border-surface-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
              Server PDF (after save)
            </p>
            {pdfLoading && (
              <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-surface-muted">
                Loading…
              </div>
            )}
            {pdfErr && !pdfLoading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center text-[13px] text-red-600">
                {pdfErr}
              </div>
            )}
            {!pdfLoading && !pdfErr && pdfPreviewUrl && (
              <iframe title="Quotation PDF" src={pdfPreviewUrl} className="min-h-[320px] w-full flex-1 border-0" />
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row flex-wrap items-center justify-between gap-2 border-t border-surface-border px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void clearAll()}>
            Clear all PDF overrides
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save & regenerate PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
