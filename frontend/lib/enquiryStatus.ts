/** Display labels for enquiry workflow statuses (API values unchanged). */
export const ENQUIRY_STATUS_LABELS: Record<string, string> = {
  received: 'Incomplete',
  approved: 'Quoted',
  pending_email_approval: 'Pending email approval',
  email_rejected: 'Email rejected',
  parsing: 'Parsing',
  matching: 'Matching',
  quoting: 'Quoting',
  awaiting_info: 'Awaiting info',
  pending_approval: 'Pending approval',
  pending_human_review: 'Pending review',
  failed: 'Failed',
  complete: 'Complete',
  incomplete: 'Incomplete',
  quoted: 'Quoted',
  approved_sent: 'Quoted',
  email_approved: 'Email approved',
}

export function enquiryStatusLabel(status: string | null | undefined): string {
  const key = (status || '').trim().toLowerCase()
  if (!key) return 'Unknown'
  return ENQUIRY_STATUS_LABELS[key] ?? key.replace(/_/g, ' ')
}

export const ENQUIRY_LISTING_STATUS_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'received', label: enquiryStatusLabel('received') },
  { value: 'pending_email_approval', label: enquiryStatusLabel('pending_email_approval') },
  { value: 'email_rejected', label: enquiryStatusLabel('email_rejected') },
  { value: 'parsing', label: enquiryStatusLabel('parsing') },
  { value: 'matching', label: enquiryStatusLabel('matching') },
  { value: 'quoting', label: enquiryStatusLabel('quoting') },
  { value: 'awaiting_info', label: enquiryStatusLabel('awaiting_info') },
  { value: 'pending_approval', label: enquiryStatusLabel('pending_approval') },
  { value: 'pending_human_review', label: enquiryStatusLabel('pending_human_review') },
  { value: 'approved', label: enquiryStatusLabel('approved') },
  { value: 'failed', label: enquiryStatusLabel('failed') },
] as const
