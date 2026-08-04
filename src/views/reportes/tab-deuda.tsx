"use client"

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useReporte } from "@/hooks/use-reporte"
import { Contenedor, EJE, EJE_CATEGORIA, monedaCompacta, StatTile } from "./graficos"
import { TablaReporte } from "./tabla-reporte"
import { formatearValor } from "./formato"
import { porMoneda } from "./moneda"

interface FilaDeuda {
  proveedor: string
  moneda: string
  saldo: number
  dias: number
  tramo: string
}

// Severidad real, no identidad de serie: por eso paleta de estado. La etiqueta del
// tramo está siempre visible en la leyenda; un color de estado nunca comunica solo.
const TRAMOS = [
  { clave: "0-30", color: "var(--rep-estado-bueno)" },
  { clave: "31-60", color: "var(--rep-estado-aviso)" },
  { clave: "61-90", color: "var(--rep-estado-grave)" },
  { clave: "+90", color: "var(--rep-estado-critico)" },
]

export function TabDeuda() {
  const { reporte, loading, error } = useReporte("deuda")

  if (error && !reporte) {
    return <p role="alert" className="py-8 text-center text-destructive">Error: {error}</p>
  }
  if (!reporte) {
    return <p className="py-8 text-center text-muted-foreground">Cargando…</p>
  }

  const tabla = reporte.tablas[0]
  const filas = tabla.filas as unknown as FilaDeuda[]

  return (
    // Al refiltrar se conserva el render anterior atenuado: sin salto a esqueleto.
    <div aria-busy={loading} className={`space-y-6 ${loading ? "opacity-40 transition-opacity" : ""}`}>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {porMoneda(filas).map(([moneda, filasMoneda]) => {
        const total = filasMoneda.reduce((s, f) => s + Number(f.saldo), 0)
        // Ponderado por saldo: una factura de $100 no pesa lo mismo que una de $10M.
        // El promedio simple subestimaba la exposición con muchas facturas chicas nuevas.
        const diasPromedio = total > 0
          ? Math.round(filasMoneda.reduce((s, f) => s + Number(f.dias) * Number(f.saldo), 0) / total)
          : 0

        // La suma de los cuatro tramos por proveedor tiene que dar el saldo total del
        // indicador: cada fila aporta su saldo entero al tramo que le corresponde.
        const porProveedor = Object.values(
          filasMoneda.reduce<Record<string, Record<string, number | string>>>((acc, f) => {
            acc[f.proveedor] ??= { proveedor: f.proveedor, "0-30": 0, "31-60": 0, "61-90": 0, "+90": 0 }
            acc[f.proveedor][f.tramo] = Number(acc[f.proveedor][f.tramo] ?? 0) + Number(f.saldo)
            return acc
          }, {})
        )

        return (
          <div key={moneda} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatTile titulo={`Deuda total (${moneda})`} valor={formatearValor(total, "moneda", moneda)} />
              <StatTile titulo="Facturas impagas" valor={String(filasMoneda.length)} />
              <StatTile titulo="Antigüedad promedio" valor={`${diasPromedio} días`} />
            </div>

            <Card>
              <CardHeader><CardTitle>Antigüedad de la deuda por proveedor ({moneda})</CardTitle></CardHeader>
              <CardContent>
                <Contenedor alto={420} descripcion={`Deuda por proveedor y tramo de antigüedad en ${moneda}`}>
                  <BarChart data={porProveedor} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="var(--rep-grid)" />
                    <XAxis type="number" {...EJE} tickFormatter={monedaCompacta} />
                    <YAxis type="category" dataKey="proveedor" {...EJE} {...EJE_CATEGORIA} />
                    <Tooltip
                      formatter={(v) => formatearValor(v, "moneda", moneda)}
                      contentStyle={{ background: "var(--rep-grid)", border: "none", borderRadius: 8 }}
                    />
                    <Legend />
                    {TRAMOS.map((t) => (
                      <Bar
                        key={t.clave}
                        dataKey={t.clave}
                        name={`${t.clave} días`}
                        stackId="aging"
                        fill={t.color}
                        barSize={18}
                        // Separación por hueco de superficie, no un borde: un trazo en color
                        // de grilla sería una línea dibujada alrededor de cada segmento.
                        stroke="var(--rep-superficie)"
                        strokeWidth={2}
                      />
                    ))}
                  </BarChart>
                </Contenedor>
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
