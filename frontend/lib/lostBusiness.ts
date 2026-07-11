export const LOSS_REASON_PILL: Record<string, string> = {
  Price: 'bg-red-100 text-red-900 ring-1 ring-red-200/80',
  'Delivery time': 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80',
  'No response': 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80',
  Specification: 'bg-blue-100 text-blue-900 ring-1 ring-blue-200/80',
  Competitor: 'bg-purple-100 text-purple-900 ring-1 ring-purple-200/80',
  Unspecified: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/80',
  Other: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
}

export const STAGE_LOST_PILL: Record<string, string> = {
  quoted: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80',
  negotiation: 'bg-orange-100 text-orange-900 ring-1 ring-orange-200/80',
}

export function lossReasonPillClass(reason: string | null | undefined): string {
  if (!reason) return LOSS_REASON_PILL.Unspecified
  return LOSS_REASON_PILL[reason] ?? LOSS_REASON_PILL.Other
}
