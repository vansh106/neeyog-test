export type ArchiveFilter = 'active' | 'archived'

export const ARCHIVE_FILTER_OPTIONS: { value: ArchiveFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

export function matchesArchiveFilter(isArchived: boolean | undefined, filter: ArchiveFilter): boolean {
  return filter === 'archived' ? Boolean(isArchived) : !isArchived
}

export function archivedListingRowClass(isArchived: boolean | undefined): string {
  return isArchived
    ? 'bg-red-50 hover:bg-red-100/80'
    : 'bg-white hover:bg-[#F4F5F0]'
}
