import { z } from "zod"
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi"

import { CreateCajaSchema, UpdateCajaSchema } from "@/shared/validation/caja-validation"
import {
  CreateCertificacionSchema,
  UpdateCertificacionSchema,
  CambiarEstadoCertificacionSchema,
} from "@/shared/validation/certificacion-validation"
import { CambiarActivoSchema } from "@/shared/validation/estado-validation"
import {
  CreateFacturaSchema,
  CambiarEstadoFacturaSchema,
  ImputarSchema,
} from "@/shared/validation/factura-validation"
import { CreateItemSchema, UpdateItemSchema } from "@/shared/validation/item-validation"
import {
  CreateOrdenCompraSchema,
  CreateOrdenCompraLineaSchema,
  UpdateOrdenCompraSchema,
  CambiarEstadoOCSchema,
} from "@/shared/validation/orden-compra-validation"
import {
  CreateOrdenPagoSchema,
  AgregarFacturaSchema,
  AgregarCajaSchema,
  CambiarEstadoOPSchema,
} from "@/shared/validation/orden-pago-validation"
import {
  CreateProveedorSchema,
  UpdateProveedorSchema,
} from "@/shared/validation/proveedor-validation"
import {
  CreateProyectoSchema,
  UpdateProyectoSchema,
} from "@/shared/validation/proyecto-validation"
import { FiltrosReporteSchema } from "@/shared/validation/reporte-validation"

// Contrato OpenAPI generado DESDE los schemas Zod que ya validan en el borde de la API, no
// escrito aparte: un contrato que se mantiene a mano miente apenas alguien cambia un campo.
// Lo que acá se describe de más (resúmenes, permisos, respuestas) es lo único que no vive en
// un schema.
//
// La cobertura la verifica openapi.test.ts: si una ruta de src/app/api no está en esta tabla,
// el test falla. Por eso la tabla es declarativa y no 79 bloques escritos a mano.
extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

// ---------------------------------------------------------------- componentes comunes

const ErrorSchema = registry.register(
  "Error",
  z
    .object({
      error: z.object({
        codigo: z.enum([
          "VALIDACION",
          "NO_AUTORIZADO",
          "PROHIBIDO",
          "NO_ENCONTRADO",
          "CONFLICTO",
          "REGLA_NEGOCIO",
          "DEMASIADOS_INTENTOS",
          "SERVICIO_NO_DISPONIBLE",
          "ERROR_INTERNO",
        ]),
        mensaje: z.string(),
        detalles: z.unknown().optional(),
      }),
    })
    .openapi({ description: "Formato único de error de la API (lib/route/respuesta-error.ts)" })
)

// Las respuestas de éxito NO tienen schema Zod: las filas salen de la base y su forma vive en
// database.types.ts. Describirlas a mano acá sería inventar un segundo lugar donde se
// desactualizan, así que se declaran como objetos abiertos y el contrato es honesto sobre eso.
const FilaSchema = z
  .record(z.string(), z.unknown())
  .openapi({ description: "Fila del recurso; la forma exacta sale de database.types.ts" })

const PaginadoSchema = registry.register(
  "Paginado",
  z
    .object({
      data: z.array(FilaSchema),
      total: z.number().int().openapi({ description: "Filas de la consulta SIN paginar" }),
      page: z.number().int(),
      limit: z.number().int(),
      next: z.string().nullable().openapi({ description: "URL de la página siguiente, o null" }),
    })
    .openapi({ description: "Cuerpo de un listado paginado (lib/route/paginacion.ts)" })
)

// Parámetros de query de los listados paginados.
const PARAMS_LISTADO = [
  { nombre: "page", tipo: "integer", descripcion: "Página, 1-based. Default 1." },
  { nombre: "limit", tipo: "integer", descripcion: "Filas por página. Default 25, máximo 100." },
  { nombre: "q", tipo: "string", descripcion: "Búsqueda de texto libre." },
  { nombre: "estado", tipo: "string", descripcion: "Filtra por estado." },
  { nombre: "proveedorId", tipo: "integer", descripcion: "Filtra por proveedor." },
  { nombre: "orden", tipo: "string", descripcion: "columna.asc | columna.desc" },
] as const

type Metodo = "get" | "post" | "put" | "patch" | "delete"

interface Operacion {
  ruta: string
  metodo: Metodo
  tag: string
  resumen: string
  /** Permiso `modulo:accion` que exige la ruta, o la nota de autorización. */
  permiso: string
  body?: z.ZodTypeAny
  /** El listado paginado agrega los parámetros de página, filtros y orden. */
  listado?: boolean
  /** Respuesta 200 cuando no es ni el paginado ni una fila. */
  respuesta?: z.ZodTypeAny
  /** 204 / sin cuerpo. */
  sinCuerpo?: boolean
}

// ---------------------------------------------------------------- la tabla

const OPERACIONES: Operacion[] = [
  // --- salud y sesión
  { ruta: "/api/health", metodo: "get", tag: "Salud", resumen: "Estado de la app y sus dependencias", permiso: "público",
    respuesta: z.object({ ok: z.boolean(), db: z.enum(["ok", "error"]), storage: z.enum(["ok", "error"]), version: z.string() }) },
  { ruta: "/api/auth/login", metodo: "post", tag: "Sesión", resumen: "Iniciar sesión", permiso: "público",
    body: z.object({ email: z.string().email(), password: z.string() }) },
  { ruta: "/api/auth/logout", metodo: "post", tag: "Sesión", resumen: "Cerrar sesión", permiso: "autenticado" },
  { ruta: "/api/auth/me", metodo: "get", tag: "Sesión", resumen: "Usuario de la sesión actual", permiso: "autenticado" },
  { ruta: "/api/auth/change-password", metodo: "post", tag: "Sesión", resumen: "Cambiar la propia contraseña", permiso: "autenticado",
    body: z.object({ oldPassword: z.string(), newPassword: z.string() }) },

  // --- órdenes de compra
  { ruta: "/api/ordenes-compra", metodo: "get", tag: "Órdenes de compra", resumen: "Listado paginado", permiso: "ordenes_compra:ver", listado: true },
  { ruta: "/api/ordenes-compra", metodo: "post", tag: "Órdenes de compra", resumen: "Crear (nace en borrador)", permiso: "ordenes_compra:crear", body: CreateOrdenCompraSchema },
  { ruta: "/api/ordenes-compra/{id}", metodo: "get", tag: "Órdenes de compra", resumen: "Obtener una", permiso: "ordenes_compra:ver" },
  { ruta: "/api/ordenes-compra/{id}", metodo: "put", tag: "Órdenes de compra", resumen: "Editar la cabecera (solo el creador, o quien pueda aprobar)", permiso: "ordenes_compra:crear", body: UpdateOrdenCompraSchema },
  { ruta: "/api/ordenes-compra/{id}", metodo: "delete", tag: "Órdenes de compra", resumen: "Borrar (solo el creador, o quien pueda aprobar)", permiso: "ordenes_compra:borrar", sinCuerpo: true },
  { ruta: "/api/ordenes-compra/{id}/estado", metodo: "patch", tag: "Órdenes de compra", resumen: "Cambiar de estado", permiso: "ordenes_compra:aprobar", body: CambiarEstadoOCSchema },
  { ruta: "/api/ordenes-compra/{id}/lineas", metodo: "get", tag: "Órdenes de compra", resumen: "Líneas con su avance certificado", permiso: "ordenes_compra:ver" },
  { ruta: "/api/ordenes-compra/{id}/lineas", metodo: "post", tag: "Órdenes de compra", resumen: "Agregar una línea", permiso: "ordenes_compra:crear", body: CreateOrdenCompraLineaSchema },
  { ruta: "/api/ordenes-compra/lineas/{lineaId}", metodo: "put", tag: "Órdenes de compra", resumen: "Editar una línea", permiso: "ordenes_compra:crear", body: CreateOrdenCompraLineaSchema.partial() },
  { ruta: "/api/ordenes-compra/lineas/{lineaId}", metodo: "delete", tag: "Órdenes de compra", resumen: "Borrar una línea", permiso: "ordenes_compra:crear", sinCuerpo: true },

  // --- certificaciones
  { ruta: "/api/certificaciones", metodo: "get", tag: "Certificaciones", resumen: "Listado paginado", permiso: "certificaciones:ver", listado: true },
  { ruta: "/api/certificaciones", metodo: "post", tag: "Certificaciones", resumen: "Certificar contra una OC aprobada", permiso: "certificaciones:crear", body: CreateCertificacionSchema },
  { ruta: "/api/certificaciones/{id}", metodo: "get", tag: "Certificaciones", resumen: "Obtener una", permiso: "certificaciones:ver" },
  { ruta: "/api/certificaciones/{id}", metodo: "put", tag: "Certificaciones", resumen: "Editar la cabecera", permiso: "certificaciones:crear", body: UpdateCertificacionSchema },
  { ruta: "/api/certificaciones/{id}", metodo: "delete", tag: "Certificaciones", resumen: "Borrar", permiso: "certificaciones:borrar", sinCuerpo: true },
  { ruta: "/api/certificaciones/{id}/estado", metodo: "patch", tag: "Certificaciones", resumen: "Cambiar de estado", permiso: "certificaciones:aprobar", body: CambiarEstadoCertificacionSchema },
  { ruta: "/api/certificaciones/lineas-oc-disponibles", metodo: "get", tag: "Certificaciones", resumen: "Líneas de OC con avance pendiente", permiso: "certificaciones:crear" },

  // --- facturas
  { ruta: "/api/facturas", metodo: "get", tag: "Facturas", resumen: "Listado paginado", permiso: "facturas:ver", listado: true },
  { ruta: "/api/facturas", metodo: "post", tag: "Facturas", resumen: "Crear (líneas + imputaciones)", permiso: "facturas:crear", body: CreateFacturaSchema },
  { ruta: "/api/facturas/{id}", metodo: "get", tag: "Facturas", resumen: "Obtener una", permiso: "facturas:ver" },
  { ruta: "/api/facturas/{id}", metodo: "delete", tag: "Facturas", resumen: "Borrar", permiso: "facturas:borrar", sinCuerpo: true },
  { ruta: "/api/facturas/{id}/estado", metodo: "patch", tag: "Facturas", resumen: "Cambiar de estado", permiso: "facturas:aprobar", body: CambiarEstadoFacturaSchema },
  { ruta: "/api/facturas/{id}/imputaciones", metodo: "post", tag: "Facturas", resumen: "Imputar a certificaciones aprobadas", permiso: "facturas:crear", body: ImputarSchema },
  { ruta: "/api/facturas/{id}/imputaciones", metodo: "delete", tag: "Facturas", resumen: "Desimputar", permiso: "facturas:crear", sinCuerpo: true },
  { ruta: "/api/facturas/{id}/comprobante", metodo: "get", tag: "Facturas", resumen: "URL firmada del PDF (5 minutos)", permiso: "facturas:ver",
    respuesta: z.object({ url: z.string().nullable() }) },
  { ruta: "/api/facturas/{id}/comprobante", metodo: "post", tag: "Facturas", resumen: "Adjuntar el PDF del comprobante", permiso: "facturas:crear" },
  { ruta: "/api/facturas/certificaciones-aprobadas", metodo: "get", tag: "Facturas", resumen: "Certificaciones imputables", permiso: "facturas:crear" },

  // --- órdenes de pago
  { ruta: "/api/ordenes-pago", metodo: "get", tag: "Órdenes de pago", resumen: "Listado paginado", permiso: "ordenes_pago:ver", listado: true },
  { ruta: "/api/ordenes-pago", metodo: "post", tag: "Órdenes de pago", resumen: "Crear (vacía, en borrador)", permiso: "ordenes_pago:crear", body: CreateOrdenPagoSchema },
  { ruta: "/api/ordenes-pago/{id}", metodo: "get", tag: "Órdenes de pago", resumen: "Obtener una", permiso: "ordenes_pago:ver" },
  { ruta: "/api/ordenes-pago/{id}", metodo: "delete", tag: "Órdenes de pago", resumen: "Borrar", permiso: "ordenes_pago:borrar", sinCuerpo: true },
  { ruta: "/api/ordenes-pago/{id}/estado", metodo: "patch", tag: "Órdenes de pago", resumen: "Cambiar de estado", permiso: "ordenes_pago:aprobar", body: CambiarEstadoOPSchema },
  { ruta: "/api/ordenes-pago/{id}/facturas", metodo: "post", tag: "Órdenes de pago", resumen: "Agregar una factura a pagar", permiso: "ordenes_pago:crear", body: AgregarFacturaSchema },
  { ruta: "/api/ordenes-pago/{id}/facturas", metodo: "delete", tag: "Órdenes de pago", resumen: "Quitar una factura", permiso: "ordenes_pago:crear", sinCuerpo: true },
  { ruta: "/api/ordenes-pago/{id}/cajas", metodo: "post", tag: "Órdenes de pago", resumen: "Repartir el pago en una caja", permiso: "ordenes_pago:crear", body: AgregarCajaSchema },
  { ruta: "/api/ordenes-pago/{id}/cajas", metodo: "delete", tag: "Órdenes de pago", resumen: "Quitar una caja", permiso: "ordenes_pago:crear", sinCuerpo: true },

  // --- proveedores
  { ruta: "/api/proveedores", metodo: "get", tag: "Proveedores", resumen: "Listado paginado", permiso: "proveedores:ver", listado: true },
  { ruta: "/api/proveedores", metodo: "post", tag: "Proveedores", resumen: "Crear", permiso: "proveedores:crear", body: CreateProveedorSchema },
  { ruta: "/api/proveedores/{id}", metodo: "get", tag: "Proveedores", resumen: "Obtener uno", permiso: "proveedores:ver" },
  { ruta: "/api/proveedores/{id}", metodo: "put", tag: "Proveedores", resumen: "Editar", permiso: "proveedores:crear", body: UpdateProveedorSchema },
  { ruta: "/api/proveedores/{id}", metodo: "delete", tag: "Proveedores", resumen: "Borrar", permiso: "proveedores:aprobar", sinCuerpo: true },
  { ruta: "/api/proveedores/{id}/estado", metodo: "patch", tag: "Proveedores", resumen: "Activar o desactivar", permiso: "proveedores:aprobar", body: CambiarActivoSchema },

  // --- items
  { ruta: "/api/items", metodo: "get", tag: "Ítems", resumen: "Catálogo de ítems activos", permiso: "items:ver" },
  { ruta: "/api/items", metodo: "post", tag: "Ítems", resumen: "Crear", permiso: "items:crear", body: CreateItemSchema },
  { ruta: "/api/items/{id}", metodo: "get", tag: "Ítems", resumen: "Obtener uno", permiso: "items:ver" },
  { ruta: "/api/items/{id}", metodo: "put", tag: "Ítems", resumen: "Editar", permiso: "items:crear", body: UpdateItemSchema },
  { ruta: "/api/items/{id}", metodo: "delete", tag: "Ítems", resumen: "Soft delete (409 si está usado en una OC)", permiso: "items:crear", sinCuerpo: true },
  { ruta: "/api/items/{id}/estado", metodo: "patch", tag: "Ítems", resumen: "Activar o desactivar", permiso: "items:crear", body: CambiarActivoSchema },
  { ruta: "/api/items/{id}/precio", metodo: "get", tag: "Ítems", resumen: "Precio del ítem para un proveedor", permiso: "autenticado",
    respuesta: z.object({ precio: z.number() }) },
  { ruta: "/api/items/categorias", metodo: "get", tag: "Ítems", resumen: "Categorías en uso", permiso: "autenticado", respuesta: z.array(z.string()) },
  { ruta: "/api/items/search", metodo: "get", tag: "Ítems", resumen: "Buscar en el catálogo", permiso: "autenticado" },

  // --- proyectos y cajas
  { ruta: "/api/proyectos", metodo: "get", tag: "Proyectos", resumen: "Listado paginado", permiso: "proyectos:ver", listado: true },
  { ruta: "/api/proyectos", metodo: "post", tag: "Proyectos", resumen: "Crear", permiso: "proyectos:crear", body: CreateProyectoSchema },
  { ruta: "/api/proyectos/{id}", metodo: "get", tag: "Proyectos", resumen: "Obtener uno", permiso: "proyectos:ver" },
  { ruta: "/api/proyectos/{id}", metodo: "put", tag: "Proyectos", resumen: "Editar", permiso: "proyectos:crear", body: UpdateProyectoSchema },
  { ruta: "/api/cajas", metodo: "get", tag: "Cajas", resumen: "Cajas activas", permiso: "autenticado" },
  { ruta: "/api/cajas", metodo: "post", tag: "Cajas", resumen: "Crear", permiso: "autenticado", body: CreateCajaSchema },
  { ruta: "/api/cajas/{id}", metodo: "get", tag: "Cajas", resumen: "Obtener una", permiso: "autenticado" },
  { ruta: "/api/cajas/{id}", metodo: "put", tag: "Cajas", resumen: "Editar", permiso: "autenticado", body: UpdateCajaSchema },
  { ruta: "/api/cajas/{id}", metodo: "delete", tag: "Cajas", resumen: "Borrar", permiso: "autenticado", sinCuerpo: true },

  // --- reportes y dashboard
  { ruta: "/api/dashboard", metodo: "get", tag: "Reportes", resumen: "Resumen agregado del dashboard", permiso: "autenticado" },
  { ruta: "/api/reportes/{reporte}", metodo: "get", tag: "Reportes", resumen: "Generar un reporte", permiso: "reportes:ver" },
  { ruta: "/api/reportes/{reporte}/export", metodo: "get", tag: "Reportes", resumen: "Descargar el reporte (xlsx | csv)", permiso: "reportes:ver" },

  // --- administración
  { ruta: "/api/admin/auditoria", metodo: "get", tag: "Administración", resumen: "Bitácora y control de cambios", permiso: "admin" },
  { ruta: "/api/admin/roles", metodo: "get", tag: "Administración", resumen: "Roles con su matriz de permisos", permiso: "admin" },
  { ruta: "/api/admin/roles", metodo: "post", tag: "Administración", resumen: "Crear un rol", permiso: "admin",
    body: z.object({ nombre: z.string(), descripcion: z.string().nullish(), permisos: z.array(z.string()).optional() }) },
  { ruta: "/api/admin/roles/{id}", metodo: "put", tag: "Administración", resumen: "Editar un rol", permiso: "admin",
    body: z.object({ nombre: z.string().optional(), descripcion: z.string().nullish(), permisos: z.array(z.string()).optional() }) },
  { ruta: "/api/admin/roles/{id}", metodo: "delete", tag: "Administración", resumen: "Borrar un rol", permiso: "admin", sinCuerpo: true },
  { ruta: "/api/admin/users", metodo: "get", tag: "Administración", resumen: "Usuarios con su rol", permiso: "admin" },
  { ruta: "/api/admin/users", metodo: "post", tag: "Administración", resumen: "Alta de usuario", permiso: "admin",
    body: z.object({ nombre: z.string(), email: z.string().email(), password: z.string(), rol_id: z.number().int() }) },
  { ruta: "/api/admin/users/{id}", metodo: "put", tag: "Administración", resumen: "Editar un usuario", permiso: "admin",
    body: z.object({ nombre: z.string().optional(), email: z.string().email().optional(), estado: z.enum(["activo", "inactivo"]).optional(), rol_id: z.number().int().optional() }) },
  { ruta: "/api/admin/users/{id}", metodo: "delete", tag: "Administración", resumen: "Desactivar un usuario", permiso: "admin", sinCuerpo: true },
  { ruta: "/api/admin/users/{id}/role", metodo: "patch", tag: "Administración", resumen: "Cambiar el rol de un usuario", permiso: "admin",
    body: z.object({ rol: z.string() }) },
  { ruta: "/api/admin/users/{id}/reset-password", metodo: "post", tag: "Administración", resumen: "Resetear la contraseña", permiso: "admin",
    body: z.object({ newPassword: z.string() }) },
]

// ---------------------------------------------------------------- registro

const RESPUESTAS_ERROR = {
  400: { description: "Datos inválidos", content: { "application/json": { schema: ErrorSchema } } },
  401: { description: "No autenticado", content: { "application/json": { schema: ErrorSchema } } },
  403: { description: "Sin permiso", content: { "application/json": { schema: ErrorSchema } } },
  404: { description: "No encontrado", content: { "application/json": { schema: ErrorSchema } } },
  409: { description: "Conflicto", content: { "application/json": { schema: ErrorSchema } } },
  422: { description: "Regla de negocio", content: { "application/json": { schema: ErrorSchema } } },
}

function parametrosDeRuta(ruta: string) {
  return [...ruta.matchAll(/\{(\w+)\}/g)].map(([, nombre]) => ({
    name: nombre,
    in: "path" as const,
    required: true,
    schema: { type: "string" as const },
  }))
}

for (const op of OPERACIONES) {
  const parametros = [
    ...parametrosDeRuta(op.ruta),
    ...(op.listado
      ? PARAMS_LISTADO.map((p) => ({
          name: p.nombre,
          in: "query" as const,
          required: false,
          description: p.descripcion,
          schema: { type: p.tipo },
        }))
      : []),
  ]

  const exito = op.sinCuerpo
    ? { description: "Operación aplicada" }
    : {
        description: "OK",
        content: {
          "application/json": {
            schema: op.respuesta ?? (op.listado ? PaginadoSchema : FilaSchema),
          },
        },
      }

  registry.registerPath({
    method: op.metodo,
    path: op.ruta,
    tags: [op.tag],
    summary: op.resumen,
    // El permiso va en la descripción y no en `security`: la autorización es por par
    // modulo:accion contra la matriz del rol, que OpenAPI no sabe expresar.
    description: `Autorización: ${op.permiso}`,
    request: {
      ...(parametros.length ? { params: undefined } : {}),
      ...(op.body ? { body: { content: { "application/json": { schema: op.body } } } } : {}),
    },
    parameters: parametros,
    responses: { 200: exito, ...RESPUESTAS_ERROR },
  })
}

/** Las rutas descritas, para que el test de cobertura no tenga que leer el documento. */
export const RUTAS_DEL_CONTRATO = OPERACIONES.map((o) => `${o.metodo.toUpperCase()} ${o.ruta}`)

export function generarContrato() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Gestión Uno — API",
      version: "1.0.0",
      description:
        "Circuito de compras: OC → certificación → factura → orden de pago. " +
        "Todas las rutas van detrás de la cookie de sesión (el middleware las corta antes), " +
        "salvo /api/health y /api/auth/login. La autorización fina es por par modulo:accion " +
        "contra la matriz del rol.",
    },
    servers: [{ url: "/" }],
  })
}
