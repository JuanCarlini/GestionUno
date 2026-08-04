"use client"

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useReporte } from "@/hooks/use-reporte"
import { BarraHorizontal, Medidor } from "./graficos"
import { formatearValor } from "./formato"
import { porMoneda } from "./moneda"

interface FilaProyecto {
  proyecto: string
  tarea: string
  moneda: string
  comprado: number
  certificado: number
  pendiente: number
}

export function TabProyectos() {
  const { reporte, loading, error } = useReporte("proyectos")

  if (error && !reporte) {
    return <p role="alert" className="py-8 text-center text-destructive">Error: {error}</p>
  }
  if (!reporte) {
    return <p className="py-8 text-center text-muted-foreground">Cargando…</p>
  }

  const filas = reporte.tablas[0].filas as unknown as FilaProyecto[]

  return (
    // Al refiltrar se conserva el render anterior atenuado: sin salto a esqueleto.
    <div aria-busy={loading} className={`space-y-6 ${loading ? "opacity-40 transition-opacity" : ""}`}>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {porMoneda(filas).map(([moneda, filasMoneda]) => {
        const porProyecto = Object.values(
          filasMoneda.reduce<Record<string, { etiqueta: string; comprado: number }>>((acc, f) => {
            acc[f.proyecto] ??= { etiqueta: f.proyecto, comprado: 0 }
            acc[f.proyecto].comprado += Number(f.comprado)
            return acc
          }, {})
        ).sort((a, b) => b.comprado - a.comprado)

        return (
          <Card key={moneda}>
            <CardHeader><CardTitle>Comprado por proyecto ({moneda})</CardTitle></CardHeader>
            <CardContent>
              <BarraHorizontal
                datos={porProyecto}
                clave="comprado"
                etiqueta="etiqueta"
                moneda={moneda}
                alto={360}
                // Este agregado por proyecto no existe en la tabla (que abre por tarea):
                // la descripción es su única forma textual.
                descripcion={`Total comprado por proyecto en ${moneda}: ${porProyecto
                  .map((p) => `${p.etiqueta} ${formatearValor(p.comprado, "moneda", moneda)}`)
                  .join(", ")}`}
              />
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader><CardTitle>Ejecución por proyecto y tarea</CardTitle></CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Sin datos para los filtros elegidos. Probá ampliar el período o aflojar los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead className="text-right">Comprado</TableHead>
                    <TableHead className="text-right">Certificado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Ejecución</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>{f.proyecto}</TableCell>
                      <TableCell>{f.tarea}</TableCell>
                      <TableCell>{f.moneda}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearValor(f.comprado, "moneda", f.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearValor(f.certificado, "moneda", f.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearValor(f.pendiente, "moneda", f.moneda)}
                      </TableCell>
                      <TableCell>
                        <Medidor valor={Number(f.certificado)} total={Number(f.comprado)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
