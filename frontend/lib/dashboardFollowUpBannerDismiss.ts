const STORAGE_KEY = 'parth_cpq_follow_up_banner_dismissed'

function todayLocalKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isFollowUpBannerDismissedToday(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === todayLocalKey()
  } catch {
    return false
  }
}

export function dismissFollowUpBannerForToday(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, todayLocalKey())
  } catch {
    // ignore quota / private mode
  }
}
