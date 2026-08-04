import { requirePagePermission } from "@/lib/auth/permissions-server"
import { PageHeader } from "@/components/page-header"
import { ReportesShell } from "@/views/reportes/reportes-shell"
import { ProveedorService } from "@/services/proveedor.service"
import { ProyectoService } from "@/services/proyecto.service"

// Guarda en el servidor: el redireccionamiento ocurre antes de enviar HTML, igual
// que en el resto de las paginas del dashboard.
export default async function ReportesPage() {
  await requirePagePermission("reportes", "ver")

  const [proveedores, proyectos] = await Promise.all([
    ProveedorService.getAll(),
    ProyectoService.getAll(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description="Indicadores del circuito de compras" />
      <ReportesShell
        proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
        proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </div>
  )
}
