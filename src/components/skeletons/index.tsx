import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// Skeletons con la FORMA de cada pantalla, no rectángulos genéricos. El punto de un skeleton
// es que el layout no salte cuando llegan los datos: si el placeholder tiene otra altura o
// otra cantidad de filas que el contenido real, el salto es peor que un spinner.
//
// Todos llevan role="status" + aria-busy y un aria-label que dice qué está cargando, y
// respetan motion-reduce: la animación de pulso es decorativa y para alguien con sensibilidad
// al movimiento es ruido.

const PULSO = "motion-reduce:animate-none"

function Marco({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-busy="true" aria-label={etiqueta} className={PULSO}>
      {/* El texto para lectores de pantalla; lo visual son las barras. */}
      <span className="sr-only">{etiqueta}</span>
      {children}
    </div>
  )
}

/** Encabezado de página: título, descripción y el botón de acción a la derecha. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className={`h-7 w-56 ${PULSO}`} />
        <Skeleton className={`h-4 w-72 ${PULSO}`} />
      </div>
      <Skeleton className={`h-10 w-36 ${PULSO}`} />
    </div>
  )
}

/**
 * Listado: encabezado con título y buscador, control de orden, y filas con el ancho de las
 * columnas reales (número, proveedor, monto, estado, acciones).
 */
export function ListSkeleton({
  filas = 8,
  etiqueta = "Cargando el listado",
}: {
  filas?: number
  // Cada listado dice qué está cargando: "Cargando órdenes de compra" es mucho más útil que
  // "Cargando" cuando lo lee un lector de pantalla.
  etiqueta?: string
}) {
  return (
    <Marco etiqueta={etiqueta}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className={`h-6 w-48 ${PULSO}`} />
            <Skeleton className={`h-10 w-full sm:w-80 ${PULSO}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Skeleton className={`h-9 w-48 ${PULSO}`} />
          </div>

          <div className="space-y-4">
            {Array.from({ length: filas }).map((_, i) => (
              <div
                key={i}
                data-skeleton="fila"
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
              >
                <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Skeleton className={`h-4 w-24 ${PULSO}`} />
                    <Skeleton className={`h-3 w-20 ${PULSO}`} />
                  </div>
                  <Skeleton className={`h-4 w-32 ${PULSO}`} />
                  <Skeleton className={`h-4 w-24 ${PULSO}`} />
                  <Skeleton className={`h-6 w-24 rounded-full ${PULSO}`} />
                </div>
                <div className="flex gap-2">
                  <Skeleton className={`h-9 w-9 ${PULSO}`} />
                  <Skeleton className={`h-9 w-9 ${PULSO}`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Marco>
  )
}

/** Detalle de documento: número y chip de estado, grilla de datos en 2 columnas y las líneas. */
export function DetailSkeleton() {
  return (
    <Marco etiqueta="Cargando el documento">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className={`h-7 w-40 ${PULSO}`} />
              <Skeleton className={`h-6 w-28 rounded-full ${PULSO}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className={`h-3 w-28 ${PULSO}`} />
                  <Skeleton className={`h-5 w-44 ${PULSO}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className={`h-6 w-32 ${PULSO}`} />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className={`h-4 w-1/2 ${PULSO}`} />
                <Skeleton className={`h-4 w-20 ${PULSO}`} />
                <Skeleton className={`h-4 w-24 ${PULSO}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Marco>
  )
}

/** Formulario: campos en grilla y la tabla de líneas editable debajo. */
export function FormSkeleton({ campos = 6, conLineas = true }: { campos?: number; conLineas?: boolean }) {
  return (
    <Marco etiqueta="Cargando el formulario">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className={`h-6 w-44 ${PULSO}`} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {Array.from({ length: campos }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className={`h-4 w-28 ${PULSO}`} />
                  <Skeleton className={`h-10 w-full ${PULSO}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {conLineas && (
          <Card>
            <CardHeader>
              <Skeleton className={`h-6 w-36 ${PULSO}`} />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <Skeleton key={j} className={`h-10 w-full ${PULSO}`} />
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Skeleton className={`h-10 w-32 ${PULSO}`} />
          <Skeleton className={`h-10 w-28 ${PULSO}`} />
        </div>
      </div>
    </Marco>
  )
}

/** Dashboard: la fila de 4 KPIs y los 2 gráficos. */
export function DashboardSkeleton() {
  return (
    <Marco etiqueta="Cargando el dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} data-skeleton="kpi">
              <CardHeader className="pb-2">
                <Skeleton className={`h-4 w-28 ${PULSO}`} />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className={`h-8 w-32 ${PULSO}`} />
                <Skeleton className={`h-3 w-24 ${PULSO}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} data-skeleton="grafico">
              <CardHeader>
                <Skeleton className={`h-6 w-40 ${PULSO}`} />
              </CardHeader>
              <CardContent>
                <Skeleton className={`h-64 w-full ${PULSO}`} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Marco>
  )
}

/**
 * Contenido de una pestaña de reportes: indicadores, gráfico y tabla de detalle. Va dentro de
 * la página de reportes, que ya dibujó los filtros y las pestañas; por eso no los repite.
 */
export function TabReporteSkeleton({ tiles = 3 }: { tiles?: number }) {
  return (
    <Marco etiqueta="Cargando el reporte">
      <div className="space-y-6">
        {tiles > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: tiles }).map((_, i) => (
              <Card key={i} data-skeleton="tile">
                <CardHeader className="pb-2">
                  <Skeleton className={`h-4 w-32 ${PULSO}`} />
                </CardHeader>
                <CardContent>
                  <Skeleton className={`h-8 w-28 ${PULSO}`} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <Skeleton className={`h-6 w-72 ${PULSO}`} />
          </CardHeader>
          <CardContent>
            {/* La misma altura que el Contenedor de los gráficos: así no salta al llegar. */}
            <Skeleton className={`h-[420px] w-full ${PULSO}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className={`h-6 w-24 ${PULSO}`} />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={`h-8 w-full ${PULSO}`} />
            ))}
          </CardContent>
        </Card>
      </div>
    </Marco>
  )
}

/** Reportes: barra de filtros, pestañas, y el bloque de gráfico + tabla. */
export function ReportesSkeleton() {
  return (
    <Marco etiqueta="Cargando los reportes">
      <div className="space-y-6">
        <div className="grid grid-cols-2 items-end gap-4 rounded-lg border p-4 lg:flex lg:flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 lg:w-44">
              <Skeleton className={`h-3 w-20 ${PULSO}`} />
              <Skeleton className={`h-10 w-full ${PULSO}`} />
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`h-10 w-32 shrink-0 ${PULSO}`} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className={`h-6 w-56 ${PULSO}`} />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className={`h-72 w-full ${PULSO}`} />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className={`h-8 w-full ${PULSO}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Marco>
  )
}
