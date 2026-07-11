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

export function buildDefaultMetaQuoteColumn(quotation: Quotation): PdfKvRow[] {
  const quoteDate = formatDateDdMmYyyy(quotation.created_at)
  const validUntil = validUntilDdMmYyyy(quotation.created_at, quotation.validity_days)
  return [
    { label: 'Quotation No', value: quotation.quote_number },
    { label: 'Date', value: quoteDate },
    { label: 'Valid Until', value: validUntil },
  ]
}

export function buildDefaultMetaEnquiryColumn(
  quotation: Quotation,
  linkedEnquiry: EnquiryDetail | null | undefined,
): PdfKvRow[] {
  const rows: PdfKvRow[] = []
  const eno = (quotation.enquiry_number || '').trim()
  if (eno || quotation.enquiry_id) rows.push({ label: 'Enquiry No', value: eno || quotation.enquiry_id })
  const enquiryDate = formatDateDdMmYyyy(linkedEnquiry?.created_at ?? null)
  if (enquiryDate !== '—') rows.push({ label: 'Enquiry Date', value: enquiryDate })
  const src = String(
    (linkedEnquiry?.parsed_data as { enquiry_source?: string } | undefined)?.enquiry_source || '',
  ).trim()
  if (src) rows.push({ label: 'Enquiry Reference', value: src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })
  return rows
}

export function buildDefaultMetaOwnerColumn(
  clientConfig: ClientConfig | undefined,
  preparer?: QuotationPreparer,
): PdfKvRow[] {
  const rows: PdfKvRow[] = []
  const name = (
    preparer?.name?.trim() ||
    ((clientConfig?.prepared_by as string | undefined) || 'Sales Team').trim()
  )
  rows.push({ label: 'Quote Owner', value: name })
  const phone = preparer?.phone?.trim()
  if (phone) rows.push({ label: 'Contact', value: phone })
  const email = (
    preparer?.email?.trim() ||
    (clientConfig?.sales_email as string | undefined)?.trim() ||
    (clientConfig?.email || '').trim() ||
    ''
  )
  if (email) rows.push({ label: 'Email', value: email })
  return rows
}

export function defaultThankYouBanner(): string {
  return ''
}

export function defaultCompanyRightBlurb(): string {
  return ''
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

export function buildDefaultTerms(quotation: Quotation, companyName?: string): string[] {
  const gstRate = quotation.gst_rate
  const pfRate = quotation.pf_rate
  const company = (companyName || 'Neeyog Packaging').trim()
  const freightAmt = Number(quotation.freight_amount ?? 0)
  const freightTerm =
    freightAmt > 0 && quotation.freight_rate != null
      ? `Freight @ ${quotation.freight_rate}% — included in valuation total as shown below.`
      : freightAmt > 0
        ? `Freight — ₹${freightAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} included in valuation total as shown below.`
        : `Freight — to-pay / door delivery, charges in customer's scope.`
  return [
    'Any modification to agreed specifications may attract additional commercial charges.',
    `Prices are Ex-works ${company}, Pune.`,
    `GST @ ${gstRate}% extra · P & F @ ${pfRate}% extra.`,
    freightTerm,
    'Warranty: 12 months from date of invoice, against manufacturing defects only.',
    "Third-party inspection, if required — extra at actual and in customer's scope.",
    `Offer validity: up to ${quotation.validity_days} days from date of issue.`,
    'Subject to Pune jurisdiction only.',
  ]
}

export function buildDefaultFooterContact(
  _clientConfig: ClientConfig | undefined,
  _preparer?: QuotationPreparer,
): string {
  return ''
}

export function defaultFooterThanks(): string {
  return 'Thank You For Your Business!'
}

export type BankDetails = {
  account_name?: string
  bank?: string
  account_no?: string
  ifsc?: string
  branch?: string
  account_type?: string
  swift?: string
}

export function resolveBankDetails(clientConfig: ClientConfig | undefined): BankDetails | null {
  const raw = clientConfig?.bank_details
  if (!raw || typeof raw !== 'object') return null
  const bd = raw as BankDetails
  const hasValue = Object.values(bd).some((v) => String(v || '').trim())
  return hasValue ? bd : null
}

export function defaultFooterDisclaimer(): string {
  return 'Ai quotation powered by ClevrScan'
}

export function emptySupplementRow(): QuotationPdfValuationSupplementRow {
  return { sr: '', description: '', size: '', qty: '', rate: '', disc: '', total: '' }
}
