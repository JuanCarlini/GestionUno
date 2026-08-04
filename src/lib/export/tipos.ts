// Estructura única que alimenta la tabla en pantalla y los exports (el "PDF" es la
// impresión del navegador sobre esa misma tabla, no una estrategia más). El tipo de
// columna es lo que hace que en Excel los montos sean números y las fechas, fechas.
export type TipoColumna = "texto" | "numero" | "moneda" | "fecha" | "porcentaje"

export interface ColumnaReporte {
  clave: string
  titulo: string
  tipo: TipoColumna
}

export interface TablaReporte {
  titulo: string
  filtros: Record<string, string>
  columnas: ColumnaReporte[]
  filas: Array<Record<string, unknown>>
  totales?: Record<string, number>
}

// Strategy: cada formato (CSV, XLSX, ...) implementa esto y se suma al registro.
// Agregar un formato nuevo es una clase más una línea, sin condicionales por formato.
export interface EstrategiaExport {
  readonly formato: string
  readonly mime: string
  readonly extension: string
  generar(tablas: TablaReporte[]): Promise<Buffer>
}
