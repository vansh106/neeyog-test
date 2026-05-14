'use client'

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { effectiveLinePdfDisplay } from '@/lib/quotationLineDisplay'
import {
  buildDefaultFooterContact,
  buildDefaultHeaderLeft,
  buildDefaultHeaderRight,
  buildDefaultTerms,
  defaultCompanyRightBlurb,
  defaultFooterDisclaimer,
  defaultFooterThanks,
  defaultThankYouBanner,
} from '@/lib/quotationPdfDefaults'
import { cn, formatCurrency } from '@/lib/utils'
import type { ClientConfig, EnquiryDetail, Quotation, QuotationLineItem, QuotationPdfDisplayOverrides } from '@/types'

const NAVY = '#1a2744'
const MAROON = '#7b1f2a'
const GREEN = '#1f4d2e'

type EnquiryLite = EnquiryDetail | { created_at?: string | null } | null | undefined

type Props = {
  quotation: Quotation
  clientConfig: ClientConfig | undefined
  linkedEnquiry: EnquiryLite
  pdfOverrides: QuotationPdfDisplayOverrides | null | undefined
  notesPreviewText: string | null
  onOpenHistory: (line: QuotationLineItem) => void
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

  const lineItems = quotation.line_items ?? []
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

  const ov = pdfOverrides
  const headerLeft =
    ov?.header_left && ov.header_left.length > 0 ? ov.header_left : buildDefaultHeaderLeft(clientConfig)
  const headerRight =
    ov?.header_right && ov.header_right.length > 0
      ? ov.header_right
      : buildDefaultHeaderRight(quotation, linkedEnquiry as EnquiryDetail | null | undefined)

  const thankYouText = (ov?.thank_you_row || '').trim() || defaultThankYouBanner()
  const companyRightBlurb = (ov?.company_right_text || '').trim() || defaultCompanyRightBlurb()
  const termsList =
    ov?.terms_items && ov.terms_items.length > 0 ? ov.terms_items : buildDefaultTerms(quotation)
  const footerContact = (ov?.footer_contact || '').trim() || buildDefaultFooterContact(clientConfig)
  const footerThanks = (ov?.footer_thanks || '').trim() || defaultFooterThanks()
  const footerDisclaimer = (ov?.footer_disclaimer || '').trim() || defaultFooterDisclaimer()
  const supplementRows = ov?.valuation_supplement_rows?.length ? ov.valuation_supplement_rows : []

  const gstRate = quotation.gst_rate
  const splitGst = Math.abs(gstRate - 18) < 0.01 && quotation.gst_amount > 0
  const cgst = splitGst ? Math.round((quotation.gst_amount / 2) * 100) / 100 : 0
  const sgst = splitGst ? Math.round((quotation.gst_amount - cgst) * 100) / 100 : 0

  const notesBody =
    notesPreviewText !== null ? notesPreviewText : quotation.notes ? String(quotation.notes) : ''

  return (
    <>
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
            {headerLeft.map((row, i) => (
              <p key={`hl-${i}`}>
                <span className="inline-block min-w-[68px] font-semibold">{row.label}</span>: {row.value}
              </p>
            ))}
          </div>
          <div className="space-y-0.5">
            {headerRight.map((row, i) => (
              <p key={`hr-${i}`} className={row.label.includes('Enquiry') ? 'break-all' : ''}>
                <span className="inline-block min-w-[92px] font-semibold">{row.label}</span>
                {row.label === 'Quotation No' ? (
                  <>
                    : <span className="font-mono">{row.value}</span>
                  </>
                ) : (
                  <> : {row.value}</>
                )}
              </p>
            ))}
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
            {(ov?.company_left_extra || []).map((row, i) => (
              <p key={`cex-${i}`} className="mt-1 whitespace-pre-line">
                <span className="font-semibold">{row.label}</span>: {row.value}
              </p>
            ))}
          </div>
          <div className="p-2">
            <p className="whitespace-pre-line text-[11px] text-[#6b7280] sm:mt-5">{companyRightBlurb}</p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#333] px-2 py-2 text-center text-[11px] text-gray-800">
        <p className="border border-[#333] bg-white px-2 py-2">{thankYouText}</p>
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
            {supplementRows.map((srow, j) => {
              const idx = lineItems.length + j
              const sr = (srow.sr || '').trim() || '—'
              const c = (v: string | undefined) => (v && v.trim() ? v.trim() : '—')
              return (
                <tr
                  key={`sup-${j}`}
                  className={cn(
                    'border-b border-[#333] align-top',
                    idx % 2 === 1 ? 'bg-[#f0f2ee]' : 'bg-white',
                  )}
                >
                  <td className="px-2 py-2 align-top font-mono tabular-nums">{sr}</td>
                  <td className="max-w-[280px] whitespace-pre-line px-2 py-2 align-top text-gray-900">
                    {c(srow.description)}
                  </td>
                  <td className="whitespace-pre-line px-2 py-2 align-top text-gray-700">{c(srow.size)}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{c(srow.qty)}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{c(srow.rate)}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{c(srow.disc)}</td>
                  <td className="px-2 py-2 text-right font-mono align-top">{c(srow.total)}</td>
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
              {termsList.map((t, i) => (
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
        <p className="whitespace-pre-line text-[11px] text-gray-800">{footerContact}</p>
        <p className="mt-3 text-center text-[13px] font-bold" style={{ color: GREEN }}>
          {footerThanks}
        </p>
        <p className="mt-4 text-center text-[10px] italic text-[#6b7280]">{footerDisclaimer}</p>
      </section>
    </>
  )
}
