import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { Shield } from 'lucide-react'

export default function AdminPage() {
  return (
    <PlaceholderPage
      icon={Shield}
      title="Admin"
      description="System administration for user management, pricing updates, and configuration."
      features={[
        'User management (admin + marketing roles)',
        'Pricelist upload interface',
        'System configuration',
        'Audit log viewer',
      ]}
    />
  )
}
