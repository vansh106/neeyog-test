'use client'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportsBundleProvider, useReportsBundleContext } from '@/contexts/ReportsBundleContext'
import { formatReportGeneratedAt } from '@/lib/reportDateRange'

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
  return (
    <Tabs defaultValue="pipeline">
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
            <TabsList
              variant="line"
              className="h-auto min-h-9 w-full flex-wrap justify-start gap-x-1 gap-y-1 rounded-none bg-transparent p-0 pb-1"
            >
              {category.tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none px-2.5 pb-2 text-[12px] sm:px-3 sm:text-[13px] data-active:after:opacity-100"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        ))}
      </nav>

      <TabsContent value="pipeline" className="mt-0 outline-none" keepMounted>
        <ConversionPipelineReport />
      </TabsContent>
      <TabsContent value="quotation-register" className="mt-0 outline-none" keepMounted>
        <QuotationRegisterReport />
      </TabsContent>
      <TabsContent value="win-loss" className="mt-0 outline-none" keepMounted>
        <WinLossAnalysisReport />
      </TabsContent>
      <TabsContent value="sales-performance" className="mt-0 outline-none" keepMounted>
        <SalesPerformanceByUserReport />
      </TabsContent>
      <TabsContent value="source-roi" className="mt-0 outline-none" keepMounted>
        <SourceRoiReport />
      </TabsContent>
      <TabsContent value="so-handoff" className="mt-0 outline-none" keepMounted>
        <SoHandoffReport />
      </TabsContent>
      <TabsContent value="customers" className="mt-0 outline-none" keepMounted>
        <CustomerReport />
      </TabsContent>
      <TabsContent value="response-sla" className="mt-0 outline-none" keepMounted>
        <ResponseSlaReport />
      </TabsContent>
      <TabsContent value="pending-ageing" className="mt-0 outline-none" keepMounted>
        <PendingAgeingReport />
      </TabsContent>
      <TabsContent value="lost-business" className="mt-0 outline-none" keepMounted>
        <LostBusinessReport />
      </TabsContent>
      <TabsContent value="avg-po-value" className="mt-0 outline-none" keepMounted>
        <AvgPoValueReport />
      </TabsContent>
      <TabsContent value="discount-variance" className="mt-0 outline-none" keepMounted>
        <DiscountPriceVarianceReport />
      </TabsContent>
    </Tabs>
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
