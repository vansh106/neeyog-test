export interface FollowUpHistoryEntry {
  date: string
  note?: string
  recorded_at?: string | null
  recorded_by_name?: string | null
}

export function formatFollowUpHistoryDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
