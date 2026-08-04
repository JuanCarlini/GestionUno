"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useReporte } from "@/hooks/use-reporte"
import { BarraHorizontal, TortaComposicion } from "./graficos"
import { TablaReporte } from "./tabla-reporte"
import { porMoneda } from "./moneda"

interface FilaProveedor {
  proveedor: string
  moneda: string
  comprado: number
}

export function TabProveedores() {
  const { reporte, loading, error } = useReporte("proveedores")

  if (error && !reporte) {
    return <p role="alert" className="py-8 text-center text-destructive">Error: {error}</p>
  }
  if (!reporte) {
    return <p className="py-8 text-center text-muted-foreground">Cargando…</p>
  }

  const tabla = reporte.tablas[0]
  const filas = tabla.filas as unknown as FilaProveedor[]

  return (
    // Al refiltrar se conserva el render anterior atenuado: sin salto a esqueleto.
    <div aria-busy={loading} className={`space-y-6 ${loading ? "opacity-40 transition-opacity" : ""}`}>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {porMoneda(filas).map(([moneda, filasMoneda]) => {
        const ordenadas = [...filasMoneda].sort((a, b) => Number(b.comprado) - Number(a.comprado))

        const top10 = ordenadas.slice(0, 10).map((f) => ({
          etiqueta: f.proveedor,
          comprado: Number(f.comprado),
        }))

        // Top cinco más "Otros": seis segmentos como máximo, el límite legible de un vistazo.
        // Con cinco proveedores o menos no queda resto, y "Otros" en cero mentiría sobre los datos.
        const top5 = ordenadas.slice(0, 5).map((f) => ({ nombre: f.proveedor, monto: Number(f.comprado) }))
        const resto = ordenadas.slice(5).reduce((s, f) => s + Number(f.comprado), 0)
        const composicion = resto > 0 ? [...top5, { nombre: "Otros", monto: resto }] : top5

        return (
          <div key={moneda} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Diez mayores por monto comprado ({moneda})</CardTitle></CardHeader>
                <CardContent>
                  <BarraHorizontal datos={top10} clave="comprado" etiqueta="etiqueta" moneda={moneda} alto={380} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Composición del gasto ({moneda})</CardTitle></CardHeader>
                <CardContent><TortaComposicion datos={composicion} moneda={moneda} alto={380} /></CardContent>
              </Card>
            </div>
          </div>
        )
      })}

      {/* Los proveedores suspendidos siguen en esta tabla con su estado: la columna
          "estado" viene del servicio y es gasto ya ejecutado, no se oculta. */}
      <Card>
        <CardHeader><CardTitle>Detalle</CardTitle></CardHeader>
        <CardContent><TablaReporte tabla={tabla} /></CardContent>
      </Card>
    </div>
  )
}
