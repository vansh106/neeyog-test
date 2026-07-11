/**
 * Regenerate backend/db/data/master_sidebar_nav_leaves.json from the Masters sidebar tree.
 * Run when frontend/lib/masterSidebarNav.ts changes:
 *   cd frontend && npx tsx scripts/export-master-nav-leaves.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { MASTER_SIDEBAR_NAV } from '../lib/masterSidebarNav'

type NavLeaf = {
  kind: 'leaf'
  key: string
  label: string
  variantType?: string
  variantContains?: string
  variantExcludeContains?: string
  variantContainsAny?: string[]
  modelNamePrefix?: string
  navSlug?: string
}

function walk(nodes: typeof MASTER_SIDEBAR_NAV, path: string[] = []): object[] {
  const out: object[] = []
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      const leaf = node as NavLeaf
      out.push({
        path,
        key: leaf.key,
        label: leaf.label,
        variantType: leaf.variantType ?? null,
        variantContains: leaf.variantContains ?? null,
        variantExcludeContains: leaf.variantExcludeContains ?? null,
        variantContainsAny: leaf.variantContainsAny ?? null,
        modelNamePrefix: leaf.modelNamePrefix ?? null,
        navSlug: leaf.navSlug ?? null,
      })
    } else {
      out.push(...walk(node.children, [...path, node.label]))
    }
  }
  return out
}

const here = dirname(fileURLToPath(import.meta.url))
const outPath = join(here, '../../backend/db/data/master_sidebar_nav_leaves.json')
mkdirSync(dirname(outPath), { recursive: true })
const leaves = walk(MASTER_SIDEBAR_NAV)
writeFileSync(outPath, JSON.stringify(leaves, null, 2))
console.log(`Wrote ${leaves.length} leaves to ${outPath}`)
