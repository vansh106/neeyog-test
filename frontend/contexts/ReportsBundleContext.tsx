'use client'

import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { analyticsApi, type ReportsBundleResponse } from '@/lib/api'
import { defaultFyStartIsoDate, todayIsoDate } from '@/lib/reportDateRange'
import { useAuthStore } from '@/stores/authStore'

type ReportsBundleContextValue = {
  dateFrom: string
  dateTo: string
  setDateFrom: (value: string) => void
  setDateTo: (value: string) => void
  bundle: ReportsBundleResponse | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
}

const ReportsBundleContext = createContext<ReportsBundleContextValue | null>(null)

export function ReportsBundleProvider({
  children,
  userId,
}: {
  children: ReactNode
  userId?: string
}) {
  const [dateFrom, setDateFrom] = useState(defaultFyStartIsoDate)
  const [dateTo, setDateTo] = useState(todayIsoDate)
  const authed = useAuthStore((s) => Boolean(s.access_token))
  const enabled = authed && Boolean(dateFrom && dateTo)

  const { data: bundle, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['analytics', 'reports-bundle', userId ?? 'self', dateFrom, dateTo],
    queryFn: () =>
      analyticsApi.reportsBundle({
        date_from: dateFrom,
        date_to: dateTo,
        ...(userId ? { user_id: userId } : {}),
      }),
    enabled,
    staleTime: 60_000,
    refetchInterval: 30_000,
  })

  const value = useMemo(
    () => ({
      dateFrom,
      dateTo,
      setDateFrom,
      setDateTo,
      bundle,
      isPending,
      isError,
      error: (error as Error | null) ?? null,
      isFetching,
    }),
    [dateFrom, dateTo, bundle, isPending, isError, error, isFetching],
  )

  return <ReportsBundleContext.Provider value={value}>{children}</ReportsBundleContext.Provider>
}

export function useReportsBundleContext(): ReportsBundleContextValue {
  const ctx = useContext(ReportsBundleContext)
  if (!ctx) {
    throw new Error('useReportsBundleContext must be used within ReportsBundleProvider')
  }
  return ctx
}
