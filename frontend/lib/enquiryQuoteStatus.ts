export const ENQUIRY_QUOTE_STATUSES = ['not_quoted', 'quoted', 'partially_quoted'] as const

export type EnquiryQuoteStatus = (typeof ENQUIRY_QUOTE_STATUSES)[number]

export const ENQUIRY_QUOTE_STATUS_LABELS: Record<EnquiryQuoteStatus, string> = {
  not_quoted: 'Not Quoted',
  quoted: 'Quoted',
  partially_quoted: 'Partially Quoted',
}

export function normalizeEnquiryQuoteStatus(raw: string | null | undefined): EnquiryQuoteStatus {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (v === 'quoted' || v === 'partially_quoted' || v === 'not_quoted') return v
  return 'not_quoted'
}

export function enquiryQuoteStatusLabel(raw: string | null | undefined): string {
  return ENQUIRY_QUOTE_STATUS_LABELS[normalizeEnquiryQuoteStatus(raw)]
}
