"use client"

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { formatearValor } from "./formato"
import { parseFecha } from "@/shared/date-utils"

const ORDINAL = [
  "var(--rep-ordinal-1)", "var(--rep-ordinal-2)",
  "var(--rep-ordinal-3)", "var(--rep-ordinal-4)",
]
const SERIES = [
  "var(--rep-serie-1)", "var(--rep-serie-2)", "var(--rep-serie-3)",
  "var(--rep-serie-4)", "var(--rep-serie-5)", "var(--rep-serie-6)",
]

// Exportados para que ninguna pestaña reimplemente el estilo de ejes ni el wrapper.
export const EJE = {
  stroke: "var(--rep-eje)",
  tick: { fill: "var(--rep-tinta-mutada)", fontSize: 12 },
}

// Eje Y categórico: 180px fijos se comían medio viewport en móvil. Ancho contenido
// y etiqueta truncada; el nombre completo vive en el Tooltip.
export const EJE_CATEGORIA = {
  width: 110,
  tickFormatter: (v: unknown) => {
    const s = String(v)
    return s.length > 14 ? `${s.slice(0, 13)}…` : s
  },
}

// Montos abreviados para ticks de eje ("$ 34,6 M"): el monto exacto va en el Tooltip.
const COMPACTO = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 })
export const monedaCompacta = (v: unknown) => `$ ${COMPACTO.format(Number(v))}`

// El alto incluye la banda del eje X: fijar solo el área de trazado deja la tarjeta
// con un scroll vertical diminuto. `descripcion` es el nombre accesible del gráfico:
// el SVG de Recharts no anuncia nada por sí solo.
export function Contenedor({
  alto, descripcion, children,
}: {
  alto: number
  descripcion?: string
  children: React.ReactElement
}) {
  return (
    <div style={{ height: alto }} role={descripcion ? "img" : undefined} aria-label={descripcion}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  )
}

// Una serie, un color. Pintar cada barra según su valor duplica en color lo que el
// largo ya comunica y quema el único canal libre.
export function BarraHorizontal({
  datos, clave, etiqueta, moneda, alto = 320, descripcion,
}: {
  datos: Array<Record<string, unknown>>
  clave: string
  etiqueta: string
  moneda?: string
  alto?: number
  descripcion?: string
}) {
  return (
    <Contenedor alto={alto} descripcion={descripcion ?? `Gráfico de barras de ${clave} por ${etiqueta}`}>
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke="var(--rep-grid)" />
        <XAxis type="number" {...EJE} tickFormatter={monedaCompacta} />
        <YAxis type="category" dataKey={etiqueta} {...EJE} {...EJE_CATEGORIA} />
        <Tooltip
          formatter={(v) => formatearValor(v, "moneda", moneda)}
          contentStyle={{ background: "var(--rep-grid)", border: "none", borderRadius: 8 }}
        />
        <Bar dataKey={clave} fill="var(--rep-serie-1)" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </Contenedor>
  )
}

// Etapas ordenadas de una progresión, no identidades: rampa de un solo tono.
export function Embudo({
  etapas, moneda, alto = 280,
}: {
  etapas: Array<{ etapa: string; monto: number; porcentaje: number }>
  moneda: string
  alto?: number
}) {
  return (
    <Contenedor alto={alto} descripcion={`Embudo del circuito en ${moneda}: ${etapas.map((e) => e.etapa).join(", ")}`}>
      <BarChart data={etapas} layout="vertical" margin={{ left: 8, right: 48 }}>
        <CartesianGrid horizontal={false} stroke="var(--rep-grid)" />
        <XAxis type="number" {...EJE} tickFormatter={monedaCompacta} />
        <YAxis type="category" dataKey="etapa" width={110} {...EJE} />
        <Tooltip
          formatter={(v) => formatearValor(v, "moneda", moneda)}
          contentStyle={{ background: "var(--rep-grid)", border: "none", borderRadius: 8 }}
        />
        <Bar dataKey="monto" radius={[0, 4, 4, 0]} barSize={26}>
          {etapas.map((_, i) => <Cell key={i} fill={ORDINAL[i] ?? ORDINAL[3]} />)}
        </Bar>
      </BarChart>
    </Contenedor>
  )
}

// Solo monto. La cantidad de documentos va en la tabla: dos ejes Y inventan una
// correlación que no está en los datos.
export function LineaTemporal({
  datos, series, moneda, alto = 300,
}: {
  datos: Array<Record<string, unknown>>
  series: Array<{ clave: string; nombre: string }>
  moneda: string
  alto?: number
}) {
  // "2026-03-01" (date_trunc de la RPC) se rotula como "mar 26": el string crudo en el
  // eje no lo lee nadie, y parseado local para no correr un día (UTC-3).
  const mesCorto = (v: unknown) =>
    parseFecha(String(v)).toLocaleDateString("es-AR", { month: "short", year: "2-digit" })

  return (
    <Contenedor alto={alto} descripcion={`Evolución mensual en ${moneda}: ${series.map((s) => s.nombre).join(" y ")}`}>
      <LineChart data={datos} margin={{ left: 24, right: 24 }}>
        <CartesianGrid vertical={false} stroke="var(--rep-grid)" />
        <XAxis dataKey="mes" {...EJE} tickFormatter={mesCorto} />
        <YAxis {...EJE} tickFormatter={monedaCompacta} />
        <Tooltip
          formatter={(v) => formatearValor(v, "moneda", moneda)}
          labelFormatter={mesCorto}
          contentStyle={{ background: "var(--rep-grid)", border: "none", borderRadius: 8 }}
        />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.clave}
            type="monotone"
            dataKey={s.clave}
            name={s.nombre}
            stroke={SERIES[i]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </Contenedor>
  )
}

// Parte de un todo, de un vistazo, seis segmentos como máximo. Fuera de ese caso
// una barra comunica mejor.
export function TortaComposicion({
  datos, moneda, alto = 320,
}: {
  datos: Array<{ nombre: string; monto: number }>
  moneda: string
  alto?: number
}) {
  return (
    <Contenedor alto={alto} descripcion={`Composición por ${datos.map((d) => d.nombre).join(", ")} en ${moneda}`}>
      <PieChart>
        <Pie data={datos} dataKey="monto" nameKey="nombre" innerRadius={0} outerRadius={110} paddingAngle={1}>
          {/* key por nombre: con el índice, al cambiar el filtro Recharts reusa los
              segmentos y puede pintar un frame con el color anterior */}
          {datos.map((d, i) => (
            <Cell key={d.nombre} fill={SERIES[i % SERIES.length]} stroke="var(--rep-superficie)" />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatearValor(v, "moneda", moneda)}
          contentStyle={{ background: "var(--rep-grid)", border: "none", borderRadius: 8 }}
        />
        <Legend />
      </PieChart>
    </Contenedor>
  )
}

// Un ratio contra un límite: la forma correcta es un medidor, no un gráfico.
export function Medidor({ valor, total }: { valor: number; total: number }) {
  const pct = total > 0 ? Math.min((valor / total) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--rep-serie-1)" }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {total > 0 ? `${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  )
}

// Cifras protagonistas: figuras proporcionales, no tabular-nums, que a tamaño grande
// dejan los números sueltos.
export function StatTile({
  titulo, valor, detalle,
}: {
  titulo: string
  valor: string
  detalle?: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  )
}
