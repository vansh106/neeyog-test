export type HoseLengthUnit = 'm' | 'cm' | 'mm'

export function hoseLengthUnitLabel(unit: HoseLengthUnit): string {
  if (unit === 'cm') return 'cm'
  if (unit === 'mm') return 'mm'
  return 'mtr'
}

export function hoseLengthToMeters(value: number, unit: HoseLengthUnit): number {
  if (unit === 'cm') return value / 100
  if (unit === 'mm') return value / 1000
  return value
}

export function parseHoseLengthInput(raw: string): number | null {
  const n = Number((raw || '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function formatHoseLength(value: number, unit: HoseLengthUnit): string {
  if (unit === 'cm') return `${value} cm`
  if (unit === 'mm') return `${value} mm`
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
