import ExcelJS from "exceljs"
import type { ColumnaReporte, EstrategiaExport, TablaReporte, TipoColumna } from "./tipos"
import { neutralizarFormula } from "./csv"
import { parseFecha } from "@/shared/date-utils"

const PALETA = {
  encabezado: "FF104281",
  encabezadoTexto: "FFFFFFFF",
  banda: "FFF4F7FB",
  totales: "FFE1E0D9",
  borde: "FFC3C2B7",
  tenue: "FF52514E",
} as const

const SIMBOLO_MONEDA: Record<string, string> = {
  ARS: '"$"',
  USD: '"US$"',
  EUR: '"€"',
}

const TIPOS_NUMERICOS: ReadonlySet<TipoColumna> = new Set(["numero", "moneda", "porcentaje"])

const ANCHO_MINIMO = 12
const ANCHO_MAXIMO = 46

function formatoBase(tipo: TipoColumna): string | undefined {
  switch (tipo) {
    case "moneda":
      return "#,##0.00"
    case "numero":
      return "#,##0"
    case "porcentaje":
      return '0.0"%"'
    case "fecha":
      return "dd/mm/yyyy"
    default:
      return undefined
  }
}

function formatoMoneda(moneda: unknown): string {
  const simbolo = SIMBOLO_MONEDA[String(moneda)]
  return simbolo ? `${simbolo} #,##0.00` : "#,##0.00"
}

function convertir(valor: unknown, tipo: TipoColumna): unknown {
  if (valor === null || valor === undefined) return null

  if (TIPOS_NUMERICOS.has(tipo)) {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : null
  }
  if (tipo === "fecha") {
    const fecha = parseFecha(String(valor))
    return Number.isNaN(fecha.getTime()) ? null : fecha
  }
  return neutralizarFormula(String(valor))
}

function anchoDeColumna(columna: ColumnaReporte, filas: Array<Record<string, unknown>>): number {
  const largos = filas.map((f) => String(f[columna.clave] ?? "").length)
  const mayor = Math.max(columna.titulo.length, ...largos, 0)
  return Math.min(Math.max(mayor + 4, ANCHO_MINIMO), ANCHO_MAXIMO)
}

function nombreHoja(titulo: string, indice: number, usados: Set<string>): string {
  const limpio = titulo.replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || `Hoja ${indice + 1}`
  let candidato = limpio
  let sufijo = 2
  while (usados.has(candidato)) {
    const marca = ` (${sufijo})`
    candidato = limpio.slice(0, 31 - marca.length) + marca
    sufijo++
  }
  usados.add(candidato)
  return candidato
}

class HojaReporteBuilder {
  private readonly hoja: ExcelJS.Worksheet
  private readonly columnas: ColumnaReporte[]
  private filaEncabezado = 0
  private ultimaFilaDato = 0

  constructor(libro: ExcelJS.Workbook, nombre: string, private readonly tabla: TablaReporte) {
    this.hoja = libro.addWorksheet(nombre, {
      views: [{ state: "frozen" }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })
    this.columnas = tabla.columnas
  }

  titulo(): this {
    const fila = this.hoja.addRow([this.tabla.titulo])
    fila.font = { bold: true, size: 16 }
    fila.height = 24
    this.hoja.mergeCells(fila.number, 1, fila.number, this.columnas.length)
    return this
  }

  filtros(): this {
    for (const [clave, valor] of Object.entries(this.tabla.filtros)) {
      const fila = this.hoja.addRow([clave, valor])
      fila.getCell(1).font = { bold: true, size: 9, color: { argb: PALETA.tenue } }
      fila.getCell(2).font = { size: 9, color: { argb: PALETA.tenue } }
    }
    this.hoja.addRow([])
    return this
  }

  encabezado(): this {
    const fila = this.hoja.addRow(this.columnas.map((c) => c.titulo))
    fila.height = 20
    fila.eachCell((celda, i) => {
      celda.font = { bold: true, color: { argb: PALETA.encabezadoTexto } }
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.encabezado } }
      celda.alignment = {
        vertical: "middle",
        horizontal: TIPOS_NUMERICOS.has(this.columnas[i - 1].tipo) ? "right" : "left",
      }
    })
    this.filaEncabezado = fila.number
    return this
  }

  datos(): this {
    this.tabla.filas.forEach((origen, indice) => {
      const fila = this.hoja.addRow(this.columnas.map((c) => convertir(origen[c.clave], c.tipo)))

      if (indice % 2 === 1) {
        fila.eachCell((celda) => {
          celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.banda } }
        })
      }

      this.columnas.forEach((columna, i) => {
        const celda = fila.getCell(i + 1)
        celda.numFmt =
          columna.tipo === "moneda" ? formatoMoneda(origen.moneda) : formatoBase(columna.tipo) ?? ""
        if (TIPOS_NUMERICOS.has(columna.tipo)) celda.alignment = { horizontal: "right" }
      })
    })

    this.ultimaFilaDato = this.filaEncabezado + this.tabla.filas.length
    return this
  }

  totales(): this {
    const claves = Object.keys(this.tabla.totales ?? {})
    if (claves.length === 0 || this.tabla.filas.length === 0) return this

    const monedaUnica = this.tabla.filas[0]?.moneda
    const fila = this.hoja.addRow(
      this.columnas.map((c, i) => (i === 0 ? "Total" : this.tabla.totales?.[c.clave] ?? null))
    )

    fila.eachCell((celda, i) => {
      const columna = this.columnas[i - 1]
      celda.font = { bold: true }
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.totales } }
      celda.border = { top: { style: "thin", color: { argb: PALETA.borde } } }
      if (columna.tipo === "moneda") celda.numFmt = formatoMoneda(monedaUnica)
      else if (TIPOS_NUMERICOS.has(columna.tipo)) celda.numFmt = formatoBase(columna.tipo) ?? ""
    })

    return this
  }

  navegacion(): this {
    this.columnas.forEach((columna, i) => {
      this.hoja.getColumn(i + 1).width = anchoDeColumna(columna, this.tabla.filas)
    })

    if (this.tabla.filas.length > 0) {
      this.hoja.autoFilter = {
        from: { row: this.filaEncabezado, column: 1 },
        to: { row: this.ultimaFilaDato, column: this.columnas.length },
      }
    }

    this.hoja.views = [{ state: "frozen", ySplit: this.filaEncabezado }]
    this.hoja.pageSetup.printTitlesRow = `${this.filaEncabezado}:${this.filaEncabezado}`
    return this
  }

  construir(): ExcelJS.Worksheet {
    return this.hoja
  }
}

export class ExportXlsx implements EstrategiaExport {
  readonly formato = "xlsx"
  readonly mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  readonly extension = "xlsx"

  async generar(tablas: TablaReporte[]): Promise<Buffer> {
    const libro = new ExcelJS.Workbook()
    libro.created = new Date()
    const nombresUsados = new Set<string>()

    tablas.forEach((tabla, indice) => {
      new HojaReporteBuilder(libro, nombreHoja(tabla.titulo, indice, nombresUsados), tabla)
        .titulo()
        .filtros()
        .encabezado()
        .datos()
        .totales()
        .navegacion()
        .construir()
    })

    const datos = await libro.xlsx.writeBuffer()
    return Buffer.from(datos)
  }
}
