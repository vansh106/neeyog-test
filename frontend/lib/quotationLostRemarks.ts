export const LOST_REASON_HIGH_PRICE = 'High price'
export const LOST_REASON_DELIVERY_TIME = 'Delivery time'
export const LOST_REASON_NO_RESPONSE = 'No response'
export const LOST_REASON_LOCALLY_PURCHASED = 'Locally purchased'

export const BUILT_IN_LOST_REASONS = [
  LOST_REASON_HIGH_PRICE,
  LOST_REASON_DELIVERY_TIME,
  LOST_REASON_NO_RESPONSE,
  LOST_REASON_LOCALLY_PURCHASED,
] as const

const REMARKS_SEPARATOR = ' | '

export type LostRemarksDraft = {
  /** Hardcoded lost reason from the dropdown. */
  reason1: string
  /** Required free-text detail (always saved with the hardcoded reason). */
  other1: string
}

function isBuiltInReason(value: string): boolean {
  return BUILT_IN_LOST_REASONS.includes(value as (typeof BUILT_IN_LOST_REASONS)[number])
}

/** Parses stored remarks into hardcoded reason + Other text. */
export function parseLostRemarks(remarks: string | null | undefined): LostRemarksDraft {
  const text = (remarks ?? '').trim()
  if (!text) {
    return { reason1: '', other1: '' }
  }

  const parts = text.split(REMARKS_SEPARATOR).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const [first, ...rest] = parts
    const other1 = rest.join(REMARKS_SEPARATOR).trim()
    if (isBuiltInReason(first)) {
      return { reason1: first, other1 }
    }
  }

  const single = parts[0] ?? text
  if (isBuiltInReason(single)) {
    return { reason1: single, other1: '' }
  }

  // Legacy free-text-only remarks — keep text in Other; user must also pick a hardcoded reason.
  return { reason1: '', other1: single }
}

export function formatLostRemarks(draft: LostRemarksDraft): string {
  const reason = draft.reason1.trim()
  const other = draft.other1.trim()
  if (!reason || !other) return ''
  return `${reason}${REMARKS_SEPARATOR}${other}`
}

export function isLostRemarksComplete(draft: LostRemarksDraft): boolean {
  return Boolean(draft.reason1.trim() && draft.other1.trim())
}

export function lostRemarksValidationMessage(draft: LostRemarksDraft): string | null {
  if (!draft.reason1.trim()) {
    return 'Select a lost reason.'
  }
  if (!draft.other1.trim()) {
    return 'Enter details in Other.'
  }
  return null
}
