'use client'

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAmountInWordsInr } from '@/lib/formatAmountInWords'
import { effectiveLinePdfDisplay } from '@/lib/quotationLineDisplay'
import {
  buildDefaultFooterContact,
  buildDefaultMetaEnquiryColumn,
  buildDefaultMetaOwnerColumn,
  buildDefaultMetaQuoteColumn,
  buildDefaultTerms,
  defaultFooterDisclaimer,
  defaultFooterThanks,
  defaultThankYouBanner,
  formatQuotationFreight,
  resolveBankDetails,
  resolveQuotationPreparer,
} from '@/lib/quotationPdfDefaults'
import { cn, formatCurrency, PRICE_TBD_LABEL } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { computeFinancialPreview, hydrateFinancialDraft } from '@/lib/quotationFinancialConfig'
import { quotationFinancialsFromStored } from '@/lib/quotationTotals'
import type { ClientConfig, EnquiryDetail, Quotation, QuotationLineItem, QuotationPdfDisplayOverrides } from '@/types'

const TEAL = '#0F6E56'
const BORDER = '#d7dbe0'

type EnquiryLite = EnquiryDetail | { created_at?: string | null } | null | undefined

type Props = {
  quotation: Quotation
  clientConfig: ClientConfig | undefined
  linkedEnquiry: EnquiryLite
  pdfOverrides: QuotationPdfDisplayOverrides | null | undefined
  notesPreviewText: string | null
  onOpenHistory: (line: QuotationLineItem) => void
}

function MetaColumn({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return <div className="min-h-[48px]" />
  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-between gap-2 text-[11px]">
          <span className="text-[#6b7280]">{row.label}</span>
          <span className="font-semibold text-right text-gray-900">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function QuotationFormatPreview({
  quotation,
  clientConfig,
  linkedEnquiry,
  pdfOverrides,
  notesPreviewText,
  onOpenHistory,
}: Props) {
  const companyName = clientConfig?.company_name || 'Parth Valves and Hoses LLP'
  const company = companyName.toUpperCase()
  const address = (clientConfig?.address || '').trim()
  const gst = (clientConfig?.gst_number || '').trim()
  const website = String(clientConfig?.website || '').trim()

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
  const sessionUser = useAuthStore((s) => s.user)
  const preparer = resolveQuotationPreparer(quotation, sessionUser)

  const metaQuote = buildDefaultMetaQuoteColumn(quotation)
  const metaEnquiry = buildDefaultMetaEnquiryColumn(quotation, linkedEnquiry as EnquiryDetail | null | undefined)
  const metaOwner = buildDefaultMetaOwnerColumn(clientConfig, preparer)

  const thankYouText = (ov?.thank_you_row || '').trim() || defaultThankYouBanner()
  const termsList =
    ov?.terms_items && ov.terms_items.length > 0 ? ov.terms_items : buildDefaultTerms(quotation, companyName)
  const footerContact =
    (ov?.footer_contact || '').trim() || buildDefaultFooterContact(clientConfig, preparer)
  const footerThanks = (ov?.footer_thanks || '').trim() || defaultFooterThanks()
  const footerDisclaimer = (ov?.footer_disclaimer || '').trim() || defaultFooterDisclaimer()
  const supplementRows = ov?.valuation_supplement_rows?.length ? ov.valuation_supplement_rows : []
  const paymentTerms = String(ov?.payment_terms || clientConfig?.payment_terms || '').trim()
  const deliveryPeriod = String(ov?.delivery_period || clientConfig?.delivery_period || '').trim()
  const bankDetails = resolveBankDetails(clientConfig)

  const gstRate = quotation.gst_rate
  const freightAmount = Number(quotation.freight_amount ?? 0)
  const finCfg = ov?.financial_config
  const financialDraft = finCfg ? hydrateFinancialDraft(quotation) : null
  const configuredPreview = financialDraft
    ? computeFinancialPreview(quotation.subtotal, financialDraft)
    : null
  const financials = configuredPreview ?? quotationFinancialsFromStored(
    quotation.subtotal,
    quotation.pf_amount,
    freightAmount,
    gstRate,
    quotation.gst_amount,
    quotation.total_amount,
  )
  const showCgst =
    configuredPreview != null
      ? financialDraft!.cgstApplicable && configuredPreview.cgstAmount > 0
      : Math.abs(gstRate - 18) < 0.01 && financials.gstAmount > 0
  const showSgst =
    configuredPreview != null
      ? financialDraft!.sgstApplicable && configuredPreview.sgstAmount > 0
      : Math.abs(gstRate - 18) < 0.01 && financials.gstAmount > 0
  const showIgst =
    configuredPreview != null &&
    financialDraft!.igstApplicable &&
    configuredPreview.igstAmount > 0
  const cgst =
    configuredPreview?.cgstAmount ??
    (showCgst && configuredPreview == null
      ? Math.round((financials.gstAmount / 2) * 100) / 100
      : 0)
  const sgst =
    configuredPreview?.sgstAmount ??
    (showSgst && configuredPreview == null
      ? Math.round((financials.gstAmount - cgst) * 100) / 100
      : 0)
  const igst = configuredPreview?.igstAmount ?? 0
  const showPf =
    configuredPreview == null || (financialDraft!.pfApplicable && configuredPreview.pfAmount > 0)
  const showFreight =
    configuredPreview == null ||
    (financialDraft!.freightApplicable && configuredPreview.freightAmount > 0)

  const notesBody =
    notesPreviewText !== null ? notesPreviewText : quotation.notes ? String(quotation.notes) : ''

  const bankFields: { label: string; value: string }[] = bankDetails
    ? [
        { label: 'Account Name', value: bankDetails.account_name || '' },
        { label: 'Bank', value: bankDetails.bank || '' },
        { label: 'Account No.', value: bankDetails.account_no || '' },
        { label: 'IFSC', value: bankDetails.ifsc || '' },
        { label: 'Branch', value: bankDetails.branch || '' },
        { label: 'A/C Type', value: bankDetails.account_type || '' },
        { label: 'SWIFT', value: bankDetails.swift || '' },
      ].filter((f) => f.value.trim())
    : []

  return (
    <>
      <section className="border-b p-3 sm:p-4" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between gap-3 border-b-2 pb-3" style={{ borderColor: TEAL }}>
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/branding/parth-valve-logo.jpeg"
              alt=""
              width={180}
              height={90}
              className="h-[52px] w-auto max-w-[72px] shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold leading-tight" style={{ color: TEAL }}>
                {company}
              </p>
              {address ? <p className="mt-1 text-[11px] leading-snug text-[#4b5563]">{address}</p> : null}
              {gst || website ? (
                <p className="mt-1 text-[10px] text-[#4b5563]">
                  {gst ? (
                    <>
                      <span className="text-[#6b7280]">GSTIN:</span> {gst}
                    </>
                  ) : null}
                  {gst && website ? ' · ' : null}
                  {website ? (
                    <>
                      <span className="text-[#6b7280]">Web:</span> {website}
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          <p className="shrink-0 text-[22px] font-extrabold tracking-wide text-[#1f2733] sm:text-[26px]">
            QUOTATION
          </p>
        </div>

        <div
          className="mt-3 grid grid-cols-1 divide-y rounded-md border bg-[#fcfdfc] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          style={{ borderColor: BORDER }}
        >
          <div className="p-3">
            <MetaColumn rows={metaQuote} />
          </div>
          <div className="p-3">
            <MetaColumn rows={metaEnquiry} />
          </div>
          <div className="p-3">
            <MetaColumn rows={metaOwner} />
          </div>
        </div>
      </section>

      <section className="border-b p-3 sm:p-4" style={{ borderColor: BORDER }}>
        <div className="overflow-hidden rounded-md border" style={{ borderColor: BORDER }}>
          <div className="px-3 py-1.5 text-[11px] font-extrabold tracking-wide" style={{ backgroundColor: '#f0f6f3', color: TEAL }}>
            QUOTATION FOR
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 text-[11px] sm:grid-cols-2">
            <div>
              <p className="text-[13px] font-extrabold text-[#1f2733]">{custCompany}</p>
              {(ov?.company_left_extra || []).map((row, i) => (
                <p key={`cex-${i}`} className="mt-1 whitespace-pre-line text-[#4b5563]">
                  <span className="text-[#6b7280]">{row.label}</span> {row.value}
                </p>
              ))}
            </div>
            <div className="space-y-1">
              {concernDisplay ? (
                <p>
                  <span className="text-[#6b7280]">Kind Attn.</span> {concernDisplay}
                </p>
              ) : null}
              {quotation.client_phone ? (
                <p>
                  <span className="text-[#6b7280]">Contact</span> {quotation.client_phone}
                </p>
              ) : null}
              {quotation.client_email ? (
                <p>
                  <span className="text-[#6b7280]">Email</span> {quotation.client_email}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] italic text-[#4b5563]">{thankYouText}</p>
      </section>

      <section className="border-b p-2 sm:p-3" style={{ borderColor: BORDER }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
            <thead>
              <tr style={{ backgroundColor: TEAL }} className="text-white">
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
                  <tr key={idx} className="border-b align-top" style={{ borderColor: BORDER }}>
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
                    <td className="px-2 py-2 text-right font-mono align-top">
                      {line.price_tbd || line.unit_price <= 0 ? PRICE_TBD_LABEL : line.unit_price.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono align-top">{disc ? String(disc) : '0'}</td>
                    <td className="px-2 py-2 text-right font-mono font-medium align-top">
                      {line.price_tbd || line.unit_price <= 0
                        ? PRICE_TBD_LABEL
                        : (line.line_total ?? line.total ?? 0).toLocaleString('en-IN', {
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
                  <tr key={`sup-${j}`} className="border-b align-top" style={{ borderColor: BORDER }}>
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

      <section className="border-b p-3 sm:p-4" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="mb-2 border-b pb-1 text-[11px] font-extrabold tracking-wide" style={{ color: TEAL, borderColor: BORDER }}>
              TERMS &amp; CONDITIONS
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-[#4b5563]">
              {termsList.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="mb-2 border-b pb-1 text-[11px] font-extrabold tracking-wide" style={{ color: TEAL, borderColor: BORDER }}>
              VALUATION SUMMARY
            </p>
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                <tr>
                  <td className="px-2 py-1 text-[#4b5563]">Sub Total</td>
                  <td className="px-2 py-1 text-right font-mono">
                    ₹{financials.itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {showPf ? (
                  <tr>
                    <td className="px-2 py-1 text-[#4b5563]">P &amp; F Charges ({quotation.pf_rate}%)</td>
                    <td className="px-2 py-1 text-right font-mono">
                      ₹{financials.pfAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className="px-2 py-1 text-[#4b5563]">Freight Charges</td>
                  <td className="px-2 py-1 text-right text-gray-800">
                    {showFreight
                      ? configuredPreview != null
                        ? formatCurrency(configuredPreview.freightAmount)
                        : quotation.freight_amount != null && quotation.freight_amount > 0
                          ? formatCurrency(quotation.freight_amount)
                          : formatQuotationFreight(quotation)
                      : quotation.freight_note || 'To-pay'}
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-1 text-[#4b5563]">Other Charges</td>
                  <td className="px-2 py-1 text-right font-mono">₹0.00</td>
                </tr>
                <tr className="bg-[#eef3f1] font-semibold">
                  <td className="px-2 py-1.5">Total before GST</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    ₹{financials.taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {showCgst ? (
                  <tr>
                    <td className="px-2 py-1">CGST @ 9%</td>
                    <td className="px-2 py-1 text-right font-mono">
                      ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null}
                {showSgst ? (
                  <tr>
                    <td className="px-2 py-1">SGST @ 9%</td>
                    <td className="px-2 py-1 text-right font-mono">
                      ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null}
                {showIgst ? (
                  <tr>
                    <td className="px-2 py-1">IGST @ 18%</td>
                    <td className="px-2 py-1 text-right font-mono">
                      ₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null}
                {!showCgst && !showSgst && !showIgst && financials.gstAmount > 0 ? (
                  <tr>
                    <td className="px-2 py-1">GST ({gstRate}%)</td>
                    <td className="px-2 py-1 text-right font-mono">
                      ₹{financials.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null}
                {(showCgst || showSgst) && !showIgst ? (
                  <tr>
                    <td className="px-2 py-1">IGST @ 0%</td>
                    <td className="px-2 py-1 text-right font-mono">₹0.00</td>
                  </tr>
                ) : null}
                <tr style={{ backgroundColor: TEAL }} className="font-extrabold text-white">
                  <td className="px-2 py-2">GRAND TOTAL (INR)</td>
                  <td className="px-2 py-2 text-right font-mono">
                    ₹{financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {paymentTerms || deliveryPeriod ? (
        <section className="border-b px-3 py-2 sm:px-4" style={{ borderColor: BORDER }}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {paymentTerms ? (
              <div className="rounded-md border px-3 py-2 text-[11px] text-[#4b5563]" style={{ backgroundColor: '#f0f6f3', borderColor: '#cfe3da' }}>
                <p className="font-extrabold tracking-wide" style={{ color: TEAL }}>
                  PAYMENT TERMS
                </p>
                <p className="mt-1">{paymentTerms}</p>
              </div>
            ) : null}
            {deliveryPeriod ? (
              <div className="rounded-md border px-3 py-2 text-[11px] text-[#4b5563]" style={{ backgroundColor: '#f0f6f3', borderColor: '#cfe3da' }}>
                <p className="font-extrabold tracking-wide" style={{ color: TEAL }}>
                  DELIVERY PERIOD
                </p>
                <p className="mt-1">{deliveryPeriod}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="border-b px-3 py-2 sm:px-4" style={{ borderColor: BORDER }}>
        <div className="rounded-r-md border-l-[3px] bg-[#fafbf9] px-3 py-2 text-[11px]" style={{ borderColor: TEAL }}>
          <span className="text-[10px] uppercase tracking-wide text-[#6b7280]">Amount in words: </span>
          <span className="font-bold text-[#1f2733]">{formatAmountInWordsInr(financials.grandTotal)}</span>
        </div>
      </section>

      {bankFields.length > 0 ? (
        <section className="border-b px-3 py-2 sm:px-4" style={{ borderColor: BORDER }}>
          <div className="rounded-md border p-3" style={{ borderColor: BORDER }}>
            <p className="mb-2 text-[11px] font-extrabold tracking-wide" style={{ color: TEAL }}>
              BANK DETAILS
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              {bankFields.map((field) => (
                <p key={field.label} className="text-[11px] leading-relaxed">
                  <span className="text-[#6b7280]">{field.label}</span>{' '}
                  <span className="font-bold text-[#1f2733]">{field.value}</span>
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {notesBody ? (
        <section className="border-b p-3 sm:p-4" style={{ borderColor: BORDER }}>
          <div className="rounded-sm border bg-[#F9FAF7] p-3" style={{ borderColor: BORDER }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold tracking-wide" style={{ color: TEAL }}>
                Notes
              </p>
              {notesPreviewText !== null ? (
                <span className="rounded-full bg-brand-gold-100 px-2 py-0.5 text-[10px] font-medium text-brand-gold-800">
                  PDF wording
                </span>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[12px] text-gray-800">{notesBody}</p>
          </div>
        </section>
      ) : null}

      <section className="p-3 sm:p-4">
        <p className="whitespace-pre-line text-[11px] text-gray-800">{footerContact}</p>
        <p className="mt-3 text-center text-[13px] font-extrabold tracking-wide" style={{ color: TEAL }}>
          {footerThanks}
        </p>
        <p className="mt-4 text-center text-[10px] italic text-[#6b7280]">{footerDisclaimer}</p>
      </section>
    </>
  )
}
