"use client"

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { TablaReporte as Tabla } from "@/lib/export/tipos"
import { formatearValor } from "./formato"

// Solo número/moneda/porcentaje se comparan en columna: van a la derecha con
// tabular-nums. Fecha y texto se leen, no se suman, y van a la izquierda.
const TIPOS_NUMERICOS = new Set(["numero", "moneda", "porcentaje"])

// Gemela obligatoria de cada gráfico: ningún valor debe ser legible solo por color
// o solo por tooltip. Es también la estructura que después se exporta a Excel.
export function TablaReporte({ tabla }: { tabla: Tabla }) {
  if (tabla.filas.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Sin datos para los filtros elegidos. Probá ampliar el período o aflojar los
        filtros aplicados.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {tabla.columnas.map((c) => (
              <TableHead
                key={c.clave}
                className={TIPOS_NUMERICOS.has(c.tipo) ? "text-right" : ""}
              >
                {c.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tabla.filas.map((fila, i) => (
            <TableRow key={i}>
              {tabla.columnas.map((c) => (
                <TableCell
                  key={c.clave}
                  className={TIPOS_NUMERICOS.has(c.tipo) ? "text-right tabular-nums whitespace-nowrap" : ""}
                >
                  {formatearValor(fila[c.clave], c.tipo, String(fila.moneda ?? "ARS"))}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
