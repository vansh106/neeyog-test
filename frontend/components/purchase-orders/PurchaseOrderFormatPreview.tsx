'use client'

import { useClientConfig } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { PurchaseOrder, PurchaseOrderLineItem } from '@/types'

const NAVY = '#1a2744'
const GREEN = '#1f4d2e'
const BORDER = '#2f2f2f'
const CREAM = '#FFF8E7'
const CREAM_ALT = '#FDF6E3'
const GOLD_ACCENT = '#B8860B'

type Props = {
  po: PurchaseOrder
}

function sanitizeDescription(desc: string | undefined | null): string {
  if (!desc) return '—'
  const out: string[] = []
  for (const line of String(desc).split('\n')) {
    if (!line.includes(' : ')) {
      if (line.trim()) out.push(line)
      continue
    }
    const val = line.split(' : ').slice(1).join(' : ').trim()
    if (!val || val === '----' || val === '—' || val === '-') continue
    out.push(line)
  }
  return out.join('\n') || '—'
}

function lineDescription(line: PurchaseOrderLineItem): string {
  return sanitizeDescription(line.product_name || line.description)
}

function formatPoDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function moneyRs(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PurchaseOrderFormatPreview({ po }: Props) {
  const { data: clientConfig } = useClientConfig()
  const company = (clientConfig?.company_name || 'PARTH VALVES AND HOSES LLP').toUpperCase()
  const address = clientConfig?.address || ''
  const phone = clientConfig?.phone || ''
  const email = clientConfig?.sales_email || clientConfig?.email || ''
  const prepName = po.created_by_name || clientConfig?.prepared_by || 'Sales Team'
  const prepEmail = po.created_by_email || email

  const custCompany = (po.client_company || po.client_name || 'Customer').trim()
  let concernDisplay: string | null = null
  const clientName = po.client_name?.trim() || ''
  if (clientName && clientName.toLowerCase() !== custCompany.toLowerCase()) {
    concernDisplay = clientName
  }

  const finCfg = po.financial_config ?? {}
  const itemTotal = po.subtotal
  const pfAmount = po.pf_amount
  const pfRate = po.pf_rate
  const freightAmount = Number(po.freight_amount ?? 0)
  const freightRate = po.freight_rate
  const freightNote = po.freight_note || 'Included'
  const taxableSubtotal = Math.round((itemTotal + pfAmount + freightAmount) * 100) / 100
  const gstAmount = po.gst_amount
  const cgstAmount = Number(finCfg.cgst_amount ?? gstAmount / 2)
  const sgstAmount = Number(finCfg.sgst_amount ?? gstAmount / 2)
  const igstAmount = Number(finCfg.igst_amount ?? 0)
  const showIgst = Boolean(finCfg.igst_applicable) && igstAmount > 0
  const showCgst = !showIgst && (finCfg.cgst_applicable !== false) && cgstAmount > 0
  const showSgst = !showIgst && (finCfg.sgst_applicable !== false) && sgstAmount > 0

  const pfLabel = pfRate != null ? `P & F (${Number(pfRate).toString()} %)` : 'P & F'
  const freightLabel =
    freightAmount > 0 && freightRate != null ? `FREIGHT (${Number(freightRate).toString()} %)` : 'FREIGHT'

  return (
    <div
      className="mx-auto w-full max-w-[820px] border text-[11px] text-gray-900 shadow-sm"
      style={{ borderColor: BORDER, backgroundColor: CREAM }}
    >
      {/* Header box */}
      <section className="border-b p-3 sm:p-4" style={{ borderColor: BORDER }}>
        <div
          className="grid grid-cols-1 gap-0 border sm:grid-cols-[96px_1fr]"
          style={{ borderColor: BORDER, backgroundColor: CREAM }}
        >
          <div
            className="flex items-center justify-center border-b p-2 sm:border-b-0 sm:border-r"
            style={{ borderColor: BORDER }}
          >
            <img
              src="/branding/parth-valve-logo.jpeg"
              alt=""
              width={180}
              height={90}
              className="h-[58px] w-auto max-w-[170px] object-contain"
            />
          </div>
          <div className="p-2 text-center sm:p-3">
            <p className="text-[17px] font-bold" style={{ color: GREEN }}>
              {company}
            </p>
            <p className="text-[16px] font-bold tracking-wide" style={{ color: NAVY }}>
              PURCHASE ORDER
            </p>
          </div>
        </div>

        <div
          className="mt-2 grid grid-cols-1 gap-3 border p-2 sm:grid-cols-2 sm:p-3"
          style={{ borderColor: BORDER, backgroundColor: CREAM }}
        >
          <div className="space-y-0.5">
            {address && (
              <p>
                <span className="inline-block min-w-[68px] font-semibold">Address</span>: {address}
              </p>
            )}
            {prepEmail && (
              <p>
                <span className="inline-block min-w-[68px] font-semibold">E-Mail</span>: {prepEmail}
              </p>
            )}
            <p>
              <span className="inline-block min-w-[68px] font-semibold">Prepared By</span>: {prepName}
            </p>
          </div>
          <div className="space-y-0.5">
            <p>
              <span className="inline-block min-w-[72px] font-semibold">Date</span>: {formatPoDate(po.created_at)}
            </p>
            <p>
              <span className="inline-block min-w-[72px] font-semibold">PO No</span>:{' '}
              <span className="font-mono">{po.po_number}</span>
            </p>
            {po.quote_number && (
              <p>
                <span className="inline-block min-w-[72px] font-semibold">Quote Ref</span>:{' '}
                <span className="font-mono">{po.quote_number}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Company */}
      <section className="border-b" style={{ borderColor: BORDER, backgroundColor: CREAM_ALT }}>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="border-b p-3 sm:border-b-0 sm:border-r" style={{ borderColor: BORDER }}>
            <p className="font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              COMPANY
            </p>
            <p className="mt-1 text-[12px] font-bold">{custCompany}</p>
          </div>
          <div className="space-y-0.5 p-3">
            {concernDisplay && (
              <p>
                <span className="font-semibold">Concern Person</span> : {concernDisplay}
              </p>
            )}
            {po.client_phone && (
              <p>
                <span className="font-semibold">Contact No.</span> : {po.client_phone}
              </p>
            )}
            {po.client_email && (
              <p>
                <span className="font-semibold">E-Mail</span> : {po.client_email}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Order details */}
      <section className="border-b p-2 sm:p-3" style={{ borderColor: BORDER, backgroundColor: CREAM_ALT }}>
        <p className="mb-2 font-bold uppercase tracking-wide" style={{ color: NAVY }}>
          ORDER DETAILS
        </p>
        <div className="overflow-x-auto border" style={{ borderColor: BORDER }}>
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead style={{ backgroundColor: CREAM }}>
              <tr>
                {['Sr.No', 'Description', 'Size', 'Qty', 'Rate', 'Disc.%', 'Total'].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      'border px-2 py-2 font-bold',
                      h === 'Qty' || h === 'Rate' || h === 'Disc.%' || h === 'Total'
                        ? 'text-right'
                        : h === 'Sr.No'
                          ? 'text-center'
                          : 'text-left',
                    )}
                    style={{ borderColor: BORDER }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.line_items.map((line, idx) => {
                const disc =
                  typeof line.customer_discount_pct === 'number' &&
                  Number.isFinite(line.customer_discount_pct)
                    ? line.customer_discount_pct
                    : 0
                const qtyCell = `${line.quantity} ${line.unit || 'Nos'}`.trim()
                const lineTotal = line.line_total ?? line.unit_price * line.quantity
                return (
                  <tr
                    key={idx}
                    className="align-top"
                    style={{ backgroundColor: idx % 2 === 1 ? '#ffffff' : CREAM_ALT }}
                  >
                    <td
                      className="border px-2 py-2 text-center align-top tabular-nums"
                      style={{ borderColor: BORDER }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      className="max-w-[320px] whitespace-pre-line border px-2 py-2 align-top"
                      style={{ borderColor: BORDER }}
                    >
                      {lineDescription(line)}
                    </td>
                    <td
                      className="border px-2 py-2 align-top text-gray-700"
                      style={{ borderColor: BORDER }}
                    >
                      {line.size || '—'}
                    </td>
                    <td
                      className="border px-2 py-2 text-right font-mono align-top"
                      style={{ borderColor: BORDER }}
                    >
                      {qtyCell}
                    </td>
                    <td
                      className="border px-2 py-2 text-right font-mono align-top"
                      style={{ borderColor: BORDER }}
                    >
                      {line.unit_price.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      className="border px-2 py-2 text-right font-mono align-top"
                      style={{ borderColor: BORDER }}
                    >
                      {disc ? String(disc) : '0'}
                    </td>
                    <td
                      className="border px-2 py-2 text-right font-mono font-medium align-top"
                      style={{ borderColor: BORDER }}
                    >
                      {lineTotal.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Financial summary — right aligned like PDF */}
      <section className="p-3 sm:p-4" style={{ backgroundColor: CREAM }}>
        <div className="flex justify-end">
          <table className="w-full max-w-[340px] border-collapse text-[11px]">
            <tbody>
              <FinRow label="ITEM TOTAL" value={moneyRs(itemTotal)} />
              <FinRow label={pfLabel} value={moneyRs(pfAmount)} />
              <FinRow
                label={freightLabel}
                value={freightAmount > 0 ? moneyRs(freightAmount) : freightNote}
                valueMono={freightAmount > 0}
              />
              <FinRow label="SUB TOTAL" value={moneyRs(taxableSubtotal)} />
              {showIgst && <FinRow label="IGST" value={moneyRs(igstAmount)} />}
              {showCgst && <FinRow label="CGST (9 %)" value={moneyRs(cgstAmount)} />}
              {showSgst && <FinRow label="SGST (9 %)" value={moneyRs(sgstAmount)} />}
              <tr style={{ backgroundColor: GOLD_ACCENT }}>
                <td className="border px-2 py-2 font-bold" style={{ borderColor: BORDER }}>
                  GRAND TOTAL INR
                </td>
                <td className="border px-2 py-2 text-right font-mono font-bold" style={{ borderColor: BORDER }}>
                  {moneyRs(po.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <section className="border-t px-3 pb-4 pt-3 sm:px-4" style={{ borderColor: BORDER, backgroundColor: CREAM }}>
        <p className="text-[11px] text-gray-800">
          If you have any questions about this order, please contact {prepName}
          {phone ? `, ${phone}` : ''}
          {prepEmail ? `, ${prepEmail}` : ''}.
        </p>
        <p className="mt-3 text-center text-[13px] font-bold" style={{ color: GREEN }}>
          Thank You For Your Business !
        </p>
      </section>
    </div>
  )
}

function FinRow({
  label,
  value,
  valueMono = true,
}: {
  label: string
  value: string
  valueMono?: boolean
}) {
  return (
    <tr style={{ backgroundColor: CREAM }}>
      <td className="border px-2 py-1.5 font-bold" style={{ borderColor: BORDER, width: '62%' }}>
        {label}
      </td>
      <td
        className={cn('border px-2 py-1.5 text-right', valueMono && 'font-mono')}
        style={{ borderColor: BORDER }}
      >
        {value}
      </td>
    </tr>
  )
}
