export const ENQUIRY_SOURCES = ['email', 'indiamart', 'manual', 'referral'] as const

export type EnquirySource = (typeof ENQUIRY_SOURCES)[number]

export const ENQUIRY_SOURCE_OPTIONS: { value: EnquirySource; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'indiamart', label: 'IndiaMart' },
  { value: 'manual', label: 'Manual' },
  { value: 'referral', label: 'Referral' },
]

export function formatEnquirySourceLabel(source: string | null | undefined): string {
  const s = (source || '').trim().toLowerCase()
  const found = ENQUIRY_SOURCE_OPTIONS.find((o) => o.value === s)
  if (found) return found.label
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function enquirySourceBadgeClass(source: string | null | undefined): string {
  const s = (source || '').trim().toLowerCase()
  switch (s) {
    case 'email':
      return 'bg-sky-50 text-sky-800 border border-sky-200'
    case 'indiamart':
      return 'bg-orange-50 text-orange-800 border border-orange-200'
    case 'manual':
      return 'bg-violet-50 text-violet-800 border border-violet-200'
    case 'referral':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200'
  }
}
