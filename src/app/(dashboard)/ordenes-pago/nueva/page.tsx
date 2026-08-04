import { OrdenPagoForm } from "@/views/orden-pago-form"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaOrdenPagoPage() {
  await requirePagePermission("ordenes_pago", "crear", "/ordenes-pago")
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ordenes-pago">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <PageHeader title="Nueva Orden de Pago" description="Crear una nueva orden de pago a proveedor" />
      </div>
      <OrdenPagoForm />
    </div>
  )
}
