import { MASTER_SIDEBAR_NAV, type MasterNavNode } from '@/lib/masterSidebarNav'

/** One product note — family / category / sub-category + optional details. */
export type ProductNoteEntry = {
  id: string
  family: string
  category: string
  subCategory: string
  details: string
}

type MasterNotesPresetIndex = {
  families: string[]
  categoriesByFamily: Record<string, string[]>
  subCategoriesByPath: Record<string, string[]>
}

let cachedIndex: MasterNotesPresetIndex | null = null

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}

function pathKey(family: string, category: string): string {
  return `${family}|${category}`
}

function collectSubCategoryLabels(categoryNode: Extract<MasterNavNode, { kind: 'group' }>): string[] {
  const labels: string[] = []
  for (const child of categoryNode.children) {
    if (child.kind === 'group') labels.push(child.label)
    else if (child.kind === 'leaf') labels.push(child.label)
  }
  return labels
}

function buildPresetIndex(): MasterNotesPresetIndex {
  const families: string[] = []
  const categoriesByFamily: Record<string, string[]> = {}
  const subCategoriesByPath: Record<string, string[]> = {}

  for (const familyNode of MASTER_SIDEBAR_NAV) {
    if (familyNode.kind !== 'group') continue
    families.push(familyNode.label)

    const categories: string[] = []
    for (const child of familyNode.children) {
      if (child.kind === 'group') {
        categories.push(child.label)
        subCategoriesByPath[pathKey(familyNode.label, child.label)] = uniqueSorted(
          collectSubCategoryLabels(child),
        )
      } else if (child.kind === 'leaf') {
        categories.push(child.label)
        subCategoriesByPath[pathKey(familyNode.label, child.label)] = []
      }
    }
    categoriesByFamily[familyNode.label] = uniqueSorted(categories)
  }

  return {
    families: uniqueSorted(families),
    categoriesByFamily,
    subCategoriesByPath,
  }
}

function getPresetIndex(): MasterNotesPresetIndex {
  if (!cachedIndex) cachedIndex = buildPresetIndex()
  return cachedIndex
}

export function getMasterNotesFamilies(): string[] {
  return getPresetIndex().families
}

export function getMasterNotesCategories(family: string): string[] {
  if (!family.trim()) return []
  return getPresetIndex().categoriesByFamily[family] ?? []
}

export function getMasterNotesSubCategories(family: string, category: string): string[] {
  if (!family.trim() || !category.trim()) return []
  return getPresetIndex().subCategoriesByPath[pathKey(family, category)] ?? []
}

export function createEmptyProductNote(): ProductNoteEntry {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `pn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    family: '',
    category: '',
    subCategory: '',
    details: '',
  }
}

export function isProductNoteEmpty(entry: ProductNoteEntry): boolean {
  return (
    !entry.family.trim() &&
    !entry.category.trim() &&
    !entry.subCategory.trim() &&
    !entry.details.trim()
  )
}

export function formatProductNoteEntry(entry: ProductNoteEntry, index: number): string {
  const lines: string[] = [`--- Product note ${index + 1} ---`]
  if (entry.family.trim()) lines.push(`Family: ${entry.family.trim()}`)
  if (entry.category.trim()) lines.push(`Category: ${entry.category.trim()}`)
  if (entry.subCategory.trim()) lines.push(`Sub-category: ${entry.subCategory.trim()}`)
  const details = entry.details.trim()
  if (details) lines.push(`Details: ${details}`)
  return lines.join('\n')
}

/** Build enquiry notes text from one-or-more product note entries. */
export function buildEnquiryNotesFromProductNotes(entries: ProductNoteEntry[]): string {
  const active = entries.filter((e) => !isProductNoteEmpty(e))
  if (active.length === 0) return ''
  return active.map((entry, idx) => formatProductNoteEntry(entry, idx)).join('\n\n')
}

export type EnquiryProductNotePayload = {
  family: string
  category: string
  subCategory: string
  details: string
}

/** Strip structured fields for API payload (omit empty entries). */
export function serializeProductNotes(entries: ProductNoteEntry[]): EnquiryProductNotePayload[] {
  return entries
    .filter((e) => !isProductNoteEmpty(e))
    .map((e) => ({
      family: e.family.trim(),
      category: e.category.trim(),
      subCategory: e.subCategory.trim(),
      details: e.details.trim(),
    }))
}

export function initProductNotesFromPrefill(prefill: string | null | undefined): ProductNoteEntry[] {
  const entry = createEmptyProductNote()
  const text = (prefill || '').trim()
  if (text) entry.details = text
  return [entry]
}

/** Stored on enquiry ``parsed_data.product_notes`` (API / DB shape). */
export type StoredEnquiryProductNote = {
  family: string
  category: string
  subCategory: string
  details: string
}

function normalizeStoredProductNote(raw: unknown): StoredEnquiryProductNote | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const note: StoredEnquiryProductNote = {
    family: String(o.family ?? '').trim(),
    category: String(o.category ?? '').trim(),
    subCategory: String(o.sub_category ?? o.subCategory ?? '').trim(),
    details: String(o.details ?? '').trim(),
  }
  if (!note.family && !note.category && !note.subCategory && !note.details) return null
  return note
}

/** Read structured product notes from enquiry parsed_data. */
export function parseProductNotesFromParsedData(
  parsed: Record<string, unknown> | null | undefined,
): StoredEnquiryProductNote[] {
  const raw = parsed?.product_notes
  if (!Array.isArray(raw)) return []
  return raw
    .map(normalizeStoredProductNote)
    .filter((n): n is StoredEnquiryProductNote => n !== null)
}

/** Primary label for sidebar — e.g. family name, or next best field. */
export function productNotePrimaryLabel(note: StoredEnquiryProductNote): string {
  return note.family || note.category || note.subCategory || 'General'
}

export function productNoteHierarchyLabel(note: StoredEnquiryProductNote): string | null {
  const parts = [note.category, note.subCategory].filter(Boolean)
  return parts.length > 0 ? parts.join(' › ') : null
}

export function storedProductNotesToEntries(notes: StoredEnquiryProductNote[]): ProductNoteEntry[] {
  return notes.map((note) => ({
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `pn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    family: note.family,
    category: note.category,
    subCategory: note.subCategory,
    details: note.details,
  }))
}
