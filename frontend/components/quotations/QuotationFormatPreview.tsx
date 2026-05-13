'use client'

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { effectiveLinePdfDisplay, formatDateDdMmYyyy } from '@/lib/quotationLineDisplay'
import { cn, formatCurrency } from '@/lib/utils'
import type { ClientConfig, Quotation, QuotationLineItem, QuotationPdfDisplayOverrides } from '@/types'

const NAVY = '#1a2744'
const MAROON = '#7b1f2a'
const GREEN = '#1f4d2e'

type EnquiryLite = { created_at?: string | null } | null | undefined

type Props = {
  quotation: Quotation
  clientConfig: ClientConfig | undefined
  linkedEnquiry: EnquiryLite
  pdfOverrides: QuotationPdfDisplayOverrides | null | undefined
  notesPreviewText: string | null
  onOpenHistory: (line: QuotationLineItem) => void
}

function validUntilIso(createdAt: string | null, validityDays: number): string {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + Math.max(0, validityDays))
  return d.toISOString()
}

export default function QuotationFormatPreview({
  quotation,
  clientConfig,
  linkedEnquiry,
  pdfOverrides,
  notesPreviewText,
  onOpenHistory,
}: Props) {
  const company = (clientConfig?.company_name || 'PARTH VALVES AND HOSES LLP').toUpperCase()
  const address = clientConfig?.address || ''
  const website = (clientConfig?.website as string | undefined) || ''
  const salesEmail = (clientConfig?.sales_email as string | undefined) || clientConfig?.email || ''
  const letterEmail = salesEmail
  const gst = clientConfig?.gst_number || ''
  const phone = clientConfig?.phone || ''
  const preparedBy = (clientConfig?.prepared_by as string | undefined) || 'Sales Team'

  const lineItems = quotation.line_items ?? []
  const quoteDate = formatDateDdMmYyyy(quotation.created_at)
  const validUntil = formatDateDdMmYyyy(validUntilIso(quotation.created_at, quotation.validity_days))
  const enquiryDate = formatDateDdMmYyyy(linkedEnquiry?.created_at)

  const custCompany = (quotation.client_company || quotation.client_name || 'Customer').trim()

  let concernDisplay: string | null = null
  if (quotation.client_employee?.full_name?.trim()) {
    const n = quotation.client_employee.full_name.trim()
    const d = quotation.client_employee.designation?.trim()
    concernDisplay = d ? `${n} · ${d}` : n
  } else {
    const n = quotation.client_name?.trim() || ''
    if (n && n.toLowerCase() !== custCompany.toLowerCase()) concernDisplay = n
  }

  const gstRate = quotation.gst_rate
  const splitGst = Math.abs(gstRate - 18) < 0.01 && quotation.gst_amount > 0
  const cgst = splitGst ? Math.round((quotation.gst_amount / 2) * 100) / 100 : 0
  const sgst = splitGst ? Math.round((quotation.gst_amount - cgst) * 100) / 100 : 0

  const terms = [
    'Any modification to agreed specifications may attract additional commercial charges.',
    "Third party inspection, if required — extra at actual and in customer's scope.",
    `Freight — ${quotation.freight_note || 'Extra at actual'}.`,
    `GST @ ${gstRate}% — included in valuation total as shown below.`,
    `P & F @ ${quotation.pf_rate}% — included in valuation total as shown below.`,
    `Offer validity — ${quotation.validity_days} days from date of issue.`,
    'Subject to Pune jurisdiction only.',
  ]

  const notesBody =
    notesPreviewText !== null ? notesPreviewText : quotation.notes ? String(quotation.notes) : ''

  return (
    <div className="rounded-md border-2 border-[#333] bg-white text-[13px] leading-snug text-gray-900">
      <section className="border-b border-[#333] p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 border border-[#333] sm:grid-cols-[96px_1fr]">
          <div className="flex items-center justify-center border-b border-[#333] p-2 sm:border-b-0 sm:border-r">
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
              QUOTATION
            </p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-3 border border-[#333] p-2 text-[11px] sm:grid-cols-2 sm:p-3">
          <div className="space-y-0.5">
            {address && (
              <p>
                <span className="inline-block min-w-[68px] font-semibold">Address</span>: {address}
              </p>
            )}
            {website && (
              <p>
                <span className="inline-block min-w-[68px] font-semibold">Website</span>: {website}
              </p>
            )}
            {letterEmail && (
              <p>
                <span className="inline-block min-w-[68px] font-semibold">E-Mail</span>: {letterEmail}
              </p>
            )}
            <p>
              <span className="inline-block min-w-[68px] font-semibold">Prepared By</span>: {preparedBy}
            </p>
          </div>
          <div className="space-y-0.5">
            <p>
              <span className="inline-block min-w-[92px] font-semibold">Date</span>: {quoteDate}
            </p>
            <p>
              <span className="inline-block min-w-[92px] font-semibold">Quotation No</span>:{' '}
              <span className="font-mono">{quotation.quote_number}</span>
            </p>
            <p>
              <span className="inline-block min-w-[92px] font-semibold">Valid Until</span>: {validUntil}
            </p>
            <p className="break-all">
              <span className="inline-block min-w-[92px] font-semibold">Enquiry No / Date</span>:{' '}
              <span className="font-mono">
                {(quotation.enquiry_number || '').trim() || quotation.enquiry_id}
              </span>
              {enquiryDate !== '—' ? ` / ${enquiryDate}` : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#333]">
        <div className="grid grid-cols-1 gap-0 border-b border-[#333] text-[11px] sm:grid-cols-2">
          <div className="border-b border-[#333] p-2 sm:border-b-0 sm:border-r">
            <p className="font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              COMPANY
            </p>
            <p className="mt-1 text-[12px] font-bold text-gray-900">{custCompany}</p>
            {concernDisplay && (
              <p className="mt-1">
                <span className="font-semibold">Concern Person</span>: {concernDisplay}
              </p>
            )}
            {quotation.client_phone && (
              <p className="mt-1">
                <span className="font-semibold">Contact No.</span>: {quotation.client_phone}
              </p>
            )}
            {quotation.client_email && (
              <p className="mt-1">
                <span className="font-semibold">E-Mail</span>: {quotation.client_email}
              </p>
            )}
          </div>
          <div className="p-2">
            <p className="text-[11px] text-[#6b7280] sm:mt-5">
              Thank you for your enquiry and for considering us as a supplier.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#333] p-2">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
          VALUATION
        </p>
        <div className="overflow-x-auto border border-[#333]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
          <thead>
            <tr style={{ backgroundColor: NAVY }} className="text-white">
              <th className="px-2 py-2 font-bold">Sr.No</th>
              <th className="px-2 py-2 font-bold">Description</th>
              <th className="px-2 py-2 font-bold">Size</th>
              <th className="px-2 py-2 text-right font-bold">Qty</th>
              <th className="px-2 py-2 text-right font-bold">Rate</th>
              <th className="px-2 py-2 text-right font-bold">Disc.%</th>
              <th className="px-2 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((line: QuotationLineItem, idx: number) => {
              const pdfDisp = effectiveLinePdfDisplay(line, idx, pdfOverrides)
              const disc =
                typeof line.customer_discount_pct === 'number' && Number.isFinite(line.customer_discount_pct)
                  ? line.customer_discount_pct
                  : 0
              const qtyCell = `${line.quantity} ${line.unit || 'Nos'}`.trim()
              return (
                <tr
                  key={idx}
                  className={cn(
                    'border-b border-[#333] align-top',
                    idx % 2 === 1 ? 'bg-[#f0f2ee]' : 'bg-white',
                  )}
                >
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-start gap-1">
                      <span className="tabular-nums">{idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 p-0 text-[#6b7280] hover:text-gray-900"
                        onClick={() => onOpenHistory(line)}
                        title="View quote history"
                      >
                        <Info className="size-4" />
                        <span className="sr-only">View quote history</span>
                      </Button>
                    </div>
                  </td>
                  <td className="max-w-[280px] whitespace-pre-line px-2 py-2 align-top text-gray-900">
                    {pdfDisp.description}
                  </td>
                  <td className="whitespace-pre-line px-2 py-2 align-top text-gray-700">{pdfDisp.size}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{qtyCell}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{line.unit_price.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{disc ? String(disc) : '0'}</td>
                  <td className="px-2 py-2 text-right font-mono font-medium align-top">
                    {(line.line_total ?? line.total ?? 0).toLocaleString('en-IN', {
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

      <section className="border-b border-[#333]">
        <div className="grid grid-cols-1 sm:grid-cols-[1.45fr_1fr]">
          <div className="border-b border-[#333] p-2 sm:border-b-0 sm:border-r">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              TERMS AND CONDITIONS
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-gray-800">
              {terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
          <div className="p-2">
            <table className="w-full border-collapse text-[11px]">
          <tbody>
                <tr className="border border-[#333] bg-white">
              <td className="px-2 py-1.5 font-bold" style={{ width: '62%' }}>
                SUB TOTAL
              </td>
              <td className="px-2 py-1.5 text-right font-mono">
                ₹{quotation.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
                <tr className="border border-[#333] border-t-0 bg-white">
              <td className="px-2 py-1.5 font-bold">P &amp; F CHARGES ({quotation.pf_rate} %)</td>
              <td className="px-2 py-1.5 text-right font-mono">
                ₹{quotation.pf_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
            {splitGst ? (
              <>
                    <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">CGST (9 %)</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                    <tr className="border border-[#333] border-t-0 bg-white">
                  <td className="px-2 py-1.5 font-bold">SGST (9 %)</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </>
            ) : (
                  <tr className="border border-[#333] border-t-0 bg-white">
                <td className="px-2 py-1.5 font-bold">GST ({gstRate} %)</td>
                <td className="px-2 py-1.5 text-right font-mono">
                  ₹{quotation.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            )}
                <tr className="border border-[#333] border-t-0 bg-white">
              <td className="px-2 py-1.5 font-bold">FREIGHT</td>
              <td className="px-2 py-1.5 text-right text-gray-800">{quotation.freight_note || 'Extra at actual'}</td>
            </tr>
                <tr className="border border-[#333] border-t-0 bg-[#f9faf7]">
              <td className="px-2 py-2 font-bold">GRAND TOTAL INR</td>
              <td className="px-2 py-2 text-right text-base font-bold font-mono" style={{ color: GREEN }}>
                ₹{quotation.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
          </div>
      </div>
      </section>

      {notesBody ? (
        <section className="border-b border-[#333] p-2">
          <div className="rounded-sm border border-[#333] bg-[#F9FAF7] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Notes
            </p>
            {notesPreviewText !== null && (
              <span className="rounded-full bg-brand-gold-100 px-2 py-0.5 text-[10px] font-medium text-brand-gold-800">
                PDF wording
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[12px] text-gray-800">{notesBody}</p>
          </div>
        </section>
      ) : null}

      <section className="p-3">
        <p className="text-[11px] text-gray-800">
          If you have any questions about this quote, please contact {preparedBy}
          {phone ? `, ${phone}` : ''}
          {letterEmail ? `, ${letterEmail}` : ''}.
        </p>
        <p className="mt-3 text-center text-[13px] font-bold" style={{ color: GREEN }}>
          Thank You For Your Business !
        </p>
        <p className="mt-4 text-center text-[10px] italic text-[#6b7280]">
          This quotation was prepared with AI assistance and reviewed by our team.
        </p>
      </section>
    </div>
  )
}
