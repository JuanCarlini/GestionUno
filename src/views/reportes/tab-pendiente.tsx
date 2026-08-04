"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useReporte } from "@/hooks/use-reporte"
import { BarraHorizontal, StatTile } from "./graficos"
import { TablaReporte } from "./tabla-reporte"
import { formatearValor } from "./formato"
import { porMoneda } from "./moneda"

interface FilaPendiente {
  numero_oc: string
  proveedor: string
  moneda: string
  pendiente: number
  dias: number
}

export function TabPendiente() {
  const { reporte, loading, error } = useReporte("pendiente-certificar")

  if (error && !reporte) {
    return <p role="alert" className="py-8 text-center text-destructive">Error: {error}</p>
  }
  if (!reporte) {
    return <p className="py-8 text-center text-muted-foreground">Cargando…</p>
  }

  const tabla = reporte.tablas[0]
  const filas = tabla.filas as unknown as FilaPendiente[]

  return (
    // Al refiltrar se conserva el render anterior atenuado: sin salto a esqueleto.
    <div aria-busy={loading} className={`space-y-6 ${loading ? "opacity-40 transition-opacity" : ""}`}>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {porMoneda(filas).map(([moneda, filasMoneda]) => {
        const total = filasMoneda.reduce((s, f) => s + Number(f.pendiente), 0)
        const top = [...filasMoneda]
          .sort((a, b) => Number(b.pendiente) - Number(a.pendiente))
          .slice(0, 10)
          .map((f) => ({ etiqueta: `${f.numero_oc} · ${f.proveedor}`, pendiente: Number(f.pendiente) }))

        return (
          <div key={moneda} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatTile
                titulo={`Pendiente de certificar (${moneda})`}
                valor={formatearValor(total, "moneda", moneda)}
                detalle="Comprado que todavía no se recibió"
              />
              <StatTile titulo="Órdenes con saldo" valor={String(filasMoneda.length)} />
              <StatTile
                titulo="Antigüedad máxima"
                valor={`${Math.max(...filasMoneda.map((f) => Number(f.dias)))} días`}
              />
            </div>

            <Card>
              <CardHeader><CardTitle>Diez órdenes de mayor saldo ({moneda})</CardTitle></CardHeader>
              <CardContent>
                <BarraHorizontal datos={top} clave="pendiente" etiqueta="etiqueta" moneda={moneda} alto={380} />
              </CardContent>
            </Card>
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
