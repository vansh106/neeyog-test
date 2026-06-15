import type { Quotation, QuotationPdfDisplayOverrides } from '@/types'
import { quotationGrandTotal, quotationItemTotal } from '@/lib/quotationTotals'

export type ChargeMode = 'percent' | 'amount'

export type QuotationFinancialDraft = {
  pfApplicable: boolean
  pfMode: ChargeMode
  pfDraft: string
  freightApplicable: boolean
  freightMode: ChargeMode
  freightDraft: string
  cgstApplicable: boolean
  cgstMode: ChargeMode
  cgstDraft: string
  sgstApplicable: boolean
  sgstMode: ChargeMode
  sgstDraft: string
  igstApplicable: boolean
  igstMode: ChargeMode
  igstDraft: string
}

export type QuotationFinancialPreview = {
  itemTotal: number
  pfAmount: number
  freightAmount: number
  taxableSubtotal: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  gstAmount: number
  grandTotal: number
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function resolveCharge(
  base: number,
  applicable: boolean,
  mode: ChargeMode,
  draft: string,
  defaultPercent: number | null,
): number {
  if (!applicable || base <= 0) return 0
  const raw = draft.trim().replace(/,/g, '')
  if (!raw) {
    if (defaultPercent != null && mode === 'percent') return roundMoney(base * (defaultPercent / 100))
    return 0
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    if (defaultPercent != null && mode === 'percent') return roundMoney(base * (defaultPercent / 100))
    return 0
  }
  if (mode === 'percent') return roundMoney(base * (n / 100))
  return roundMoney(n)
}

export function computeFinancialPreview(
  itemTotal: number,
  draft: QuotationFinancialDraft,
): QuotationFinancialPreview {
  const pfAmount = resolveCharge(itemTotal, draft.pfApplicable, draft.pfMode, draft.pfDraft, 3)
  const freightAmount = resolveCharge(
    itemTotal,
    draft.freightApplicable,
    draft.freightMode,
    draft.freightDraft,
    null,
  )
  const taxableSubtotal = quotationItemTotal(
    itemTotal,
    draft.pfApplicable ? pfAmount : 0,
    draft.freightApplicable ? freightAmount : 0,
  )
  const cgstAmount = resolveCharge(
    taxableSubtotal,
    draft.cgstApplicable,
    draft.cgstMode,
    draft.cgstDraft,
    9,
  )
  const sgstAmount = resolveCharge(
    taxableSubtotal,
    draft.sgstApplicable,
    draft.sgstMode,
    draft.sgstDraft,
    9,
  )
  const igstAmount = resolveCharge(
    taxableSubtotal,
    draft.igstApplicable,
    draft.igstMode,
    draft.igstDraft,
    18,
  )
  const gstAmount = roundMoney(cgstAmount + sgstAmount + igstAmount)
  return {
    itemTotal: roundMoney(itemTotal),
    pfAmount,
    freightAmount,
    taxableSubtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount,
    grandTotal: quotationGrandTotal(taxableSubtotal, gstAmount),
  }
}

type StoredFinancialConfig = NonNullable<QuotationPdfDisplayOverrides['financial_config']>

export function hydrateFinancialDraft(quotation: Quotation): QuotationFinancialDraft {
  const fc = quotation.pdf_display_overrides?.financial_config as StoredFinancialConfig | undefined
  if (fc) {
    return {
      pfApplicable: fc.pf_applicable ?? true,
      pfMode: fc.pf_mode === 'amount' ? 'amount' : 'percent',
      pfDraft: fc.pf_draft ?? (quotation.pf_rate != null ? String(quotation.pf_rate) : '3'),
      freightApplicable: fc.freight_applicable ?? (Number(quotation.freight_amount ?? 0) > 0),
      freightMode: fc.freight_mode === 'amount' ? 'amount' : 'percent',
      freightDraft:
        fc.freight_draft ??
        (quotation.freight_rate != null
          ? String(quotation.freight_rate)
          : Number(quotation.freight_amount ?? 0) > 0
            ? String(quotation.freight_amount)
            : ''),
      cgstApplicable: fc.cgst_applicable ?? true,
      cgstMode: fc.cgst_mode === 'amount' ? 'amount' : 'percent',
      cgstDraft: fc.cgst_draft ?? '9',
      sgstApplicable: fc.sgst_applicable ?? true,
      sgstMode: fc.sgst_mode === 'amount' ? 'amount' : 'percent',
      sgstDraft: fc.sgst_draft ?? '9',
      igstApplicable: fc.igst_applicable ?? false,
      igstMode: fc.igst_mode === 'amount' ? 'amount' : 'percent',
      igstDraft: fc.igst_draft ?? '18',
    }
  }
  return {
    pfApplicable: Number(quotation.pf_amount ?? 0) > 0,
    pfMode: quotation.pf_rate != null ? 'percent' : 'amount',
    pfDraft:
      quotation.pf_rate != null
        ? String(quotation.pf_rate)
        : Number(quotation.pf_amount ?? 0) > 0
          ? String(quotation.pf_amount)
          : '3',
    freightApplicable: Number(quotation.freight_amount ?? 0) > 0,
    freightMode: quotation.freight_rate != null ? 'percent' : 'amount',
    freightDraft:
      quotation.freight_rate != null
        ? String(quotation.freight_rate)
        : Number(quotation.freight_amount ?? 0) > 0
          ? String(quotation.freight_amount)
          : '',
    cgstApplicable: true,
    cgstMode: 'percent',
    cgstDraft: '9',
    sgstApplicable: true,
    sgstMode: 'percent',
    sgstDraft: '9',
    igstApplicable: false,
    igstMode: 'percent',
    igstDraft: '18',
  }
}

export function defaultFinancialDraft(): QuotationFinancialDraft {
  return {
    pfApplicable: true,
    pfMode: 'percent',
    pfDraft: '3',
    freightApplicable: false,
    freightMode: 'amount',
    freightDraft: '',
    cgstApplicable: true,
    cgstMode: 'percent',
    cgstDraft: '9',
    sgstApplicable: true,
    sgstMode: 'percent',
    sgstDraft: '9',
    igstApplicable: false,
    igstMode: 'percent',
    igstDraft: '18',
  }
}

export function financialDraftToApiBody(draft: QuotationFinancialDraft) {
  return {
    pfApplicable: draft.pfApplicable,
    pfMode: draft.pfMode,
    pfDraft: draft.pfDraft,
    freightApplicable: draft.freightApplicable,
    freightMode: draft.freightMode,
    freightDraft: draft.freightDraft,
    cgstApplicable: draft.cgstApplicable,
    cgstMode: draft.cgstMode,
    cgstDraft: draft.cgstDraft,
    sgstApplicable: draft.sgstApplicable,
    sgstMode: draft.sgstMode,
    sgstDraft: draft.sgstDraft,
    igstApplicable: draft.igstApplicable,
    igstMode: draft.igstMode,
    igstDraft: draft.igstDraft,
  }
}
