export const ENQUIRY_DETAIL_TYPES = ['complete', 'incomplete'] as const

export type EnquiryDetailType = (typeof ENQUIRY_DETAIL_TYPES)[number]

export const ENQUIRY_DETAIL_TYPE_LABELS: Record<EnquiryDetailType, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
}

export function isEnquiryDetailType(value: string): value is EnquiryDetailType {
  return (ENQUIRY_DETAIL_TYPES as readonly string[]).includes(value)
}

export function normalizeEnquiryDetailType(value: string | null | undefined): EnquiryDetailType {
  const v = (value || '').trim().toLowerCase()
  if (v === 'partially_complete') return 'incomplete'
  return isEnquiryDetailType(v) ? v : 'incomplete'
}

export function enquiryDetailTypeLabel(value: string | null | undefined): string {
  const normalized = normalizeEnquiryDetailType(value)
  return ENQUIRY_DETAIL_TYPE_LABELS[normalized]
}

export function isEnquiryDetailTypeLocked(value: string | null | undefined): boolean {
  return normalizeEnquiryDetailType(value) === 'complete'
}

/** Manual product dropdowns and quotation generation are allowed only for complete enquiries. */
export function canGenerateQuotationFromEnquiry(value: string | null | undefined): boolean {
  return normalizeEnquiryDetailType(value) === 'complete'
}
