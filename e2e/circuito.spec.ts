import { test, expect, type APIRequestContext } from "@playwright/test"
import { loginApi, esperarOk } from "./sesion"

// El circuito completo, por API: OC → certificación → factura → orden de pago, con los cambios
// de estado en el medio. Es lo que corre el night job todas las noches contra un entorno de
// prueba sembrado con supabase/seed.sql.
//
// Por API y no por la UI a propósito: las reglas que importan viven en los services y en los
// triggers de Postgres, y un spec que las ejercita por los combobox de shadcn mide sobre todo
// la estabilidad de los selectores. La navegación la cubre navegacion.spec.ts.

const CANTIDAD = 10
const PRECIO = 9500
const IVA = 21
const NETO = CANTIDAD * PRECIO // 95.000
const CON_IVA = NETO * (1 + IVA / 100) // 114.950

async function primerId(request: APIRequestContext, url: string, que: string): Promise<number> {
  const cuerpo = await esperarOk(request.get(url), que)
  // Los listados paginados responden { data, total, ... }; los catálogos, un array pelado.
  const filas = Array.isArray(cuerpo) ? cuerpo : cuerpo.data
  expect(filas.length, `${que}: el seed tiene que dejar al menos una fila`).toBeGreaterThan(0)
  return filas[0].id
}

test.describe("circuito de compras", () => {
  test.beforeEach(async ({ request }) => {
    // supervisor: es el rol que puede aprobar en todas las etapas.
    await loginApi(request, "supervisor")
  })

  test("OC → certificación → factura → orden de pago", async ({ request }) => {
    // ---------------------------------------------------------------- datos del seed
    const proveedorId = await primerId(
      request,
      "/api/proveedores?q=Hormigonera&limit=1",
      "proveedor del seed"
    )
    const itemId = await primerId(request, "/api/items/search?query=SEM-0001", "ítem del seed")

    // ---------------------------------------------------------------- 1. alta de OC
    const oc = await esperarOk(
      request.post("/api/ordenes-compra", {
        data: {
          proveedor_id: proveedorId,
          fecha_oc: new Date().toISOString().slice(0, 10),
          moneda: "ARS",
          tarea: "E2E nocturno",
          lineas: [
            { item_id: itemId, cantidad: CANTIDAD, precio_unitario_neto: PRECIO, iva_porcentaje: IVA },
          ],
        },
      }),
      "crear OC"
    )

    expect(oc.estado, "la OC nace en borrador, lo fija el server").toBe("borrador")
    expect(oc.numero_oc, "numero_oc lo genera la base").toBeTruthy()
    // Los totales los calcula el trigger trg_recalc_oc_cabecera dentro de la transacción del alta.
    expect(Number(oc.total_neto)).toBeCloseTo(NETO, 2)
    expect(Number(oc.total_con_iva)).toBeCloseTo(CON_IVA, 2)

    // ---------------------------------------------------------------- 2. aprobar la OC
    // El circuito no saltea etapas: ir directo a 'aprobado' desde borrador da 409.
    const saltoInvalido = await request.patch(`/api/ordenes-compra/${oc.id}/estado`, {
      data: { estado: "aprobado" },
    })
    expect(saltoInvalido.status(), "borrador → aprobado tiene que rebotar").toBe(409)

    await esperarOk(
      request.patch(`/api/ordenes-compra/${oc.id}/estado`, { data: { estado: "en_aprobacion" } }),
      "OC a en_aprobacion"
    )
    const ocAprobada = await esperarOk(
      request.patch(`/api/ordenes-compra/${oc.id}/estado`, { data: { estado: "aprobado" } }),
      "OC a aprobado"
    )
    expect(ocAprobada.estado).toBe("aprobado")

    // ---------------------------------------------------------------- 3. certificar
    const lineas = await esperarOk(
      request.get(`/api/ordenes-compra/${oc.id}/lineas`),
      "líneas de la OC"
    )
    const lineaId = lineas[0].id

    // Más del 100% lo rechaza fn_check_avance_100, y con el alta transaccional no queda
    // ninguna cabecera huérfana detrás (tarea 1.2).
    const sobrecertificar = await request.post("/api/certificaciones", {
      data: {
        orden_compra_id: oc.id,
        lineas: [{ linea_oc_id: lineaId, avance_unidades: CANTIDAD + 1 }],
      },
    })
    expect(sobrecertificar.status(), "certificar de más tiene que rebotar").toBe(422)

    const cert = await esperarOk(
      request.post("/api/certificaciones", {
        data: {
          orden_compra_id: oc.id,
          lineas: [{ linea_oc_id: lineaId, avance_unidades: CANTIDAD }],
        },
      }),
      "crear certificación"
    )
    expect(Number(cert.total_neto), "la cabecera suma las líneas derivadas").toBeCloseTo(NETO, 2)

    await esperarOk(
      request.patch(`/api/certificaciones/${cert.id}/estado`, { data: { estado: "en_aprobacion" } }),
      "CE a en_aprobacion"
    )
    await esperarOk(
      request.patch(`/api/certificaciones/${cert.id}/estado`, { data: { estado: "aprobado" } }),
      "CE a aprobado"
    )

    // ---------------------------------------------------------------- 4. facturar
    // Imputar más que el total de la factura lo rechaza fn_check_imputacion.
    const imputacionExcedida = await request.post("/api/facturas", {
      data: {
        proveedor_id: proveedorId,
        fecha_emision: new Date().toISOString().slice(0, 10),
        moneda: "ARS",
        lineas: [{ descripcion: "E2E", cantidad: 1, precio_unitario: 100, iva_porcentaje: 0 }],
        imputaciones: [{ certificacion_id: cert.id, monto_asignado: 999_999 }],
      },
    })
    expect(imputacionExcedida.status(), "imputar de más tiene que rebotar").toBe(422)

    const factura = await esperarOk(
      request.post("/api/facturas", {
        data: {
          proveedor_id: proveedorId,
          fecha_emision: new Date().toISOString().slice(0, 10),
          moneda: "ARS",
          numero_comprobante: `E2E-${Date.now()}`,
          lineas: [
            { descripcion: "E2E", cantidad: CANTIDAD, precio_unitario: PRECIO, iva_porcentaje: IVA },
          ],
          imputaciones: [{ certificacion_id: cert.id, monto_asignado: NETO }],
        },
      }),
      "crear factura"
    )
    expect(Number(factura.total_facturado)).toBeCloseTo(CON_IVA, 2)

    const facturaFinal = await esperarOk(
      request.patch(`/api/facturas/${factura.id}/estado`, { data: { estado: "finalizado" } }),
      "factura a finalizado"
    )
    expect(facturaFinal.estado).toBe("finalizado")

    // ---------------------------------------------------------------- 5. pagar
    const cajaId = await primerId(request, "/api/cajas", "caja del seed")

    const op = await esperarOk(
      request.post("/api/ordenes-pago", {
        data: {
          proveedor_id: proveedorId,
          fecha_op: new Date().toISOString().slice(0, 10),
          moneda: "ARS",
        },
      }),
      "crear OP"
    )
    expect(Number(op.total_a_pagar), "la OP nace vacía").toBe(0)

    await esperarOk(
      request.post(`/api/ordenes-pago/${op.id}/facturas`, {
        data: { factura_id: factura.id, monto: CON_IVA },
      }),
      "agregar la factura a la OP"
    )
    await esperarOk(
      request.post(`/api/ordenes-pago/${op.id}/cajas`, {
        data: { caja_id: cajaId, monto: CON_IVA },
      }),
      "repartir el pago en una caja"
    )

    // total_a_pagar lo mantiene trg_recalc_op_total (tarea 1.4).
    const opConLineas = await esperarOk(request.get(`/api/ordenes-pago/${op.id}`), "releer la OP")
    expect(Number(opConLineas.total_a_pagar)).toBeCloseTo(CON_IVA, 2)

    await esperarOk(
      request.patch(`/api/ordenes-pago/${op.id}/estado`, { data: { estado: "en_aprobacion" } }),
      "OP a en_aprobacion (acá corre fn_op_gate: Σcajas = Σfacturas)"
    )
    await esperarOk(
      request.patch(`/api/ordenes-pago/${op.id}/estado`, { data: { estado: "aprobado" } }),
      "OP a aprobado"
    )
    const opPagada = await esperarOk(
      request.patch(`/api/ordenes-pago/${op.id}/estado`, { data: { estado: "pagado" } }),
      "OP a pagado"
    )
    expect(opPagada.estado).toBe("pagado")

    // ---------------------------------------------------------------- 6. reportes
    // Las mismas invariantes que verifica supabase/verificacion/reportes.sql, pero vistas desde
    // la API: si la agregación miente, acá se nota.
    const reporte = await esperarOk(
      request.get("/api/reportes/circuito?moneda=ARS"),
      "reporte del circuito"
    )
    const filas = reporte.tablas[0].filas
    expect(filas.length, "el reporte tiene que traer la moneda del circuito").toBeGreaterThan(0)

    for (const fila of filas) {
      expect(Number(fila.certificado), "certificado ≤ comprado").toBeLessThanOrEqual(
        Number(fila.comprado) + 0.01
      )
      expect(Number(fila.facturado), "facturado ≤ certificado").toBeLessThanOrEqual(
        Number(fila.certificado) + 0.01
      )
      expect(Number(fila.pagado), "pagado ≤ facturado").toBeLessThanOrEqual(
        Number(fila.facturado) + 0.01
      )
    }
  })

  test("un rol readonly no puede crear nada", async ({ request }) => {
    await loginApi(request, "readonly")

    const res = await request.post("/api/ordenes-compra", {
      data: { proveedor_id: 1, fecha_oc: "2026-01-01", moneda: "ARS" },
    })

    expect(res.status()).toBe(403)
    expect((await res.json()).error.codigo).toBe("PROHIBIDO")
  })
})
