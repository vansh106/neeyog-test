'use client'

import { Inbox, FileCheck, Clock, CheckCircle2 } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import StatCard from '@/components/dashboard/StatCard'
import RecentEnquiries from '@/components/dashboard/RecentEnquiries'
import FlowChart from '@/components/dashboard/FlowChart'
import { Skeleton } from '@/components/ui/skeleton'
import { useEnquiries, useQuotations } from '@/lib/queries'

function isTodayLocal(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export default function DashboardPage() {
  const { data: enquiries, isPending: enquiriesPending } = useEnquiries()
  const { data: quotations, isPending: quotationsPending } = useQuotations()

  const loading = enquiriesPending || quotationsPending

  const enquiryList = enquiries ?? []
  const quotationList = quotations ?? []

  const pendingReviewCount = enquiryList.filter((e) =>
    e.status.toLowerCase().includes('pending'),
  ).length

  const completedTodayCount = enquiryList.filter(
    (e) => e.status === 'approved' && isTodayLocal(e.created_at),
  ).length

  if (loading) {
    return (
      <PageShell title="Dashboard">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl border border-[#E2E6DC] bg-white/80" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="lg:col-span-3 h-[320px] rounded-xl border border-[#E2E6DC] bg-white/80" />
          <Skeleton className="lg:col-span-2 h-[320px] rounded-xl border border-[#E2E6DC] bg-white/80" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Inbox} label="Total Enquiries" value={enquiryList.length} color="#2A6B3C" />
        <StatCard
          icon={FileCheck}
          label="Quotations Generated"
          value={quotationList.length}
          color="#C8B400"
        />
        <StatCard icon={Clock} label="Pending Review" value={pendingReviewCount} color="#d97706" />
        <StatCard
          icon={CheckCircle2}
          label="Completed Today"
          value={completedTodayCount}
          color="#2A6B3C"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 min-w-0">
          <RecentEnquiries enquiries={enquiryList} />
        </div>
        <div className="lg:col-span-2 min-w-0">
          <FlowChart enquiries={enquiryList} />
        </div>
      </div>
    </PageShell>
  )
}
