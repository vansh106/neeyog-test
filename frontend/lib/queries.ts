import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  enquiriesApi,
  quotationsApi,
  mastersApi,
  systemApi,
  syncApi,
  configuratorApi,
  usersApi,
  mailboxesApi,
} from './api'
import { Permissions } from '@/lib/permissions'
import { useAuthStore } from '@/stores/authStore'
import type {
  EnquiryListItem, EnquiryDetail, EnquiryResponse,
  QuotationListItem, Quotation, Product,
  HealthResponse, ClientConfig, EmailSyncStatus,
  Accessories,
} from '@/types'

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => systemApi.health<HealthResponse>(),
    refetchInterval: 30000,
    staleTime: 10000,
  })
}

export function useEmailSyncStatus() {
  const canView = useAuthStore((s) => s.hasPermission(Permissions.EMAIL_SYNC_VIEW))
  return useQuery<EmailSyncStatus>({
    queryKey: ['emailSyncStatus'],
    queryFn: () => syncApi.getStatus<EmailSyncStatus>(),
    enabled: canView,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  })
}

export function useTriggerEmailSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => syncApi.triggerNow<{ message: string; summary: unknown }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      qc.invalidateQueries({ queryKey: ['emailSyncStatus'] })
    },
  })
}

export function useEnquiries(params?: {
  status?: string
  flow_type?: string
  company_id?: string
  limit?: number
  offset?: number
}) {
  return useQuery<EnquiryListItem[]>({
    queryKey: ['enquiries', params],
    queryFn: () => enquiriesApi.listEnquiries<EnquiryListItem[]>(params),
    staleTime: 15000,
    refetchInterval: 15000,
  })
}

export function useEnquiry(id: string) {
  return useQuery<EnquiryDetail>({
    queryKey: ['enquiry', id],
    queryFn: () => enquiriesApi.getEnquiry<EnquiryDetail>(id),
    enabled: !!id,
  })
}

export function useUploadEmail() {
  return useMutation<EnquiryResponse, Error, { emailText: string; inputType: string }>({
    mutationFn: ({ emailText, inputType }) =>
      enquiriesApi.uploadEmail<EnquiryResponse>(emailText, inputType),
  })
}

export function useQuotations(params?: { limit?: number; offset?: number }) {
  return useQuery<QuotationListItem[]>({
    queryKey: ['quotations', params],
    queryFn: () => quotationsApi.listQuotations<QuotationListItem[]>(params),
    staleTime: 30000,
  })
}

export function useQuotation(id: string) {
  return useQuery<Quotation>({
    queryKey: ['quotation', id],
    queryFn: () => quotationsApi.getQuotation<Quotation>(id),
    enabled: !!id,
  })
}

export function useProducts(params?: { category?: string }) {
  return useQuery<Product[]>({
    queryKey: ['products', params],
    queryFn: () => mastersApi.listProducts<Product[]>(params),
    staleTime: 60000,
  })
}

export function useSheetRows(sheet: string, params?: { skip?: number; limit?: number }) {
  return useQuery<{
    sheet: string
    columns: string[]
    total: number
    skip: number
    limit: number
    items: Record<string, unknown>[]
  }>({
    queryKey: ['sheetRows', sheet, params],
    queryFn: () => mastersApi.listSheetRows(sheet, params),
    enabled: !!sheet,
    staleTime: 60000,
  })
}

export function useClientConfig() {
  return useQuery<ClientConfig>({
    queryKey: ['clientConfig'],
    queryFn: () => mastersApi.getClientConfig<ClientConfig>(),
    staleTime: 300000,
  })
}

export function useConfiguratorAccessories() {
  return useQuery<Accessories>({
    queryKey: ['configurator', 'accessories'],
    queryFn: () => configuratorApi.getAccessories<Accessories>(),
    staleTime: Infinity,
  })
}

export function useConfiguratorValveTypes() {
  return useQuery<{ key: string; label: string }[]>({
    queryKey: ['configurator', 'valve-types'],
    queryFn: () => configuratorApi.getValveTypes<{ key: string; label: string }[]>(),
    staleTime: Infinity,
  })
}

export function useTeamUsers(includeInactive = false) {
  const can = useAuthStore((s) => s.hasPermission(Permissions.USERS_VIEW))
  return useQuery({
    queryKey: ['admin-users', includeInactive],
    queryFn: () => usersApi.list<Record<string, unknown>[]>(includeInactive),
    enabled: can,
    staleTime: 15000,
  })
}

export function usePermissionGroups() {
  const authed = useAuthStore((s) => Boolean(s.access_token))
  return useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => usersApi.permissionGroups<Record<string, string[]>>(),
    enabled: authed,
    staleTime: 300000,
  })
}

export function usePermissionPresets() {
  const authed = useAuthStore((s) => Boolean(s.access_token))
  return useQuery({
    queryKey: ['permission-presets'],
    queryFn: () => usersApi.permissionPresets<Record<string, string[]>>(),
    enabled: authed,
    staleTime: 300000,
  })
}

export function useMailboxes() {
  const authed = useAuthStore((s) => Boolean(s.access_token))
  return useQuery({
    queryKey: ['mailboxes'],
    queryFn: () => mailboxesApi.list<Record<string, unknown>[]>(),
    enabled: authed,
    staleTime: 60000,
  })
}
