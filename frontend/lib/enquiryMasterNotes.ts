import { MASTER_SIDEBAR_NAV, type MasterNavNode } from '@/lib/masterSidebarNav'

export type MasterNotesSelections = {
  families: string[]
  categories: string[]
  subCategories: string[]
}

export const EMPTY_MASTER_NOTES_SELECTIONS: MasterNotesSelections = {
  families: [],
  categories: [],
  subCategories: [],
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

export function getCategoriesForFamilySelections(selectedFamilies: string[]): string[] {
  const families =
    selectedFamilies.length > 0 ? selectedFamilies : getMasterNotesFamilies()
  const categories: string[] = []
  for (const family of families) {
    categories.push(...getMasterNotesCategories(family))
  }
  return uniqueSorted(categories)
}

export function getSubCategoriesForSelections(
  selectedFamilies: string[],
  selectedCategories: string[],
): string[] {
  const families =
    selectedFamilies.length > 0 ? selectedFamilies : getMasterNotesFamilies()
  const subCategories: string[] = []

  for (const family of families) {
    const categories =
      selectedCategories.length > 0
        ? selectedCategories.filter((category) =>
            getMasterNotesCategories(family).includes(category),
          )
        : getMasterNotesCategories(family)

    for (const category of categories) {
      subCategories.push(...getMasterNotesSubCategories(family, category))
    }
  }

  return uniqueSorted(subCategories)
}

export function pruneMasterNotesSelections(sel: MasterNotesSelections): MasterNotesSelections {
  const families = sel.families
  const validCategories = getCategoriesForFamilySelections(families)
  const categories = sel.categories.filter((category) => validCategories.includes(category))
  const validSubCategories = getSubCategoriesForSelections(families, categories)
  const subCategories = sel.subCategories.filter((subCategory) =>
    validSubCategories.includes(subCategory),
  )
  return { families, categories, subCategories }
}

export function toggleMasterNotesItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

export function formatMasterNotesSelections(sel: Partial<MasterNotesSelections>): string {
  const lines: string[] = []
  if (sel.families?.length) lines.push(`Family: ${sel.families.join(', ')}`)
  if (sel.categories?.length) lines.push(`Category: ${sel.categories.join(', ')}`)
  if (sel.subCategories?.length) lines.push(`Sub-category: ${sel.subCategories.join(', ')}`)
  return lines.join('\n')
}

export function buildEnquiryNotes(
  master: Partial<MasterNotesSelections>,
  additional: string,
): string {
  const structured = formatMasterNotesSelections(master)
  const extra = additional.trim()
  if (!structured) return extra
  if (!extra) return structured
  return `${structured}\n\n${extra}`
}
