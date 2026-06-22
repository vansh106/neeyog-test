export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function defaultFyStartIsoDate(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

export function formatReportGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
