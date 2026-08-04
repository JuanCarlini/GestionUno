import type { TipoColumna } from "@/lib/export/tipos"
import { formatCurrency } from "@/shared/format-utils"
import { formatDateShort, parseFecha } from "@/shared/date-utils"

// La moneda es por fila, no global: un reporte puede traer filas en ARS y en USD
// y formatearlas todas igual sería mentir sobre el monto real.
export function formatearValor(valor: unknown, tipo: TipoColumna, moneda = "ARS"): string {
  if (valor === null || valor === undefined || valor === "") return "—"

  // Un valor no parseable muestra "—", nunca "$ NaN" ni "Invalid Date" literales.
  switch (tipo) {
    case "moneda": {
      const n = Number(valor)
      // Reusa el formateador compartido del proyecto en vez de duplicar el Intl.NumberFormat.
      return Number.isFinite(n) ? formatCurrency(n, moneda) : "—"
    }
    case "numero": {
      const n = Number(valor)
      return Number.isFinite(n) ? new Intl.NumberFormat("es-AR").format(n) : "—"
    }
    case "porcentaje": {
      const n = Number(valor)
      return Number.isFinite(n)
        ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n)}%`
        : "—"
    }
    case "fecha":
      // Reusa el formateador compartido, que parsea date-only como fecha local (sin
      // corrimiento de un día por UTC).
      return Number.isNaN(parseFecha(String(valor)).getTime()) ? "—" : formatDateShort(String(valor))
    default:
      return String(valor)
  }
}
