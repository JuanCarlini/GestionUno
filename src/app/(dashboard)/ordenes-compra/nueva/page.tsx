import { OrdenCompraForm } from "@/views/orden-compra-form"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaOrdenCompraPage() {
  await requirePagePermission("ordenes_compra", "crear", "/ordenes-compra")
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ordenes-compra">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <PageHeader title="Nueva Orden de Compra" description="Crear una nueva orden de compra" />
      </div>
      <OrdenCompraForm />
    </div>
  )
}
