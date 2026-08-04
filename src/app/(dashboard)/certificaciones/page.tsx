import { CertificacionesList } from "@/views/certificaciones-list"
import { CrearButton } from "@/components/crear-button"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function CertificacionesPage() {
  await requirePagePermission("certificaciones", "ver")
  return (
    <div className="space-y-6">
      <PageHeader title="Certificaciones" description="Gestiona las certificaciones de proyectos">
        <CrearButton modulo="certificaciones" href="/certificaciones/nueva" label="Nueva Certificación" />
      </PageHeader>

      <CertificacionesList />
    </div>
  )
}
