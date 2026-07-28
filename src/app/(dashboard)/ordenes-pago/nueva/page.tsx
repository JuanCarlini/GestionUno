import { OrdenPagoForm } from "@/views/orden-pago-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaOrdenPagoPage() {
  await requirePagePermission("ordenes_pago", "crear", "/ordenes-pago")
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ordenes-pago">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nueva Orden de Pago</h1>
          <p className="text-muted-foreground">Crear una nueva orden de pago a proveedor</p>
        </div>
      </div>
      <OrdenPagoForm />
    </div>
  )
}
