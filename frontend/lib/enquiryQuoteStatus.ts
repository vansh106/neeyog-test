export const ENQUIRY_QUOTE_STATUSES = ['not_quoted', 'quoted'] as const

export type EnquiryQuoteStatus = (typeof ENQUIRY_QUOTE_STATUSES)[number]

export const ENQUIRY_QUOTE_STATUS_LABELS: Record<EnquiryQuoteStatus, string> = {
  not_quoted: 'Not Quoted',
  quoted: 'Quoted',
}

export function normalizeEnquiryQuoteStatus(raw: string | null | undefined): EnquiryQuoteStatus {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (v === 'partially_quoted') return 'quoted'
  if (v === 'quoted' || v === 'not_quoted') return v
  return 'not_quoted'
}

export function enquiryQuoteStatusLabel(raw: string | null | undefined): string {
  return ENQUIRY_QUOTE_STATUS_LABELS[normalizeEnquiryQuoteStatus(raw)]
}
