import { DashboardOverview } from "@/views/dashboard-overview"
import { PageHeader } from "@/components/page-header"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description="Resumen general del sistema" />
      <DashboardOverview />
    </div>
  )
}
