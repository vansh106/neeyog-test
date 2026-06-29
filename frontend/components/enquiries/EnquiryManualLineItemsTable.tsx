'use client'

import { Fragment } from 'react'
import { formatCurrency } from '@/lib/utils'

const CASCADE_DISPLAY_ORDER: string[] = [
  'variant_type',
  'product_sheet',
  'construction',
  'valve_size',
  'bore_type',
  'end_connection',
  'pressure',
  'body',
  'ball_disc',
  'ball',
  'stem',
  'seat',
  'fasteners',
  'operator',
  'operator_model',
  'operator_size',
  'sov',
  'limit_switch_box',
  'positioner',
  'bracket_coupler',
  'supplier',
  'supplier_id',
]

function formatLabelKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function sortCascadeKeys(keys: string[]): string[] {
  const rank = (k: string) => {
    const i = CASCADE_DISPLAY_ORDER.indexOf(k)
    return i === -1 ? 1000 : i
  }
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export type EnquiryManualLineRow = {
  id: string
  category: string
  quantity: number
  unit: string
  productLabel: string
  listUnit: number | null
  customerDiscountPct: number | null
  netUnit: number | null
  lineNetTotal: number | null
  cascade: Record<string, string>
}

export function parseManualLineItemsFromParsed(
  parsed: Record<string, unknown> | null,
): EnquiryManualLineRow[] {
  if (!parsed) return []
  const raw = parsed.manual_line_items
  if (!Array.isArray(raw)) return []
  const out: EnquiryManualLineRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const sp =
      o.selectedProduct && typeof o.selectedProduct === 'object'
        ? (o.selectedProduct as Record<string, unknown>)
        : null
    const cascade: Record<string, string> = {}
    if (o.cascadeSelections && typeof o.cascadeSelections === 'object') {
      for (const [k, v] of Object.entries(o.cascadeSelections as Record<string, unknown>)) {
        if (v == null || String(v).trim() === '') continue
        cascade[k] = String(v)
      }
    }
    const baseRaw = sp?.base_price
    const listUnit =
      typeof baseRaw === 'number' && Number.isFinite(baseRaw)
        ? baseRaw
        : baseRaw != null && String(baseRaw).trim() !== ''
          ? Number(baseRaw)
          : null
    const listOk = listUnit != null && Number.isFinite(listUnit)
    const discRaw = o.customer_discount_pct
    const customerDiscountPct =
      typeof discRaw === 'number' && Number.isFinite(discRaw)
        ? Math.min(100, Math.max(0, discRaw))
        : discRaw != null && String(discRaw).trim() !== ''
          ? Math.min(100, Math.max(0, Number(discRaw)))
          : null
    const pct = customerDiscountPct ?? 0
    const netUnit = listOk ? (listUnit as number) * (1 - pct / 100) : null
    const qty = typeof o.quantity === 'number' ? o.quantity : Number(o.quantity) || 0
    const unit = sp && typeof sp.unit === 'string' && sp.unit.trim() ? sp.unit : 'Nos'
    const productLabel =
      (sp && typeof sp.display_label === 'string' && sp.display_label.trim() && sp.display_label) ||
      (sp && typeof sp.name === 'string' && sp.name.trim() && sp.name) ||
      '—'
    const lineNetTotal = netUnit != null && qty > 0 ? netUnit * qty : null
    out.push({
      id: typeof o.id === 'string' ? o.id : String(o.id ?? ''),
      category: typeof o.category === 'string' ? o.category : '—',
      quantity: qty,
      unit,
      productLabel,
      listUnit: listOk ? (listUnit as number) : null,
      customerDiscountPct,
      netUnit,
      lineNetTotal,
      cascade,
    })
  }
  return out
}

const cellBorder = 'border border-[#D4D9CF] px-2.5 py-2 align-top'
const headBorder =
  'border border-[#D4D9CF] bg-[#EEF0EA] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]'

export default function EnquiryManualLineItemsTable({ rows }: { rows: EnquiryManualLineRow[] }) {
  if (rows.length === 0) return null
  const colCount = 9
  return (
    <div className="min-w-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#8A9488]">
        Manual line items
      </h3>
      <div className="mt-3 w-full rounded-lg border-2 border-[#C5CBBF] bg-white">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr>
              <th className={`${headBorder} w-[3rem] text-center`}>#</th>
              <th className={`${headBorder} min-w-0`}>Product</th>
              <th className={`${headBorder} w-[7.5rem]`}>Category</th>
              <th className={`${headBorder} w-[3.25rem] text-right`}>Qty</th>
              <th className={`${headBorder} w-[4rem]`}>Unit</th>
              <th className={`${headBorder} w-[5.5rem] text-right whitespace-nowrap`}>List (unit)</th>
              <th className={`${headBorder} w-[4.25rem] text-right`}>Disc %</th>
              <th className={`${headBorder} w-[5.5rem] text-right whitespace-nowrap`}>Net (unit)</th>
              <th className={`${headBorder} w-[5.75rem] text-right whitespace-nowrap`}>Line net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <Fragment key={row.id || `line-${idx}`}>
                <tr className="bg-white">
                  <td className={`${cellBorder} text-center font-mono text-surface-muted`}>{idx + 1}</td>
                  <td className={`${cellBorder} min-w-0 font-medium text-gray-900 break-words`}>
                    {row.productLabel}
                  </td>
                  <td className={`${cellBorder} break-all text-surface-muted`}>{row.category}</td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>{row.quantity}</td>
                  <td className={`${cellBorder} text-surface-muted`}>{row.unit}</td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>
                    {row.listUnit != null ? formatCurrency(row.listUnit) : '—'}
                  </td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>
                    {row.customerDiscountPct != null ? `${row.customerDiscountPct}%` : '—'}
                  </td>
                  <td className={`${cellBorder} text-right font-mono tabular-nums`}>
                    {row.netUnit != null ? formatCurrency(row.netUnit) : '—'}
                  </td>
                  <td className={`${cellBorder} text-right font-mono font-semibold tabular-nums text-brand-green-700`}>
                    {row.lineNetTotal != null ? formatCurrency(row.lineNetTotal) : '—'}
                  </td>
                </tr>
                <tr className="bg-[#F7F8F4]">
                  <td colSpan={colCount} className="border border-[#D4D9CF] p-0 align-top">
                    <div className="flex items-stretch border-b border-[#D4D9CF] bg-[#E8EAE4] px-3 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]">
                        Specifications — line {idx + 1}
                      </span>
                    </div>
                    {Object.keys(row.cascade).length === 0 ? (
                      <div className="px-3 py-3 text-surface-muted">—</div>
                    ) : (
                      <table className="w-full border-collapse text-[12px]">
                        <thead>
                          <tr className="bg-[#F0F2EC]">
                            <th className="w-[24%] border border-[#D4D9CF] bg-[#F0F2EC] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]">
                              Field
                            </th>
                            <th className="border border-[#D4D9CF] bg-[#F0F2EC] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5C6658]">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortCascadeKeys(Object.keys(row.cascade)).map((k) => (
                            <tr key={k} className="bg-white">
                              <td className={`${cellBorder} w-[24%] font-medium text-[#5C6658] break-words`}>
                                {formatLabelKey(k)}
                              </td>
                              <td className={`${cellBorder} break-words text-gray-900`}>{row.cascade[k]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
