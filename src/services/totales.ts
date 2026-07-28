// La DB no mantiene los totales de línea/cabecera: los calcula la app (los de certificación los
// deriva fn_lce_derive). number/float con 2 decimales; para cerrar al centavo, bigint de centavos.

// IVA por defecto (Argentina, alícuota general 21%). Se usa cuando una línea no trae iva_porcentaje.
export const IVA_DEFAULT = 21

const r2 = (n: number) => Math.round(n * 100) / 100

export function totalesDeLinea(cantidad: number, precioUnitario: number, ivaPorcentaje: number) {
  const total_neto = r2(cantidad * precioUnitario)
  return { total_neto, total_con_iva: r2(total_neto * (1 + ivaPorcentaje / 100)) }
}

// Number() explícito: los `numeric` de Postgres llegan como string por supabase-js.
export function totalesDeCabecera(lineas: { total_neto: number; total_con_iva: number }[]) {
  const total_neto = r2(lineas.reduce((a, l) => a + Number(l.total_neto), 0))
  const total_con_iva = r2(lineas.reduce((a, l) => a + Number(l.total_con_iva), 0))
  return { total_neto, total_iva: r2(total_con_iva - total_neto), total_con_iva }
}

// Cabecera de certificación: `avance_monto` e `iva_porcentaje` ya vienen derivados por
// fn_lce_derive y la app solo los suma. gu_certificaciones no tiene columna total_iva.
export function totalesDeCertificacion(lineas: { avance_monto: number; iva_porcentaje: number }[]) {
  const total_neto = r2(lineas.reduce((a, l) => a + Number(l.avance_monto), 0))
  const total_con_iva = r2(
    lineas.reduce((a, l) => a + Number(l.avance_monto) * (1 + Number(l.iva_porcentaje) / 100), 0)
  )
  return { total_neto, total_con_iva }
}
