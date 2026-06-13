import {
  buildDefaultFooterContact,
  buildDefaultHeaderLeft,
  buildDefaultHeaderRight,
  buildDefaultTerms,
  defaultFooterDisclaimer,
  defaultFooterThanks,
  defaultThankYouBanner,
  defaultCompanyRightBlurb,
  resolveQuotationPreparer,
  type QuotationPreparer,
} from '@/lib/quotationPdfDefaults'
import type {
  ClientConfig,
  EnquiryDetail,
  Quotation,
  QuotationLineItem,
  QuotationPdfDisplayOverrides,
  QuotationPdfKvRow,
  QuotationPdfValuationSupplementRow,
} from '@/types'

function normKv(rows: QuotationPdfKvRow[]): QuotationPdfKvRow[] {
  return rows.map((r) => ({
    label: (r.label || '').trim(),
    value: (r.value || '').trim(),
  }))
}

function kvEqual(a: QuotationPdfKvRow[], b: QuotationPdfKvRow[]): boolean {
  const na = normKv(a)
  const nb = normKv(b)
  if (na.length !== nb.length) return false
  return na.every((r, i) => r.label === nb[i].label && r.value === nb[i].value)
}

function termsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((t, i) => (t || '').trim() === (b[i] || '').trim())
}

export function buildPdfLineOverridesPayload(
  lineItems: QuotationLineItem[],
  edits: Array<{ description: string; size: string }>,
): Array<{ description?: string; size?: string }> {
  return edits.map((edit, idx) => {
    const line = lineItems[idx]
    if (!line) return {}
    const baseDesc = (line.product_name || line.description || '').trim()
    const baseSize = (line.size || '').trim()
    const o: { description?: string; size?: string } = {}
    if (edit.description.trim() !== baseDesc) o.description = edit.description.trim()
    if (edit.size.trim() !== baseSize) o.size = edit.size.trim()
    return o
  })
}

export type PdfEditorFormState = {
  headerLeft: QuotationPdfKvRow[]
  headerRight: QuotationPdfKvRow[]
  thankYouRow: string
  companyLeftExtra: QuotationPdfKvRow[]
  companyRightText: string
  termsItems: string[]
  footerContact: string
  footerThanks: string
  footerDisclaimer: string
  supplements: QuotationPdfValuationSupplementRow[]
  lineEdits: Array<{ description: string; size: string }>
  notesCustom: boolean
  notesText: string
}

export function hydratePdfEditorState(
  quotation: Quotation,
  clientConfig: ClientConfig | undefined,
  linkedEnquiry: EnquiryDetail | null | undefined,
  preparer?: QuotationPreparer,
): PdfEditorFormState {
  const ov = quotation.pdf_display_overrides
  const prep = preparer ?? resolveQuotationPreparer(quotation)
  const items = quotation.line_items ?? []
  const lineEdits = items.map((line, idx) => {
    const row = ov?.lines?.[idx]
    const descFromOv =
      typeof row?.description === 'string' && row.description !== ''
        ? row.description
        : typeof row?.product_name === 'string'
          ? row.product_name
          : ''
    return {
      description: descFromOv || (line.product_name || line.description || ''),
      size: (typeof row?.size === 'string' ? row.size : '') || (line.size || ''),
    }
  })

  const defL = buildDefaultHeaderLeft(clientConfig, prep)
  const defR = buildDefaultHeaderRight(quotation, linkedEnquiry)
  const headerLeft =
    Array.isArray(ov?.header_left) && ov!.header_left!.length > 0
      ? (ov!.header_left as QuotationPdfKvRow[]).map((r) => ({
          label: String((r as QuotationPdfKvRow).label ?? ''),
          value: String((r as QuotationPdfKvRow).value ?? ''),
        }))
      : defL
  const headerRight =
    Array.isArray(ov?.header_right) && ov!.header_right!.length > 0
      ? (ov!.header_right as QuotationPdfKvRow[]).map((r) => ({
          label: String((r as QuotationPdfKvRow).label ?? ''),
          value: String((r as QuotationPdfKvRow).value ?? ''),
        }))
      : defR

  const thankYouRow =
    typeof ov?.thank_you_row === 'string' && ov.thank_you_row.trim()
      ? ov.thank_you_row.trim()
      : defaultThankYouBanner()

  const companyLeftExtra = Array.isArray(ov?.company_left_extra)
    ? (ov!.company_left_extra as QuotationPdfKvRow[]).map((r) => ({
        label: String((r as QuotationPdfKvRow).label ?? ''),
        value: String((r as QuotationPdfKvRow).value ?? ''),
      }))
    : []

  const companyRightText =
    typeof ov?.company_right_text === 'string' ? ov.company_right_text : defaultCompanyRightBlurb()

  const termsItems =
    Array.isArray(ov?.terms_items) && ov!.terms_items!.length > 0
      ? (ov!.terms_items as string[]).map((t) => String(t ?? ''))
      : buildDefaultTerms(quotation)

  const footerContact =
    typeof ov?.footer_contact === 'string' && ov.footer_contact.trim()
      ? ov.footer_contact
      : buildDefaultFooterContact(clientConfig, prep)
  const footerThanks =
    typeof ov?.footer_thanks === 'string' && ov.footer_thanks.trim() ? ov.footer_thanks : defaultFooterThanks()
  const footerDisclaimer =
    typeof ov?.footer_disclaimer === 'string' && ov.footer_disclaimer.trim()
      ? ov.footer_disclaimer
      : defaultFooterDisclaimer()

  const supplements: QuotationPdfValuationSupplementRow[] = Array.isArray(ov?.valuation_supplement_rows)
    ? (ov!.valuation_supplement_rows as Record<string, unknown>[]).map((r) => ({
        sr: String(r.sr ?? ''),
        description: String(r.description ?? ''),
        size: String(r.size ?? ''),
        qty: String(r.qty ?? ''),
        rate: String(r.rate ?? ''),
        disc: String(r.disc ?? ''),
        total: String(r.total ?? ''),
      }))
    : []

  const hasNotesKey = !!(ov && typeof ov === 'object' && ov !== null && 'notes' in ov)

  return {
    headerLeft,
    headerRight,
    thankYouRow,
    companyLeftExtra,
    companyRightText,
    termsItems,
    footerContact,
    footerThanks,
    footerDisclaimer,
    supplements,
    lineEdits,
    notesCustom: hasNotesKey,
    notesText: hasNotesKey ? String((ov as QuotationPdfDisplayOverrides).notes ?? '') : '',
  }
}

export function mergeOverridesForPreview(
  quotation: Quotation,
  clientConfig: ClientConfig | undefined,
  _linkedEnquiry: EnquiryDetail | null | undefined,
  state: PdfEditorFormState,
): QuotationPdfDisplayOverrides {
  return buildLivePreviewOverrides(quotation, clientConfig, state)
}

export function buildLivePreviewOverrides(
  quotation: Quotation,
  clientConfig: ClientConfig | undefined,
  state: PdfEditorFormState,
): QuotationPdfDisplayOverrides {
  const items = quotation.line_items ?? []
  const linePatch = buildPdfLineOverridesPayload(items, state.lineEdits)
  const linesPadded = items.map((_, i) => linePatch[i] || {})
  const sup = state.supplements
    .map((r) => ({
      sr: (r.sr || '').trim(),
      description: (r.description || '').trim(),
      size: (r.size || '').trim(),
      qty: (r.qty || '').trim(),
      rate: (r.rate || '').trim(),
      disc: (r.disc || '').trim(),
      total: (r.total || '').trim(),
    }))
    .filter((r) => r.description || r.sr || r.size || r.qty || r.rate || r.disc || r.total)

  return {
    header_left: normKv(state.headerLeft),
    header_right: normKv(state.headerRight),
    thank_you_row: state.thankYouRow.trim(),
    company_left_extra: normKv(state.companyLeftExtra).filter((r) => r.label || r.value),
    company_right_text: state.companyRightText,
    terms_items: state.termsItems.map((t) => t),
    footer_contact: state.footerContact.trim(),
    footer_thanks: state.footerThanks.trim(),
    footer_disclaimer: state.footerDisclaimer.trim(),
    valuation_supplement_rows: sup.length ? sup : undefined,
    lines: linesPadded,
    ...(state.notesCustom ? { notes: state.notesText } : {}),
  }
}

export function buildPdfDisplayOverridesPayload(
  quotation: Quotation,
  clientConfig: ClientConfig | undefined,
  linkedEnquiry: EnquiryDetail | null | undefined,
  state: PdfEditorFormState,
  preparer?: QuotationPreparer,
): Record<string, unknown> | null {
  const prep = preparer ?? resolveQuotationPreparer(quotation)
  const defL = buildDefaultHeaderLeft(clientConfig, prep)
  const defR = buildDefaultHeaderRight(quotation, linkedEnquiry)
  const defTerms = buildDefaultTerms(quotation)
  const defThank = defaultThankYouBanner()
  const defCompanyRight = defaultCompanyRightBlurb()
  const defFooterC = buildDefaultFooterContact(clientConfig, prep)
  const defFooterT = defaultFooterThanks()
  const defFooterD = defaultFooterDisclaimer()

  const items = quotation.line_items ?? []
  const lines = buildPdfLineOverridesPayload(items, state.lineEdits)
  const hasLineOv = lines.some((o) => Object.keys(o).length > 0)

  const out: Record<string, unknown> = {}

  if (!kvEqual(state.headerLeft, defL)) out.header_left = normKv(state.headerLeft)
  if (!kvEqual(state.headerRight, defR)) out.header_right = normKv(state.headerRight)
  if ((state.thankYouRow || '').trim() !== defThank) out.thank_you_row = (state.thankYouRow || '').trim()
  if (state.companyLeftExtra.some((r) => (r.label || '').trim() || (r.value || '').trim())) {
    out.company_left_extra = normKv(state.companyLeftExtra).filter((r) => r.label || r.value)
  }
  if ((state.companyRightText || '').trim() !== defCompanyRight) {
    out.company_right_text = (state.companyRightText || '').trim()
  }
  if (!termsEqual(state.termsItems, defTerms)) {
    out.terms_items = state.termsItems.map((t) => t.trim()).filter(Boolean)
  }
  if ((state.footerContact || '').trim() !== defFooterC) out.footer_contact = (state.footerContact || '').trim()
  if ((state.footerThanks || '').trim() !== defFooterT) out.footer_thanks = (state.footerThanks || '').trim()
  if ((state.footerDisclaimer || '').trim() !== defFooterD) {
    out.footer_disclaimer = (state.footerDisclaimer || '').trim()
  }

  const sup = state.supplements
    .map((r) => ({
      sr: (r.sr || '').trim(),
      description: (r.description || '').trim(),
      size: (r.size || '').trim(),
      qty: (r.qty || '').trim(),
      rate: (r.rate || '').trim(),
      disc: (r.disc || '').trim(),
      total: (r.total || '').trim(),
    }))
    .filter((r) => r.description || r.sr || r.size || r.qty || r.rate || r.disc || r.total)
  if (sup.length > 0) out.valuation_supplement_rows = sup

  if (hasLineOv) out.lines = lines
  if (state.notesCustom) out.notes = state.notesText

  if (Object.keys(out).length === 0) return null
  return out
}
