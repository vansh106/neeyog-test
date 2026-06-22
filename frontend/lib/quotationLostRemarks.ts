export const LOST_REASON_HIGH_PRICE = 'High price'
export const LOST_REASON_DELIVERY_TIME = 'Delivery time'
export const LOST_REASON_OTHER = 'Other'

export const BUILT_IN_LOST_REASONS = [LOST_REASON_HIGH_PRICE, LOST_REASON_DELIVERY_TIME] as const

const CUSTOM_STORAGE_KEY = 'parth_cpq_lost_reason_custom_options'
const REMARKS_SEPARATOR = ' | '

export type LostRemarksDraft = {
  reason1: string
  reason2: string
  other1: string
  other2: string
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

function partToDraft(part: string, options: string[]): Pick<LostRemarksDraft, 'reason1' | 'other1'> {
  const trimmed = part.trim()
  if (!trimmed) return { reason1: '', other1: '' }
  if (isKnownReason(trimmed, options)) {
    return { reason1: trimmed, other1: '' }
  }
  rememberCustomLostReason(trimmed)
  return { reason1: LOST_REASON_OTHER, other1: trimmed }
}

export function parseLostRemarks(remarks: string | null | undefined): LostRemarksDraft {
  const options = getLostReasonSelectOptions()
  const text = (remarks ?? '').trim()
  if (!text) {
    return { reason1: '', reason2: '', other1: '', other2: '' }
  }

  const parts = text.split(REMARKS_SEPARATOR).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return { reason1: '', reason2: '', other1: '', other2: '' }
  }

  const first = partToDraft(parts[0], options)
  const second = parts[1] ? partToDraft(parts[1], getLostReasonSelectOptions()) : { reason1: '', other1: '' }

  return {
    reason1: first.reason1,
    other1: first.other1,
    reason2: second.reason1,
    other2: second.other1,
  }
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
  const parts: string[] = []
  const r1 = resolveReason(draft.reason1, draft.other1)
  const r2 = resolveReason(draft.reason2, draft.other2)
  if (r1) {
    if (draft.reason1 === LOST_REASON_OTHER) rememberCustomLostReason(r1)
    parts.push(r1)
  }
  if (r2) {
    if (draft.reason2 === LOST_REASON_OTHER) rememberCustomLostReason(r2)
    parts.push(r2)
  }
  return parts.join(REMARKS_SEPARATOR)
}

export function isLostRemarksComplete(draft: LostRemarksDraft): boolean {
  return formatLostRemarks(draft).length > 0
}

export function lostRemarksValidationMessage(draft: LostRemarksDraft): string | null {
  if (draft.reason1 === LOST_REASON_OTHER && !draft.other1.trim()) {
    return 'Enter a reason for Other (reason 1).'
  }
  if (draft.reason2 === LOST_REASON_OTHER && !draft.other2.trim()) {
    return 'Enter a reason for Other (reason 2).'
  }
  if (!isLostRemarksComplete(draft)) {
    return 'Select at least one lost reason.'
  }
  return null
}
