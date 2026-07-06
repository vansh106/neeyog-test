import type { ValveProduct } from '@/types'

/** Fields copied from a hose fitting catalog row into quotation cascade. */
export const FITTING_CASCADE_KEYS = [
  'variant_type',
  'end_connection_1',
  'end_connection_2',
  'size_mm',
  'hose_nipple_moc',
  'hose_cap_moc',
  'sms_nut_moc',
  'tc_od',
  'din_nut_moc',
  'swivel_nut_moc',
  'flange_nut_moc',
] as const

const FITTING_SUFFIXES = [
  'variant_type',
  'end_connection',
  'end_connection_1',
  'end_connection_2',
  'size_mm',
  'hose_nipple_moc',
  'hose_cap_moc',
  'sms_nut_moc',
  'tc_od',
  'din_nut_moc',
  'swivel_nut_moc',
  'flange_nut_moc',
] as const

const DESC_SEP = ' : '

function rowField(product: ValveProduct, field: string): string {
  return String((product as unknown as Record<string, unknown>)[field] ?? '').trim()
}

export function fittingsEquivalent(
  fit1: ValveProduct | null | undefined,
  fit2: ValveProduct | null | undefined,
  bare1: boolean,
  bare2: boolean,
): boolean {
  if (bare1 !== bare2) return false
  if (bare1 && bare2) return true
  if (!fit1 || !fit2) return false
  if (fit1.id && fit2.id && fit1.id === fit2.id) return true
  for (const field of FITTING_CASCADE_KEYS) {
    if (rowField(fit1, field) !== rowField(fit2, field)) return false
  }
  return true
}

/** Build prefixed cascade fields for one hose fitting, collapsing duplicate end connections. */
export function fittingCascadeFields(
  product: ValveProduct,
  prefix: string,
): Record<string, string> {
  const out: Record<string, string> = {}
  const ec1 = rowField(product, 'end_connection_1')
  const ec2 = rowField(product, 'end_connection_2')
  const collapseEndConnections = Boolean(ec1 && ec2 && ec1 === ec2)

  for (const field of FITTING_CASCADE_KEYS) {
    if (collapseEndConnections && (field === 'end_connection_1' || field === 'end_connection_2')) {
      continue
    }
    const raw = rowField(product, field)
    if (!raw) continue
    out[`${prefix}_${field}`] = raw
  }

  if (collapseEndConnections) {
    out[`${prefix}_end_connection`] = ec1
  }

  return out
}

function fittingBlockFromCascade(cascade: Record<string, string>, prefix: string): Record<string, string> {
  const block: Record<string, string> = {}
  for (const suffix of FITTING_SUFFIXES) {
    const key = `${prefix}_${suffix}`
    const val = cascade[key]?.trim()
    if (val) block[suffix] = val
  }
  return block
}

function collapseEndConnectionsInCascade(cascade: Record<string, string>): Record<string, string> {
  const out = { ...cascade }
  for (const prefix of ['fitting_end_1', 'fitting_end_2', 'fitting'] as const) {
    const ec1 = out[`${prefix}_end_connection_1`]?.trim()
    const ec2 = out[`${prefix}_end_connection_2`]?.trim()
    if (ec1 && ec2 && ec1 === ec2) {
      out[`${prefix}_end_connection`] = ec1
      delete out[`${prefix}_end_connection_1`]
      delete out[`${prefix}_end_connection_2`]
    }
  }
  return out
}

/** Merge identical hose fittings on both ends into a single ``fitting_*`` block. */
export function collapseDuplicateFittingCascade(
  cascade: Record<string, string>,
): Record<string, string> {
  let out = collapseEndConnectionsInCascade(cascade)
  if ((out.fitting_end_1_qty ?? '').trim() === '2') {
    return out
  }

  const end1 = fittingBlockFromCascade(out, 'fitting_end_1')
  const end2 = fittingBlockFromCascade(out, 'fitting_end_2')
  if (end1 && end2 && JSON.stringify(end1) === JSON.stringify(end2)) {
    for (const suffix of FITTING_SUFFIXES) {
      delete out[`fitting_end_1_${suffix}`]
      delete out[`fitting_end_2_${suffix}`]
    }
    delete out.fitting_end_1
    delete out.fitting_end_2
    for (const [suffix, val] of Object.entries(end1)) {
      out[`fitting_${suffix}`] = val
    }
    out.fitting = 'Both ends (same type)'
    return out
  }

  const end1Summary = out.fitting_end_1?.trim()
  const end2Summary = out.fitting_end_2?.trim()
  if (end1Summary && end2Summary && end1Summary === end2Summary && !end1 && !end2) {
    delete out.fitting_end_1
    delete out.fitting_end_2
    out.fitting = end1Summary
  }

  return out
}

function parseDescLine(line: string): { label: string; value: string } | null {
  const i = line.indexOf(DESC_SEP)
  if (i === -1) return null
  return { label: line.slice(0, i).trim(), value: line.slice(i + DESC_SEP.length).trim() }
}

function normalizeFittingSuffixMap(map: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = Object.fromEntries(map)
  const ec1 = out['End Connection 1']
  const ec2 = out['End Connection 2']
  if (ec1 && ec2 && ec1 === ec2) {
    delete out['End Connection 1']
    delete out['End Connection 2']
    out['End Connection'] = ec1
  }
  return out
}

/** Collapse duplicate fitting lines in stored quotation descriptions (legacy rows). */
export function collapseDuplicateFittingDescription(desc: string): string {
  if (!desc.includes('Fitting End')) {
    return collapseDuplicateEndConnectionLines(desc)
  }

  const parsed = desc.split('\n').map((line) => ({ raw: line, parsed: parseDescLine(line),}))
  const end1 = new Map<string, string>()
  const end2 = new Map<string, string>()
  const kept: string[] = []

  for (const row of parsed) {
    if (!row.parsed) {
      kept.push(row.raw)
      continue
    }
  
    const { label, value } = row.parsed
  
    if (label.startsWith('Fitting End 1 ')) {
      end1.set(label.slice('Fitting End 1 '.length), value)
      continue
    }
  
    if (label.startsWith('Fitting End 2 ')) {
      end2.set(label.slice('Fitting End 2 '.length), value)
      continue
    }
  
    kept.push(row.raw)
  }

  if (end1.size === 0 || end2.size === 0) {
    return collapseDuplicateEndConnectionLines(desc)
  }

  const norm1 = normalizeFittingSuffixMap(end1)
  const norm2 = normalizeFittingSuffixMap(end2)
  const keys = new Set([...Object.keys(norm1), ...Object.keys(norm2)])
  const same = [...keys].every((key) => (norm1[key] ?? '') === (norm2[key] ?? ''))

  if (!same) {
    return collapseDuplicateEndConnectionLines(desc)
  }

  const merged: string[] = [`Fitting${DESC_SEP}Both ends (same type)`]
  for (const [suffix, value] of Object.entries(norm1)) {
    merged.push(`Fitting ${suffix}${DESC_SEP}${value}`)
  }

  const productIdx = kept.findIndex((line) => line.startsWith(`Product${DESC_SEP}`))
  if (productIdx === -1) {
    return collapseDuplicateEndConnectionLines([...merged, ...kept].join('\n'))
  }
  return collapseDuplicateEndConnectionLines(
    [...kept.slice(0, productIdx + 1), ...merged, ...kept.slice(productIdx + 1)].join('\n'),
  )
}

function collapseDuplicateEndConnectionLines(desc: string): string {
  return desc
    .split('\n')
    .filter((line, _idx, all) => {
      const parsed = parseDescLine(line)
      if (!parsed) return true
      const m = parsed.label.match(/^(Fitting(?: End \d+)?) End Connection ([12])$/)
      if (!m) return true
      const prefix = m[1]
      const siblingLabel = `${prefix} End Connection ${m[2] === '1' ? '2' : '1'}`
      const sibling = all.find((l) => parseDescLine(l)?.label === siblingLabel)
      const siblingVal = sibling ? parseDescLine(sibling)?.value : undefined
      if (siblingVal && siblingVal === parsed.value) {
        return m[2] === '1'
      }
      return true
    })
    .map((line) => {
      const parsed = parseDescLine(line)
      if (!parsed) return line
      const m = parsed.label.match(/^(Fitting(?: End \d+)?) End Connection 1$/)
      if (!m) return line
      const siblingLabel = `${m[1]} End Connection 2`
      const hasDuplicateSibling = desc.split('\n').some((l) => {
        const p = parseDescLine(l)
        return p?.label === siblingLabel && p.value === parsed.value
      })
      if (hasDuplicateSibling) {
        return `${m[1]} End Connection${DESC_SEP}${parsed.value}`
      }
      return line
    })
    .join('\n')
}
