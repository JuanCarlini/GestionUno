"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useReporte } from "@/hooks/use-reporte"
import { Embudo, LineaTemporal, StatTile } from "./graficos"
import { TablaReporte } from "./tabla-reporte"
import { formatearValor } from "./formato"

interface FilaCircuito {
  moneda: string
  comprado: number
  certificado: number
  facturado: number
  pagado: number
}

// Extiende Record<string, unknown>: LineaTemporal recibe filas genéricas de cualquier
// reporte y una interfaz cerrada no calzaría con esa firma.
interface FilaMensual extends Record<string, unknown> {
  moneda: string
  mes: string
  comprado: number
  pagado: number
}

export function TabCircuito() {
  // Dos tablas en una sola respuesta: resumen por moneda y evolución mensual. Antes
  // eran dos peticiones y la mensual no entraba en ningún export.
  const { reporte, loading, error } = useReporte("circuito")

  if (error && !reporte) {
    return <p role="alert" className="py-8 text-center text-destructive">Error: {error}</p>
  }
  if (!reporte) {
    return <p className="py-8 text-center text-muted-foreground">Cargando…</p>
  }

  const tabla = reporte.tablas[0]
  const filas = tabla.filas as unknown as FilaCircuito[]
  const filasMensuales = (reporte.tablas[1]?.filas ?? []) as unknown as FilaMensual[]

  return (
    // Al refiltrar se conserva el render anterior atenuado: sin salto a esqueleto.
    <div aria-busy={loading} className={`space-y-6 ${loading ? "opacity-40 transition-opacity" : ""}`}>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {filas.map((fila) => {
        const etapas = [
          { etapa: "Comprado", monto: fila.comprado, porcentaje: 100 },
          { etapa: "Certificado", monto: fila.certificado, porcentaje: pct(fila.certificado, fila.comprado) },
          { etapa: "Facturado", monto: fila.facturado, porcentaje: pct(fila.facturado, fila.comprado) },
          { etapa: "Pagado", monto: fila.pagado, porcentaje: pct(fila.pagado, fila.comprado) },
        ]
        // Mismo filtro de fechas, pregunta distinta: esta serie es por moneda igual que
        // el embudo, para no mezclar montos de monedas distintas en un solo eje.
        const mesesDeLaMoneda = filasMensuales.filter((m) => m.moneda === fila.moneda)

        return (
          <div key={fila.moneda} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {etapas.map((e) => (
                <StatTile
                  key={e.etapa}
                  titulo={`${e.etapa} (${fila.moneda})`}
                  valor={formatearValor(e.monto, "moneda", fila.moneda)}
                  // Sin comprado no hay porcentaje: no se disfraza de 0%.
                  detalle={fila.comprado > 0 ? `${e.porcentaje.toFixed(1)}% del comprado` : undefined}
                />
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>Embudo del circuito ({fila.moneda})</CardTitle></CardHeader>
              <CardContent><Embudo etapas={etapas} moneda={fila.moneda} /></CardContent>
            </Card>

            {mesesDeLaMoneda.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Actividad mensual ({fila.moneda})</CardTitle>
                  {/* El embudo suma toda orden del período sin importar cuándo se movió;
                      esta serie es lo que pasó en cada mes, de cualquier orden. Los totales difieren y está bien. */}
                  <CardDescription>
                    Compras y pagos registrados mes a mes, de cualquier orden — no es el desglose del embudo de arriba.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LineaTemporal
                    datos={mesesDeLaMoneda}
                    series={[
                      { clave: "comprado", nombre: "Comprado" },
                      { clave: "pagado", nombre: "Pagado" },
                    ]}
                    moneda={fila.moneda}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )
      })}

      <Card>
        <CardHeader><CardTitle>Detalle</CardTitle></CardHeader>
        <CardContent><TablaReporte tabla={tabla} /></CardContent>
      </Card>
    </div>
  )
}

function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0
}
