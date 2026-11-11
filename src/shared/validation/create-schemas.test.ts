import { describe, it, expect } from "vitest"
import { CreateFacturaSchema } from "./factura-validation"
import { CreateOrdenCompraSchema } from "./orden-compra-validation"
import { CreateOrdenPagoSchema } from "./orden-pago-validation"
import { CreateProveedorSchema } from "./proveedor-validation"
import { CreateItemSchema } from "./item-validation"
import { CreateCajaSchema } from "./caja-validation"
import { CreateCertificacionSchema } from "./certificacion-validation"

// Los 7 create de colección: el borde anti mass-assignment (S2/S4). Zod descarta las claves
// desconocidas (sin .passthrough en todo el árbol) → estado/id/created_at nunca se pueden
// forzar desde el cliente; el estado inicial lo fija el server, el id/numero/created_at la DB.
// (CreateProyectoSchema tiene su propio test en proyecto-validation.test.ts.)
const casos = [
  { nombre: "factura", schema: CreateFacturaSchema, valido: { proveedor_id: 1, fecha_emision: "2026-01-01", lineas: [{ descripcion: "Mano de obra", cantidad: 1, precio_unitario: 100 }] } },
  { nombre: "orden-compra", schema: CreateOrdenCompraSchema, valido: { proveedor_id: 1, fecha_oc: "2026-01-01" } },
  { nombre: "orden-pago", schema: CreateOrdenPagoSchema, valido: { proveedor_id: 1, fecha_op: "2026-01-01" } },
  { nombre: "proveedor", schema: CreateProveedorSchema, valido: { nombre: "ACME", cuit: "20-12345678-9" } },
  { nombre: "item", schema: CreateItemSchema, valido: { codigo: "IT-1", nombre: "Cemento" } },
  { nombre: "caja", schema: CreateCajaSchema, valido: { nombre: "Banco Nación", tipo: "banco" } },
  { nombre: "certificacion", schema: CreateCertificacionSchema, valido: { orden_compra_id: 1, lineas: [{ linea_oc_id: 1, avance_unidades: 5 }] } },
] as const

describe.each(casos)("Create schema: $nombre", ({ schema, valido }) => {
  it("rechaza el body vacío (faltan campos requeridos)", () => {
    expect(schema.safeParse({}).success).toBe(false)
  })

  it("acepta un payload válido mínimo", () => {
    expect(schema.safeParse(valido).success).toBe(true)
  })

  it("descarta estado/id/created_at (S2/S4: no se pueden forzar)", () => {
    const r = schema.parse({ ...valido, estado: "aprobado", id: 999, created_at: "2020-01-01" }) as Record<string, unknown>
    expect("estado" in r).toBe(false)
    expect("id" in r).toBe(false)
    expect("created_at" in r).toBe(false)
  })
})
