export type HoseLengthUnit = 'm' | 'cm'

export function hoseLengthUnitLabel(unit: HoseLengthUnit): string {
  return unit === 'cm' ? 'cm' : 'mtr'
}

export function hoseLengthToMeters(value: number, unit: HoseLengthUnit): number {
  return unit === 'cm' ? value / 100 : value
}

export function parseHoseLengthInput(raw: string): number | null {
  const n = Number((raw || '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function formatHoseLength(value: number, unit: HoseLengthUnit): string {
  if (unit === 'cm') return `${value} cm`
  return `${value} mtr`
}

/** Masters list price is per meter; multiply by length to get one hose piece price. */
export function hosePriceForLength(
  pricePerMeter: number | null | undefined,
  length: number,
  unit: HoseLengthUnit,
): number | null {
  if (pricePerMeter == null || !Number.isFinite(pricePerMeter) || pricePerMeter <= 0) return null
  if (!Number.isFinite(length) || length <= 0) return null
  return pricePerMeter * hoseLengthToMeters(length, unit)
}
