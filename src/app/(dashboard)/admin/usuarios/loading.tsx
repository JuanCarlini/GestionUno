import { PageHeaderSkeleton, UsuariosSkeleton } from "@/components/skeletons"

// UsuariosSkeleton y no ListSkeleton: esta pantalla no es un listado del circuito. Tiene
// dos tabs, el alta en su propia fila y una fila de usuario con cuatro columnas distintas
// (nombre con email, el rol, el select para cambiarlo y dos acciones).
//
// El encabezado se compone acá y no adentro del skeleton, como en todas las demás rutas:
// la regla dura de loading-shape.test.ts se lee del texto de este archivo, y escondiéndolo
// detrás de una indirección el test deja de poder verificarla.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton conAccion={false} />
      <UsuariosSkeleton />
    </div>
  )
}
