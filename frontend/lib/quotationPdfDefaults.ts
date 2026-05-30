import { formatDateDdMmYyyy } from '@/lib/quotationLineDisplay'
import type { ClientConfig, EnquiryDetail, Quotation, QuotationPdfKvRow, QuotationPdfValuationSupplementRow } from '@/types'

export type PdfKvRow = QuotationPdfKvRow

export type PdfSupplementRow = {
  sr: string
  description: string
  size: string
  qty: string
  rate: string
  disc: string
  total: string
}

function validUntilDdMmYyyy(createdAt: string | null, validityDays: number): string {
  if (!createdAt) return formatDateDdMmYyyy(new Date().toISOString())
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return formatDateDdMmYyyy(new Date().toISOString())
  d.setDate(d.getDate() + Math.max(0, validityDays))
  return formatDateDdMmYyyy(d.toISOString())
}

export function buildDefaultHeaderLeft(clientConfig: ClientConfig | undefined): PdfKvRow[] {
  const rows: PdfKvRow[] = []
  const addr = (clientConfig?.address || '').trim()
  if (addr) rows.push({ label: 'Address', value: addr })
  const website = (clientConfig?.website as string | undefined)?.trim()
  if (website) rows.push({ label: 'Website', value: website })
  const salesEmail = (
    (clientConfig?.sales_email as string | undefined)?.trim() ||
    (clientConfig?.email || '').trim()
  ).trim()
  if (salesEmail) rows.push({ label: 'E-Mail', value: salesEmail })
  const prepared = ((clientConfig?.prepared_by as string | undefined) || 'Sales Team').trim()
  rows.push({ label: 'Prepared By', value: prepared })
  return rows
}

export function buildDefaultHeaderRight(
  quotation: Quotation,
  linkedEnquiry: EnquiryDetail | null | undefined,
): PdfKvRow[] {
  const quoteDate = formatDateDdMmYyyy(quotation.created_at)
  const validUntil = validUntilDdMmYyyy(quotation.created_at, quotation.validity_days)
  const eno = (quotation.enquiry_number || '').trim()
  const enquiryRef = eno || quotation.enquiry_id
  const enquiryDate = formatDateDdMmYyyy(linkedEnquiry?.created_at ?? null)
  const enqLine =
    enquiryDate !== '—' ? `${enquiryRef} / ${enquiryDate}` : enquiryRef
  return [
    { label: 'Date', value: quoteDate },
    { label: 'Quotation No', value: quotation.quote_number },
    { label: 'Valid Until', value: validUntil },
    { label: 'Enquiry No / Date', value: enqLine },
  ]
}

export function defaultThankYouBanner(): string {
  return 'Thank you for Your Enquiry considering us as faithful Supplier'
}

export function defaultCompanyRightBlurb(): string {
  return 'Thank you for your enquiry and for considering us as a supplier.'
}

export function formatQuotationFreight(quotation: Quotation): string {
  const amt = Number(quotation.freight_amount ?? 0)
  if (Number.isFinite(amt) && amt > 0) {
    const money = amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const rate = quotation.freight_rate
    if (rate != null && Number.isFinite(Number(rate))) {
      return `₹${money} (${Number(rate)} %)`
    }
    return `₹${money}`
  }
  return quotation.freight_note || 'Extra at actual'
}

export function buildDefaultTerms(quotation: Quotation): string[] {
  const gstRate = quotation.gst_rate
  const freightAmt = Number(quotation.freight_amount ?? 0)
  const freightTerm =
    freightAmt > 0 && quotation.freight_rate != null
      ? `Freight @ ${quotation.freight_rate}% — included in valuation total as shown below.`
      : freightAmt > 0
        ? `Freight — ₹${freightAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} included in valuation total as shown below.`
        : `Freight — ${quotation.freight_note || 'Extra at actual'}.`
  return [
    'Any modification to agreed specifications may attract additional commercial charges.',
    "Third party inspection, if required — extra at actual and in customer's scope.",
    freightTerm,
    `GST @ ${gstRate}% — included in valuation total as shown below.`,
    `P & F @ ${quotation.pf_rate}% — included in valuation total as shown below.`,
    `Offer validity — ${quotation.validity_days} days from date of issue.`,
    'Subject to Pune jurisdiction only.',
  ]
}

export function buildDefaultFooterContact(clientConfig: ClientConfig | undefined): string {
  const prepared = ((clientConfig?.prepared_by as string | undefined) || 'Sales Team').trim()
  const phone = (clientConfig?.phone || '').trim()
  const letterEmail = (
    (clientConfig?.sales_email as string | undefined)?.trim() ||
    (clientConfig?.email || '').trim()
  ).trim()
  let line = `If you have any questions about this quote, please contact ${prepared}`
  if (phone) line += `, ${phone}`
  if (letterEmail) line += `, ${letterEmail}`
  return `${line}.`
}

export function defaultFooterThanks(): string {
  return 'Thank You For Your Business !'
}

export function defaultFooterDisclaimer(): string {
  return 'This quotation was prepared with AI assistance and reviewed by our team.'
}

export function emptySupplementRow(): QuotationPdfValuationSupplementRow {
  return { sr: '', description: '', size: '', qty: '', rate: '', disc: '', total: '' }
}
