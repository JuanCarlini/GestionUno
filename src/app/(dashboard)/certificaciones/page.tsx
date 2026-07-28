import { CertificacionesList } from "@/views/certificaciones-list"
import { CrearButton } from "@/components/crear-button"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function CertificacionesPage() {
  await requirePagePermission("certificaciones", "ver")
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Certificaciones</h1>
          <p className="text-muted-foreground">Gestiona las certificaciones de proyectos</p>
        </div>
        <CrearButton modulo="certificaciones" href="/certificaciones/nueva" label="Nueva Certificación" />
      </div>

      <CertificacionesList />
    </div>
  )
}
