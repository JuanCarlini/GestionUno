import type { EstrategiaExport, TablaReporte } from "./tipos"

// Arranca con estos caracteres: Excel lo lee como fórmula al abrir. Los campos de
// texto los carga el usuario, así que hay que neutralizarlo, no solo escaparlo para el CSV.
const INICIO_FORMULA = /^[=+\-@]/

// Exportada: xlsx.ts la reutiliza para el mismo riesgo en celdas de texto.
export function neutralizarFormula(texto: string): string {
  return INICIO_FORMULA.test(texto) ? `'${texto}` : texto
}

function escapar(valor: unknown): string {
  if (valor === null || valor === undefined) return ""
  const texto = String(valor)
  // Comillas dobles duplicadas y campo entrecomillado si trae el separador, una
  // comilla o un salto de línea (\r incluido: sin él, una fila se parte en dos).
  return /["\r\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

// Formatea una celda de fila: solo las columnas de texto pasan por el filtro de
// fórmulas, porque número/moneda/fecha los calcula el sistema, no el usuario.
function celda(valor: unknown, tipo: string): string {
  if (tipo === "texto" && typeof valor === "string") {
    return escapar(neutralizarFormula(valor))
  }
  return escapar(valor)
}

const BOM_UTF8 = "\uFEFF"

export class ExportCsv implements EstrategiaExport {
  readonly formato = "csv"
  readonly mime = "text/csv; charset=utf-8"
  readonly extension = "csv"

  async generar(tablas: TablaReporte[]): Promise<Buffer> {
    const lineas: string[] = []

    for (const tabla of tablas) {
      lineas.push(escapar(tabla.titulo))
      for (const [clave, valor] of Object.entries(tabla.filtros)) {
        lineas.push(`${escapar(clave)};${escapar(valor)}`)
      }
      lineas.push("")
      lineas.push(tabla.columnas.map((c) => escapar(c.titulo)).join(";"))
      for (const fila of tabla.filas) {
        lineas.push(tabla.columnas.map((c) => celda(fila[c.clave], c.tipo)).join(";"))
      }
      lineas.push("")
    }

    // BOM UTF-8 como escape (constante nombrada, no carácter invisible en el
    // fuente): sin él, Excel abre los acentos como caracteres rotos.
    return Buffer.from(BOM_UTF8 + lineas.join("\r\n"), "utf-8")
  }
}
