export const LOST_REASON_HIGH_PRICE = 'High price'
export const LOST_REASON_DELIVERY_TIME = 'Delivery time'
export const LOST_REASON_OTHER = 'Other'

export const BUILT_IN_LOST_REASONS = [LOST_REASON_HIGH_PRICE, LOST_REASON_DELIVERY_TIME] as const

const CUSTOM_STORAGE_KEY = 'parth_cpq_lost_reason_custom_options'
const REMARKS_SEPARATOR = ' | '

export type LostRemarksDraft = {
  reason1: string
  other1: string
}

function readCustomReasons(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((v) => String(v).trim())
      .filter((v) => v && v !== LOST_REASON_OTHER && !BUILT_IN_LOST_REASONS.includes(v as (typeof BUILT_IN_LOST_REASONS)[number]))
  } catch {
    return []
  }
}

function writeCustomReasons(reasons: string[]) {
  if (typeof window === 'undefined') return
  const unique = Array.from(
    new Set(
      reasons
        .map((v) => v.trim())
        .filter(
          (v) =>
            v &&
            v !== LOST_REASON_OTHER &&
            !BUILT_IN_LOST_REASONS.includes(v as (typeof BUILT_IN_LOST_REASONS)[number]),
        ),
    ),
  )
  window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(unique))
}

export function getLostReasonSelectOptions(): string[] {
  return [...BUILT_IN_LOST_REASONS, ...readCustomReasons()]
}

export function rememberCustomLostReason(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trimmed === LOST_REASON_OTHER) return
  if (BUILT_IN_LOST_REASONS.includes(trimmed as (typeof BUILT_IN_LOST_REASONS)[number])) return
  const next = [...readCustomReasons(), trimmed]
  writeCustomReasons(next)
}

function isKnownReason(value: string, options: string[]): boolean {
  return BUILT_IN_LOST_REASONS.includes(value as (typeof BUILT_IN_LOST_REASONS)[number]) || options.includes(value)
}

function partToDraft(part: string, options: string[]): LostRemarksDraft {
  const trimmed = part.trim()
  if (!trimmed) return { reason1: '', other1: '' }
  if (isKnownReason(trimmed, options)) {
    return { reason1: trimmed, other1: '' }
  }
  rememberCustomLostReason(trimmed)
  return { reason1: LOST_REASON_OTHER, other1: trimmed }
}

/** Parses stored remarks — only the first reason is used (legacy `a | b` keeps `a`). */
export function parseLostRemarks(remarks: string | null | undefined): LostRemarksDraft {
  const options = getLostReasonSelectOptions()
  const text = (remarks ?? '').trim()
  if (!text) {
    return { reason1: '', other1: '' }
  }

  const firstPart = text.split(REMARKS_SEPARATOR).map((p) => p.trim()).filter(Boolean)[0] ?? ''
  if (!firstPart) {
    return { reason1: '', other1: '' }
  }

  return partToDraft(firstPart, options)
}

function resolveReason(selection: string, otherText: string): string | null {
  if (!selection) return null
  if (selection === LOST_REASON_OTHER) {
    const trimmed = otherText.trim()
    return trimmed || null
  }
  return selection
}

export function formatLostRemarks(draft: LostRemarksDraft): string {
  const reason = resolveReason(draft.reason1, draft.other1)
  if (!reason) return ''
  if (draft.reason1 === LOST_REASON_OTHER) rememberCustomLostReason(reason)
  return reason
}

export function isLostRemarksComplete(draft: LostRemarksDraft): boolean {
  return formatLostRemarks(draft).length > 0
}

export function lostRemarksValidationMessage(draft: LostRemarksDraft): string | null {
  if (draft.reason1 === LOST_REASON_OTHER && !draft.other1.trim()) {
    return 'Enter a reason for Other.'
  }
  if (!isLostRemarksComplete(draft)) {
    return 'Select a lost reason.'
  }
  return null
}
