import { OrdenCompraDetails } from "@/views/orden-compra-details"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { requirePagePermission } from "@/lib/auth/permissions-server"

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrdenCompraDetailPage({ params }: Props) {
  await requirePagePermission("ordenes_compra", "ver")
  const { id } = await params
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ordenes-compra">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <PageHeader title="Detalle de Orden de Compra" />
      </div>
      
      <OrdenCompraDetails ordenId={id} />
    </div>
  )
}
