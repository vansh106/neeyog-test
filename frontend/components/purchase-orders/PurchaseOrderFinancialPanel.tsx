'use client'

import { useMemo, useState } from 'react'
import { NetChargeRow } from '@/components/quotations/NetChargeRow'
import {
  computeFinancialPreview,
  defaultFinancialDraft,
  financialDraftToApiBody,
  type QuotationFinancialDraft,
} from '@/lib/quotationFinancialConfig'
import { cn, formatCurrency } from '@/lib/utils'

const AMOUNT_COL = 'text-right font-mono text-[13px] tabular-nums'

export function usePurchaseOrderFinancialDraft(itemTotal: number) {
  const [draft, setDraft] = useState<QuotationFinancialDraft>(() => defaultFinancialDraft())
  const preview = useMemo(() => computeFinancialPreview(itemTotal, draft), [itemTotal, draft])
  const apiBody = useMemo(() => financialDraftToApiBody(draft), [draft])
  return { draft, setDraft, preview, apiBody }
}

type Props = {
  itemTotal: number
  draft: QuotationFinancialDraft
  onDraftChange: (draft: QuotationFinancialDraft) => void
  disabled?: boolean
}

export default function PurchaseOrderFinancialPanel({
  itemTotal,
  draft,
  onDraftChange,
  disabled = false,
}: Props) {
  const preview = useMemo(() => computeFinancialPreview(itemTotal, draft), [itemTotal, draft])

  const patchDraft = (patch: Partial<QuotationFinancialDraft>) => {
    onDraftChange({ ...draft, ...patch })
  }

  return (
    <div className="w-full lg:flex lg:justify-end">
      <div className="w-full max-w-3xl rounded-lg border border-[#E2E6DC] bg-[#FFF8E7] p-4 lg:p-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">Order totals</p>
        <p className="mt-1 text-[12px] text-surface-muted">
          P&amp;F and freight apply on item total; CGST / SGST / IGST apply on subtotal before tax.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#E2E6DC] bg-white/60">
          <div className="grid grid-cols-[1fr_min(11rem,28%)] items-center gap-x-4 border-b border-[#E2E6DC] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[#8A9488]">
            <span>Charge</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="px-4">
            <div className="grid grid-cols-[1fr_min(11rem,28%)] items-center gap-x-4 border-b border-[#E2E6DC] py-3">
              <span className="text-[13px] font-medium text-gray-900">Item total</span>
              <span className={cn(AMOUNT_COL, 'font-medium text-gray-900')}>
                {formatCurrency(itemTotal)}
              </span>
            </div>

            <NetChargeRow
              label="P & F"
              className="grid-cols-[1fr_min(11rem,28%)] gap-x-4"
              checkboxAriaLabel="Apply P and F charges"
              checked={draft.pfApplicable}
              onCheckedChange={(v) => patchDraft({ pfApplicable: v })}
              controlsDisabled={disabled}
              mode={draft.pfMode}
              onModePercent={() => patchDraft({ pfMode: 'percent' })}
              onModeAmount={() => patchDraft({ pfMode: 'amount' })}
              draft={draft.pfDraft}
              onDraftChange={(v) => patchDraft({ pfDraft: v })}
              percentPlaceholder="3"
              amountPlaceholder="0.00"
              percentAriaLabel="P and F as percent"
              amountAriaLabel="P and F amount"
              appliedAmount={preview.pfAmount}
            />

            <NetChargeRow
              label="Freight"
              className="grid-cols-[1fr_min(11rem,28%)] gap-x-4"
              checkboxAriaLabel="Apply freight"
              checked={draft.freightApplicable}
              onCheckedChange={(v) => patchDraft({ freightApplicable: v })}
              controlsDisabled={disabled}
              mode={draft.freightMode}
              onModePercent={() => patchDraft({ freightMode: 'percent' })}
              onModeAmount={() => patchDraft({ freightMode: 'amount' })}
              draft={draft.freightDraft}
              onDraftChange={(v) => patchDraft({ freightDraft: v })}
              percentPlaceholder="e.g. 2"
              amountPlaceholder="0.00"
              percentAriaLabel="Freight as percent"
              amountAriaLabel="Freight amount"
              appliedAmount={preview.freightAmount}
              percentInputClassName="w-[3.25rem] px-1"
            />

            <div className="grid grid-cols-[1fr_min(11rem,28%)] items-center gap-x-4 border-b border-[#E2E6DC] py-3">
              <span className="text-[13px] font-medium text-gray-900">Subtotal (before tax)</span>
              <span className={cn(AMOUNT_COL, 'font-medium text-gray-900')}>
                {formatCurrency(preview.taxableSubtotal)}
              </span>
            </div>

            <NetChargeRow
              label="CGST"
              className="grid-cols-[1fr_min(11rem,28%)] gap-x-4"
              checkboxAriaLabel="Apply CGST"
              checked={draft.cgstApplicable}
              onCheckedChange={(v) => patchDraft({ cgstApplicable: v })}
              controlsDisabled={disabled}
              mode={draft.cgstMode}
              onModePercent={() => patchDraft({ cgstMode: 'percent' })}
              onModeAmount={() => patchDraft({ cgstMode: 'amount' })}
              draft={draft.cgstDraft}
              onDraftChange={(v) => patchDraft({ cgstDraft: v })}
              percentPlaceholder="9"
              amountPlaceholder="0.00"
              percentAriaLabel="CGST percent"
              amountAriaLabel="CGST amount"
              appliedAmount={preview.cgstAmount}
            />

            <NetChargeRow
              label="SGST"
              className="grid-cols-[1fr_min(11rem,28%)] gap-x-4"
              checkboxAriaLabel="Apply SGST"
              checked={draft.sgstApplicable}
              onCheckedChange={(v) => patchDraft({ sgstApplicable: v })}
              controlsDisabled={disabled}
              mode={draft.sgstMode}
              onModePercent={() => patchDraft({ sgstMode: 'percent' })}
              onModeAmount={() => patchDraft({ sgstMode: 'amount' })}
              draft={draft.sgstDraft}
              onDraftChange={(v) => patchDraft({ sgstDraft: v })}
              percentPlaceholder="9"
              amountPlaceholder="0.00"
              percentAriaLabel="SGST percent"
              amountAriaLabel="SGST amount"
              appliedAmount={preview.sgstAmount}
            />

            <NetChargeRow
              label="IGST"
              className="grid-cols-[1fr_min(11rem,28%)] gap-x-4"
              checkboxAriaLabel="Apply IGST"
              checked={draft.igstApplicable}
              onCheckedChange={(v) =>
                patchDraft({
                  igstApplicable: v,
                  cgstApplicable: v ? false : draft.cgstApplicable,
                  sgstApplicable: v ? false : draft.sgstApplicable,
                })
              }
              controlsDisabled={disabled}
              mode={draft.igstMode}
              onModePercent={() => patchDraft({ igstMode: 'percent' })}
              onModeAmount={() => patchDraft({ igstMode: 'amount' })}
              draft={draft.igstDraft}
              onDraftChange={(v) => patchDraft({ igstDraft: v })}
              percentPlaceholder="18"
              amountPlaceholder="0.00"
              percentAriaLabel="IGST percent"
              amountAriaLabel="IGST amount"
              appliedAmount={preview.igstAmount}
            />
          </div>

          <div className="grid grid-cols-[1fr_min(11rem,28%)] items-center gap-x-4 border-t border-[#E2E6DC] bg-[#FFF8E7] px-4 py-3">
            <span className="text-[13px] font-semibold text-gray-900">Grand total INR</span>
            <span className={cn(AMOUNT_COL, 'font-semibold text-brand-green-700')}>
              {formatCurrency(preview.grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export { financialDraftToApiBody }
