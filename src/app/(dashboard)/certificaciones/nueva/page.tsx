import { CertificacionForm } from "@/views/certificacion-form"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaCertificacionPage() {
  await requirePagePermission("certificaciones", "crear", "/certificaciones")
  return (
    <div className="space-y-6">
      <PageHeader title="Nueva Certificación" description="Crea una nueva certificación de proyecto" />

      <CertificacionForm />
    </div>
  )
}
