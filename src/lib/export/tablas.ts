import type { ColumnaReporte } from "./tipos"
import type { FiltrosReporte } from "@/shared/validation/reporte-validation"

// Única definición de que columnas tiene cada reporte, como se titulan y como se
// formatean. La alimentan la tabla en pantalla, el Excel y el PDF.
export const COLUMNAS: Record<string, ColumnaReporte[]> = {
  circuito: [
    { clave: "moneda", titulo: "Moneda", tipo: "texto" },
    { clave: "comprado", titulo: "Comprado", tipo: "moneda" },
    { clave: "certificado", titulo: "Certificado", tipo: "moneda" },
    { clave: "facturado", titulo: "Facturado", tipo: "moneda" },
    { clave: "pagado", titulo: "Pagado", tipo: "moneda" },
  ],
  "circuito-mensual": [
    { clave: "moneda", titulo: "Moneda", tipo: "texto" },
    { clave: "mes", titulo: "Mes", tipo: "fecha" },
    { clave: "comprado", titulo: "Comprado", tipo: "moneda" },
    { clave: "pagado", titulo: "Pagado", tipo: "moneda" },
  ],
  "pendiente-certificar": [
    { clave: "numero_oc", titulo: "OC", tipo: "texto" },
    { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
    { clave: "proyecto", titulo: "Proyecto", tipo: "texto" },
    { clave: "fecha_oc", titulo: "Fecha", tipo: "fecha" },
    { clave: "moneda", titulo: "Moneda", tipo: "texto" },
    { clave: "total_oc", titulo: "Total OC", tipo: "moneda" },
    { clave: "pendiente", titulo: "Pendiente", tipo: "moneda" },
    { clave: "dias", titulo: "Días", tipo: "numero" },
  ],
  deuda: [
    { clave: "numero_factura", titulo: "Factura", tipo: "texto" },
    { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
    { clave: "fecha_emision", titulo: "Emisión", tipo: "fecha" },
    { clave: "moneda", titulo: "Moneda", tipo: "texto" },
    { clave: "total_facturado", titulo: "Total", tipo: "moneda" },
    { clave: "pagado", titulo: "Pagado", tipo: "moneda" },
    { clave: "saldo", titulo: "Saldo", tipo: "moneda" },
    { clave: "dias", titulo: "Días", tipo: "numero" },
    { clave: "tramo", titulo: "Tramo", tipo: "texto" },
  ],
  proveedores: [
    { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
    { clave: "estado", titulo: "Estado", tipo: "texto" },
    { clave: "moneda", titulo: "Moneda", tipo: "texto" },
    { clave: "comprado", titulo: "Comprado", tipo: "moneda" },
    { clave: "certificado", titulo: "Certificado", tipo: "moneda" },
    { clave: "facturado", titulo: "Facturado", tipo: "moneda" },
    { clave: "pagado", titulo: "Pagado", tipo: "moneda" },
    { clave: "deuda", titulo: "Deuda (imputada)", tipo: "moneda" },
    { clave: "cantidad_oc", titulo: "OC", tipo: "numero" },
  ],
  proyectos: [
    { clave: "proyecto", titulo: "Proyecto", tipo: "texto" },
    { clave: "tarea", titulo: "Tarea", tipo: "texto" },
    { clave: "moneda", titulo: "Moneda", tipo: "texto" },
    { clave: "comprado", titulo: "Comprado", tipo: "moneda" },
    { clave: "certificado", titulo: "Certificado", tipo: "moneda" },
    { clave: "pendiente", titulo: "Pendiente", tipo: "moneda" },
  ],
}

// Los seis reportes traen una columna "moneda" por fila y el filtro no fuerza una
// sola divisa (se puede elegir "Todas"); sumar monedas distintas no tiene sentido, no se totaliza.
export function calcularTotales(
  columnas: ColumnaReporte[],
  filas: Array<Record<string, unknown>>
): Record<string, number> {
  const monedas = new Set(filas.map((f) => f.moneda))
  if (monedas.size !== 1) return {}

  const totales: Record<string, number> = {}
  for (const c of columnas) {
    if (c.tipo !== "moneda") continue
    totales[c.clave] = filas.reduce((s, f) => s + Number(f[c.clave] ?? 0), 0)
  }
  return totales
}

// Etiquetas legibles de los filtros aplicados: encabezan la tabla en pantalla y el
// export, para que quede registrado con qué recorte se generó el reporte.
// Los nombres los resuelve el servicio: acá un id suelto ("Proveedor: 7") no le dice
// nada a quien recibe el archivo.
export function describirFiltros(
  f: FiltrosReporte,
  nombres: { proveedor?: string; proyecto?: string } = {}
): Record<string, string> {
  return {
    Período: `${f.desde} a ${f.hasta}`,
    Moneda: f.moneda ?? "Todas",
    Proveedor: nombres.proveedor ?? "Todos",
    Proyecto: nombres.proyecto ?? "Todos",
    // Zona fija: el archivo se genera en el servidor (UTC) y sin esto la marca de
    // hora sale tres horas adelantada respecto de cuando la pidieron.
    Generado: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date()),
  }
}
