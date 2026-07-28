import { requirePageAdmin } from "@/lib/auth/permissions-server"

// Guarda server-side de toda la sección /admin/*: el redirect ocurre en el servidor, antes de
// mandar la página. Los datos ya los protege requireAdmin en /api/admin/*: defensa en profundidad.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePageAdmin()

  return <>{children}</>
}
