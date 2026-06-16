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

export type QuotationPreparer = {
  email?: string | null
  name?: string | null
  phone?: string | null
}

export function resolveQuotationPreparer(
  quotation: {
    created_by_name?: string | null
    created_by_email?: string | null
    created_by_phone?: string | null
  },
  sessionUser?: { email: string; full_name: string; phone?: string | null } | null,
): QuotationPreparer {
  return {
    email: sessionUser?.email?.trim() || quotation.created_by_email?.trim() || null,
    name: sessionUser?.full_name?.trim() || quotation.created_by_name?.trim() || null,
    phone: sessionUser?.phone?.trim() || quotation.created_by_phone?.trim() || null,
  }
}

function appendPreparerContactRows(
  rows: PdfKvRow[],
  preparer?: QuotationPreparer,
  clientConfig?: ClientConfig,
): void {
  const phone = preparer?.phone?.trim() || null
  const email = (
    preparer?.email?.trim() ||
    (clientConfig?.sales_email as string | undefined)?.trim() ||
    (clientConfig?.email || '').trim() ||
    null
  )
  const prepared = (
    preparer?.name?.trim() ||
    ((clientConfig?.prepared_by as string | undefined) || 'Sales Team').trim()
  )
  if (phone) rows.push({ label: 'Phone', value: phone })
  if (email) rows.push({ label: 'E-Mail', value: email })
  if (prepared) rows.push({ label: 'Prepared By', value: prepared })
}

export function buildDefaultHeaderLeft(
  clientConfig: ClientConfig | undefined,
  preparer?: QuotationPreparer,
): PdfKvRow[] {
  const rows: PdfKvRow[] = []
  const addr = (clientConfig?.address || '').trim()
  if (addr) rows.push({ label: 'Address', value: addr })
  const website = (clientConfig?.website as string | undefined)?.trim()
  if (website) rows.push({ label: 'Website', value: website })
  appendPreparerContactRows(rows, preparer, clientConfig)
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

export function buildDefaultFooterContact(
  clientConfig: ClientConfig | undefined,
  preparer?: QuotationPreparer,
): string {
  const prepared = (
    preparer?.name?.trim() ||
    ((clientConfig?.prepared_by as string | undefined) || 'Sales Team').trim()
  ).trim()
  const prepPhone = preparer?.phone?.trim()
  const companyPhone = (clientConfig?.phone || '').trim()
  const letterEmail = (
    preparer?.email?.trim() ||
    (clientConfig?.sales_email as string | undefined)?.trim() ||
    (clientConfig?.email || '').trim()
  ).trim()
  let line = `If you have any questions about this quote, please contact ${prepared}`
  if (prepPhone) line += `, ${prepPhone}`
  else if (companyPhone) line += `, ${companyPhone}`
  if (letterEmail) line += `, ${letterEmail}`
  return `${line}.`
}

export function defaultFooterThanks(): string {
  return 'Thank You For Your Business !'
}

export function defaultFooterDisclaimer(): string {
  return 'Ai quotation powered by ClevrScan'
}

export function emptySupplementRow(): QuotationPdfValuationSupplementRow {
  return { sr: '', description: '', size: '', qty: '', rate: '', disc: '', total: '' }
}
