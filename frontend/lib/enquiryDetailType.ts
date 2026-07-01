export const ENQUIRY_DETAIL_TYPES = ['complete', 'incomplete', 'partially_complete'] as const

export type EnquiryDetailType = (typeof ENQUIRY_DETAIL_TYPES)[number]

export const ENQUIRY_DETAIL_TYPE_LABELS: Record<EnquiryDetailType, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  partially_complete: 'Partially complete',
}

export function isEnquiryDetailType(value: string): value is EnquiryDetailType {
  return (ENQUIRY_DETAIL_TYPES as readonly string[]).includes(value)
}

export function normalizeEnquiryDetailType(value: string | null | undefined): EnquiryDetailType {
  const v = (value || '').trim().toLowerCase()
  return isEnquiryDetailType(v) ? v : 'incomplete'
}

export function enquiryDetailTypeLabel(value: string | null | undefined): string {
  const normalized = normalizeEnquiryDetailType(value)
  return ENQUIRY_DETAIL_TYPE_LABELS[normalized]
}

export function isEnquiryDetailTypeLocked(value: string | null | undefined): boolean {
  return normalizeEnquiryDetailType(value) === 'complete'
}
