import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { BarChart2 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <PlaceholderPage
      icon={BarChart2}
      title="Reports"
      description="Analytics and reporting tools to track quotation performance, revenue trends, and team productivity."
      features={[
        'Exportable reports for ERP import',
        'Date range filters',
        'Revenue and conversion analytics',
        'Custom analytics section',
      ]}
    />
  )
}
