export type AgeingBucketKey = 'green' | 'amber' | 'red' | 'critical'

export type PipelineStageKey = 'enquiry' | 'quoted' | 'negotiation'

export const AGEING_BUCKET_ORDER: AgeingBucketKey[] = ['critical', 'red', 'amber', 'green']

export const AGEING_BUCKET_LABEL: Record<AgeingBucketKey, string> = {
  critical: '45+ days',
  red: '22–45 days',
  amber: '8–21 days',
  green: '<7 days',
}

export const AGEING_CELL_CLASS: Record<AgeingBucketKey, string> = {
  green: 'bg-emerald-100 text-emerald-950 font-semibold',
  amber: 'bg-amber-100 text-amber-950 font-semibold',
  red: 'bg-red-100 text-red-950 font-semibold',
  critical: 'bg-red-900 text-white font-semibold',
}

export const STAGE_PILL: Record<PipelineStageKey, string> = {
  enquiry: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80',
  quoted: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80',
  negotiation: 'bg-orange-100 text-orange-900 ring-1 ring-orange-200/80',
}

export const NEXT_ACTION_CLASS = {
  overdue: 'text-red-800 font-semibold',
  upcoming: 'text-amber-800 font-medium',
  neutral: 'text-surface-muted',
  none: 'text-surface-muted italic',
} as const
