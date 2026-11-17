import { PageHeaderSkeleton, AuditoriaSkeleton } from "@/components/skeletons"

// AuditoriaSkeleton y no ListSkeleton: acá arriba hay una tarjeta de búsqueda con cinco
// filtros, después dos tabs y recién entonces una tabla de seis columnas. Nada de eso se
// parece a la fila de un listado del circuito.
//
// El encabezado va acá por lo mismo que en usuarios: lo verifica loading-shape.test.ts
// leyendo el texto de este archivo.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton conAccion={false} />
      <AuditoriaSkeleton />
    </div>
  )
}
