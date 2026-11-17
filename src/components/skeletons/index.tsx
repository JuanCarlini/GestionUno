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

/**
 * La barra de "Volver" de las pantallas de detalle. Es a propósito mucho más chica que
 * PageHeaderSkeleton: medido contra la app, ahí arriba no hay título ni descripción, solo un
 * enlace para volver y —según el estado del documento— botones de acción en la misma fila.
 */
export function VolverSkeleton() {
  return (
    <div data-skeleton="volver" className="flex items-center justify-between gap-3">
      <Skeleton className={`h-9 w-24 ${PULSO}`} />
      <Skeleton className={`h-9 w-40 ${PULSO}`} />
    </div>
  )
}

/**
 * Encabezado de página: título, descripción y —solo donde la hay— la acción a la derecha.
 *
 * conAccion no es un adorno: de las 18 pantallas que dibujan este skeleton, 12 tienen un
 * PageHeader sin botón, así que les aparecía un rectángulo de 144px a la derecha que al
 * llegar los datos se desvanecía. Los listados del circuito sí lo tienen (el "Nueva
 * orden", "Nueva factura") y por eso el default queda en true.
 */
export function PageHeaderSkeleton({ conAccion = true }: { conAccion?: boolean } = {}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className={`h-7 w-56 ${PULSO}`} />
        <Skeleton className={`h-4 w-72 ${PULSO}`} />
      </div>
      {conAccion && <Skeleton className={`h-10 w-36 ${PULSO}`} />}
    </div>
  )
}

/** La barra de tabs: alto y fondo de TabsList, con un bloque por pestaña. */
function TabsSkeleton({ anchos }: { anchos: string[] }) {
  return (
    <div className="inline-flex h-10 w-fit items-center gap-1 rounded-md bg-muted p-1">
      {anchos.map((w, i) => (
        <Skeleton key={i} className={`h-8 ${w} ${PULSO}`} />
      ))}
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
              // La misma caja que la fila de verdad: el grid de 4 columnas con las acciones
              // DENTRO como cuarta columna, no colgadas afuera. Antes las dos columnas del
              // medio eran una barra sola cada una, el chip de estado ocupaba la cuarta
              // columna y los botones iban por fuera del grid: cinco bloques contra cuatro,
              // alineados contra el borde derecho en vez de donde caen en la lista. Medido,
              // la fila quedaba en 68px contra los 82px de la real, así que al llegar los
              // datos todo lo de abajo bajaba 14px por fila.
              <div
                key={i}
                data-skeleton="fila"
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4">
                  {/* número y fecha */}
                  <div className="space-y-2">
                    <Skeleton className={`h-5 w-28 ${PULSO}`} />
                    <Skeleton className={`h-4 w-20 ${PULSO}`} />
                  </div>
                  {/* proveedor y observaciones */}
                  <div className="space-y-2">
                    <Skeleton className={`h-4 w-32 ${PULSO}`} />
                    <Skeleton className={`h-4 w-40 ${PULSO}`} />
                  </div>
                  {/* monto y chip de estado */}
                  <div className="space-y-2">
                    <Skeleton className={`h-5 w-28 ${PULSO}`} />
                    <Skeleton className={`h-6 w-24 rounded-full ${PULSO}`} />
                  </div>
                  {/* la acción: una sola, como en una fila ya aprobada, que es el caso
                      normal. Las de aprobar y anular solo aparecen en borrador y en
                      aprobación, y dibujar tres botones acá haría encoger la fila al
                      llegar los datos. */}
                  <div className="flex items-center">
                    <Skeleton className={`h-9 w-9 ${PULSO}`} />
                  </div>
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
export function DetailSkeleton({
  campos = 4,
  // Quien dibuja la barra de "Volver" cambia por pantalla: en órdenes de compra la pone la
  // page (y queda montada mientras el cliente busca, así que acá sobraría); en el resto la
  // pone la vista, y entonces el skeleton tiene que reservarle el lugar.
  conVolver = false,
}: { campos?: number; conVolver?: boolean } = {}) {
  return (
    <Marco etiqueta="Cargando el documento">
      <div className="space-y-6">
        {conVolver && <VolverSkeleton />}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className={`h-7 w-40 ${PULSO}`} />
              <Skeleton className={`h-6 w-28 rounded-full ${PULSO}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {Array.from({ length: campos }).map((_, i) => (
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
export function FormSkeleton({
  campos = 6,
  conLineas = true,
  conVolver = false,
}: { campos?: number; conLineas?: boolean; conVolver?: boolean }) {
  return (
    <Marco etiqueta="Cargando el formulario">
      <div className="space-y-6">
        {conVolver && <VolverSkeleton />}
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

        {/* Actividad Reciente y Requieren Atención: cinco filas de ícono + dos renglones
            cada una. Un bloque macizo acá tenía la altura bien pero no la forma. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} data-skeleton="panel">
              <CardHeader>
                <Skeleton className={`h-6 w-40 ${PULSO}`} />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 5 }).map((__, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className={`h-4 w-4 shrink-0 rounded-full ${PULSO}`} />
                    <div className="flex-1 space-y-2">
                      <Skeleton className={`h-4 w-3/4 ${PULSO}`} />
                      <Skeleton className={`h-3 w-32 ${PULSO}`} />
                    </div>
                  </div>
                ))}
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
          // Las clases van enteras en el ternario: Tailwind escanea el fuente y una clase
          // armada por interpolación (`md:grid-cols-${n}`) no la genera nunca.
          <div
            className={`grid grid-cols-1 gap-4 ${tiles === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}
          >
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

/**
 * Administración de usuarios. No usa ListSkeleton: esa dibuja la fila del circuito
 * —número, proveedor, monto, estado y un botón— y acá la fila es otra cosa. La de verdad
 * tiene cuatro columnas: nombre con email y chips debajo, el rol con su ícono, un select
 * para cambiarlo y dos botones de acción. Además la pantalla arranca con dos tabs y el
 * alta va en su propia fila, no en el encabezado.
 */
export function UsuariosSkeleton({ filas = 6 }: { filas?: number } = {}) {
  return (
    <Marco etiqueta="Cargando la administración de usuarios">
      <div className="space-y-6">
        <TabsSkeleton anchos={["w-28", "w-20"]} />

        <div className="flex justify-end">
          <Skeleton className={`h-10 w-36 ${PULSO}`} />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: filas }).map((_, i) => (
                <div
                  key={i}
                  data-skeleton="fila-usuario"
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="grid flex-1 grid-cols-1 items-center gap-4 md:grid-cols-4">
                    {/* nombre, email y los chips de estado */}
                    <div className="space-y-2">
                      <Skeleton className={`h-5 w-32 ${PULSO}`} />
                      <Skeleton className={`h-4 w-44 ${PULSO}`} />
                      <Skeleton className={`h-5 w-16 rounded-full ${PULSO}`} />
                    </div>
                    {/* el ícono del rol y su etiqueta */}
                    <div className="flex items-center gap-2">
                      <Skeleton className={`h-5 w-5 rounded-full ${PULSO}`} />
                      <Skeleton className={`h-4 w-24 ${PULSO}`} />
                    </div>
                    {/* el select para cambiar el rol */}
                    <Skeleton className={`h-10 w-full ${PULSO}`} />
                    {/* resetear clave y dar de baja */}
                    <div className="flex items-center justify-end gap-2">
                      <Skeleton className={`h-9 w-9 ${PULSO}`} />
                      <Skeleton className={`h-9 w-9 ${PULSO}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Marco>
  )
}

/**
 * Auditoría. Tampoco es un listado de filas: arriba hay una tarjeta de búsqueda con cinco
 * filtros y un botón, después dos tabs, y recién ahí una tabla de seis columnas. Los altos
 * siguen a los de Table: el encabezado mide h-12 y cada celda lleva p-4.
 */
export function AuditoriaSkeleton({ filas = 8 }: { filas?: number } = {}) {
  const columnas = ["w-24", "w-20", "w-16", "w-20", "w-12", "w-32"]
  return (
    <Marco etiqueta="Cargando la auditoría">
      <div className="space-y-6">

        {/* la tarjeta de búsqueda combinada */}
        <Card>
          <CardHeader>
            <Skeleton className={`h-5 w-44 ${PULSO}`} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} data-skeleton="filtro" className="space-y-2">
                  <Skeleton className={`h-4 w-20 ${PULSO}`} />
                  <Skeleton className={`h-10 w-full ${PULSO}`} />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Skeleton className={`h-10 w-28 ${PULSO}`} />
            </div>
          </CardContent>
        </Card>

        <TabsSkeleton anchos={["w-52", "w-44"]} />

        {/* la tabla */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-12 items-center gap-4 border-b">
              {columnas.map((w, i) => (
                <Skeleton key={i} className={`h-4 ${w} ${PULSO}`} />
              ))}
            </div>
            {Array.from({ length: filas }).map((_, i) => (
              <div
                key={i}
                data-skeleton="fila-auditoria"
                className="flex items-center gap-4 border-b py-4 last:border-0"
              >
                {columnas.map((w, j) => (
                  <Skeleton key={j} className={`h-4 ${w} ${PULSO}`} />
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Marco>
  )
}
