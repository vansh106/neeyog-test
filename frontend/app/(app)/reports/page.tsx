'use client'

import { useState } from 'react'

import PageShell from '@/components/layout/PageShell'
import ConversionPipelineReport from '@/components/reports/ConversionPipelineReport'
import AvgPoValueReport from '@/components/reports/AvgPoValueReport'
import DiscountPriceVarianceReport from '@/components/reports/DiscountPriceVarianceReport'
import CustomerReport from '@/components/reports/CustomerReport'
import PendingAgeingReport from '@/components/reports/PendingAgeingReport'
import LostBusinessReport from '@/components/reports/LostBusinessReport'
import QuotationRegisterReport from '@/components/reports/QuotationRegisterReport'
import ResponseSlaReport from '@/components/reports/ResponseSlaReport'
import SalesPerformanceByUserReport from '@/components/reports/SalesPerformanceByUserReport'
import SoHandoffReport from '@/components/reports/SoHandoffReport'
import SourceRoiReport from '@/components/reports/SourceRoiReport'
import WinLossAnalysisReport from '@/components/reports/WinLossAnalysisReport'
import { Input } from '@/components/ui/input'
import { ReportsBundleProvider, useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'
import { cn } from '@/lib/utils'

const REPORT_CATEGORIES = [
  {
    id: 'pipeline-sales',
    label: 'Pipeline & Sales',
    tabs: [
      { value: 'pipeline', label: 'Pipeline' },
      { value: 'quotation-register', label: 'Quotation Register' },
      { value: 'win-loss', label: 'Win/Loss' },
      { value: 'lost-business', label: 'Lost Business' },
    ],
  },
  {
    id: 'financials-roi',
    label: 'Financials & ROI',
    tabs: [
      { value: 'sales-performance', label: 'Sales Performance' },
      { value: 'source-roi', label: 'Source ROI' },
      { value: 'avg-po-value', label: 'Avg PO Value' },
      { value: 'discount-variance', label: 'Discount Variance' },
    ],
  },
  {
    id: 'operations-sla',
    label: 'Operations & SLA',
    tabs: [
      { value: 'so-handoff', label: 'SO / ERP Handoff' },
      { value: 'customers', label: 'Customers' },
      { value: 'response-sla', label: 'Response SLA' },
      { value: 'pending-ageing', label: 'Pending / Ageing' },
    ],
  },
] as const

const REPORT_PANELS = {
  pipeline: ConversionPipelineReport,
  'quotation-register': QuotationRegisterReport,
  'win-loss': WinLossAnalysisReport,
  'lost-business': LostBusinessReport,
  'sales-performance': SalesPerformanceByUserReport,
  'source-roi': SourceRoiReport,
  'avg-po-value': AvgPoValueReport,
  'discount-variance': DiscountPriceVarianceReport,
  'so-handoff': SoHandoffReport,
  customers: CustomerReport,
  'response-sla': ResponseSlaReport,
  'pending-ageing': PendingAgeingReport,
} as const

type ReportTabValue = keyof typeof REPORT_PANELS

const REPORT_TAB_TRIGGER_CLASS =
  'relative inline-flex items-center justify-center rounded-none border border-transparent px-2.5 pb-2 text-[12px] font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring sm:px-3 sm:text-[13px] after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity'

function ReportsDateToolbar() {
  const { dateFrom, dateTo, setDateFrom, setDateTo, bundle, isFetching, isPending } =
    useReportsBundleContext()

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#E2E6DC] bg-[#FAFAF8] px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-surface-muted">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[160px] bg-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-surface-muted">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[160px] bg-white"
          />
        </label>
      </div>
      <div className="text-[12px] text-surface-muted">
        {bundle ? (
          <>
            <span className="font-medium text-gray-700">Last updated: </span>
            {formatReportGeneratedAt(bundle.generated_at)}
            {bundle.scope_label && (
              <>
                <span className="mx-2 text-[#D0D4CC]">·</span>
                <span className="font-medium text-gray-700">Scope: </span>
                {bundle.scope_label}
              </>
            )}
            {isFetching && !isPending && (
              <span className="ml-1.5 text-emerald-700">(refreshing)</span>
            )}
          </>
        ) : isPending ? (
          'Loading reports…'
        ) : (
          'Select a date range'
        )}
      </div>
    </div>
  )
}

function ReportsTabs() {
  const [activeTab, setActiveTab] = useState<ReportTabValue>('pipeline')

  return (
    <>
      <nav
        aria-label="Report categories"
        className="mb-4 space-y-3 rounded-xl border border-[#E2E6DC] bg-white px-3 py-3 sm:px-4"
      >
        {REPORT_CATEGORIES.map((category, index) => (
          <div
            key={category.id}
            className={index < REPORT_CATEGORIES.length - 1 ? 'border-b border-[#ECEEE8] pb-3' : undefined}
          >
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A9488]">
              {category.label}
            </p>
            <div
              role="tablist"
              aria-label={category.label}
              className="flex min-h-9 w-full flex-wrap justify-start gap-x-1 gap-y-1"
            >
              {category.tabs.map((tab) => {
                const isActive = activeTab === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      REPORT_TAB_TRIGGER_CLASS,
                      isActive && 'text-foreground after:opacity-100',
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {(Object.entries(REPORT_PANELS) as [ReportTabValue, (typeof REPORT_PANELS)[ReportTabValue]][]).map(
        ([value, Panel]) => (
          <div
            key={value}
            role="tabpanel"
            hidden={activeTab !== value}
            className={cn('mt-0 outline-none', activeTab !== value && 'hidden')}
          >
            <Panel />
          </div>
        ),
      )}
    </>
  )
}

export default function ReportsPage() {
  return (
    <PageShell
      title="Reports"
      subtitle="Analytics and reporting across enquiries, quotations, and purchase orders."
    >
      <ReportsBundleProvider>
        <ReportsDateToolbar />
        <ReportsTabs />
      </ReportsBundleProvider>
    </PageShell>
  )
}
