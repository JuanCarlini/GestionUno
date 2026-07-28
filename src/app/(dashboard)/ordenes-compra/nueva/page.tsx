import { OrdenCompraForm } from "@/views/orden-compra-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaOrdenCompraPage() {
  await requirePagePermission("ordenes_compra", "crear", "/ordenes-compra")
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ordenes-compra">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nueva Orden de Compra</h1>
          <p className="text-muted-foreground">Crear una nueva orden de compra</p>
        </div>
      </div>
      <OrdenCompraForm />
    </div>
  )
}
