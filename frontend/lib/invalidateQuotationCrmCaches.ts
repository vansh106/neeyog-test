import type { QueryClient } from '@tanstack/react-query'

/** Refresh listings and dashboard analytics after quotation CRM status changes. */
export async function invalidateQuotationCrmCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['quotations'] }),
    queryClient.invalidateQueries({ queryKey: ['enquiries'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  ])
}
