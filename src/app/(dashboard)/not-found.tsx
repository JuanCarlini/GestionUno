import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

// not-found del dashboard: lo levanta cualquier notFound() de las pantallas de adentro,
// incluidas las de detalle cuando el documento no existe (o cuando el usuario no lo puede
// ver, que a propósito se ve igual: decir "existe pero no podés" ya filtra información).
//
// Uno solo para todo el dashboard y no uno por carpeta [id]: Next busca el not-found más
// cercano hacia arriba, el mensaje es el mismo, y cuatro copias se desincronizan.
export default function NotFound() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <CardTitle>No encontramos eso</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          El documento que buscás no existe, lo borraron, o no tenés permiso para verlo.
        </p>

        <Button asChild>
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
