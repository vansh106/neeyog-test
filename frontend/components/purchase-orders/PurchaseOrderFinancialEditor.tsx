'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { purchaseOrdersApi } from '@/lib/api'
import {
  computeFinancialPreview,
  financialDraftToApiBody,
  hydrateFinancialDraftFromPo,
  type QuotationFinancialDraft,
} from '@/lib/quotationFinancialConfig'
import { NetChargeRow } from '@/components/quotations/NetChargeRow'
import type { PurchaseOrder } from '@/types'

type Props = {
  po: PurchaseOrder
  disabled?: boolean
  onSaved: (po: PurchaseOrder) => void
}

function previewChargeLabel(
  base: string,
  draft: QuotationFinancialDraft,
  modeKey: 'pf' | 'freight' | 'cgst' | 'sgst' | 'igst',
): string {
  const applicable = draft[`${modeKey}Applicable`]
  const chargeMode = draft[`${modeKey}Mode`]
  const chargeDraft = draft[`${modeKey}Draft`]
  if (!applicable) return base
  if (chargeMode === 'percent' && chargeDraft.trim()) return `${base} (${chargeDraft} %)`
  return base
}

export default function PurchaseOrderFinancialEditor({ po, disabled = false, onSaved }: Props) {
  const [draft, setDraft] = useState<QuotationFinancialDraft>(() => hydrateFinancialDraftFromPo(po))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(hydrateFinancialDraftFromPo(po))
    setDirty(false)
    setError(null)
  }, [po])

  const preview = useMemo(() => computeFinancialPreview(po.subtotal, draft), [po.subtotal, draft])

  const patchDraft = (patch: Partial<QuotationFinancialDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await purchaseOrdersApi.update<PurchaseOrder>(
        po.po_id,
        financialDraftToApiBody(draft),
      )
      setDirty(false)
      onSaved(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save financial summary')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#E2E6DC] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
            Financial summary
          </p>
          <p className="mt-1 text-[13px] text-surface-muted">
            Adjust P&amp;F, freight, and taxes. Sub total is item total plus applicable charges; GST applies on sub total.
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

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[#E2E6DC] p-4">
          <div className="grid grid-cols-[1fr_8.5rem] items-center gap-x-3 border-b border-[#E2E6DC] pb-2 text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
            <span>Charge</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="grid grid-cols-[1fr_8.5rem] items-center gap-x-3 border-b border-[#E2E6DC] py-2.5">
            <span className="text-[13px] font-medium text-gray-900">ITEM TOTAL</span>
            <span className="text-right font-mono text-[13px] text-gray-900">
              {formatCurrency(preview.itemTotal)}
            </span>
          </div>

          <NetChargeRow
            label="P & F"
            checkboxAriaLabel="Apply P and F charges"
            checked={draft.pfApplicable}
            onCheckedChange={(pfApplicable) => patchDraft({ pfApplicable })}
            controlsDisabled={disabled || saving}
            mode={draft.pfMode}
            onModePercent={() => patchDraft({ pfMode: 'percent' })}
            onModeAmount={() => patchDraft({ pfMode: 'amount' })}
            draft={draft.pfDraft}
            onDraftChange={(pfDraft) => patchDraft({ pfDraft })}
            percentPlaceholder="3"
            amountPlaceholder="0.00"
            percentAriaLabel="P and F percent"
            amountAriaLabel="P and F amount"
            appliedAmount={preview.pfAmount}
          />

          <NetChargeRow
            label="Freight"
            checkboxAriaLabel="Apply freight"
            checked={draft.freightApplicable}
            onCheckedChange={(freightApplicable) => patchDraft({ freightApplicable })}
            controlsDisabled={disabled || saving}
            mode={draft.freightMode}
            onModePercent={() => patchDraft({ freightMode: 'percent' })}
            onModeAmount={() => patchDraft({ freightMode: 'amount' })}
            draft={draft.freightDraft}
            onDraftChange={(freightDraft) => patchDraft({ freightDraft })}
            percentPlaceholder="e.g. 2"
            amountPlaceholder="0.00"
            percentAriaLabel="Freight percent"
            amountAriaLabel="Freight amount"
            appliedAmount={preview.freightAmount}
            percentInputClassName="w-[2.75rem] px-1"
          />

          <NetChargeRow
            label="CGST"
            checkboxAriaLabel="Apply CGST"
            checked={draft.cgstApplicable}
            onCheckedChange={(cgstApplicable) => patchDraft({ cgstApplicable })}
            controlsDisabled={disabled || saving}
            mode={draft.cgstMode}
            onModePercent={() => patchDraft({ cgstMode: 'percent' })}
            onModeAmount={() => patchDraft({ cgstMode: 'amount' })}
            draft={draft.cgstDraft}
            onDraftChange={(cgstDraft) => patchDraft({ cgstDraft })}
            percentPlaceholder="9"
            amountPlaceholder="0.00"
            percentAriaLabel="CGST percent"
            amountAriaLabel="CGST amount"
            appliedAmount={preview.cgstAmount}
          />

          <NetChargeRow
            label="SGST"
            checkboxAriaLabel="Apply SGST"
            checked={draft.sgstApplicable}
            onCheckedChange={(sgstApplicable) => patchDraft({ sgstApplicable })}
            controlsDisabled={disabled || saving}
            mode={draft.sgstMode}
            onModePercent={() => patchDraft({ sgstMode: 'percent' })}
            onModeAmount={() => patchDraft({ sgstMode: 'amount' })}
            draft={draft.sgstDraft}
            onDraftChange={(sgstDraft) => patchDraft({ sgstDraft })}
            percentPlaceholder="9"
            amountPlaceholder="0.00"
            percentAriaLabel="SGST percent"
            amountAriaLabel="SGST amount"
            appliedAmount={preview.sgstAmount}
          />

          <NetChargeRow
            label="IGST"
            checkboxAriaLabel="Apply IGST"
            checked={draft.igstApplicable}
            onCheckedChange={(igstApplicable) => patchDraft({ igstApplicable })}
            controlsDisabled={disabled || saving}
            mode={draft.igstMode}
            onModePercent={() => patchDraft({ igstMode: 'percent' })}
            onModeAmount={() => patchDraft({ igstMode: 'amount' })}
            draft={draft.igstDraft}
            onDraftChange={(igstDraft) => patchDraft({ igstDraft })}
            percentPlaceholder="18"
            amountPlaceholder="0.00"
            percentAriaLabel="IGST percent"
            amountAriaLabel="IGST amount"
            appliedAmount={preview.igstAmount}
          />
        </div>

        <div className="rounded-lg border border-[#E2E6DC] p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Preview</p>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <tr className="border border-[#333] bg-white">
                <td className="px-2 py-1.5 font-bold">ITEM TOTAL</td>
                <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.itemTotal)}</td>
              </tr>
              {draft.pfApplicable && preview.pfAmount > 0 && (
                <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">{previewChargeLabel('P & F', draft, 'pf')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.pfAmount)}</td>
                </tr>
              )}
              {draft.freightApplicable && preview.freightAmount > 0 && (
                <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">{previewChargeLabel('FREIGHT', draft, 'freight')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.freightAmount)}</td>
                </tr>
              )}
              <tr className="border border-[#333] border-t-0 bg-white">
                <td className="px-2 py-1.5 font-bold">SUB TOTAL</td>
                <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.taxableSubtotal)}</td>
              </tr>
              {draft.cgstApplicable && preview.cgstAmount > 0 && (
                <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">{previewChargeLabel('CGST', draft, 'cgst')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.cgstAmount)}</td>
                </tr>
              )}
              {draft.sgstApplicable && preview.sgstAmount > 0 && (
                <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">{previewChargeLabel('SGST', draft, 'sgst')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.sgstAmount)}</td>
                </tr>
              )}
              {draft.igstApplicable && preview.igstAmount > 0 && (
                <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">{previewChargeLabel('IGST', draft, 'igst')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(preview.igstAmount)}</td>
                </tr>
              )}
              <tr className="border border-[#333] border-t-0 bg-[#f9faf7]">
                <td className="px-2 py-1.5 text-[14px] font-bold">GRAND TOTAL INR</td>
                <td className="px-2 py-1.5 text-right font-mono text-[15px] font-bold text-brand-green-600">
                  {formatCurrency(preview.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
