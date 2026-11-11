import { z } from "zod"

// Body de PATCH /<recurso>/[id]/estado. El estado del recurso es un SUB-RECURSO con su propia
// URI, en vez de un verbo por transición (/activar, /suspender, /reactivate): una sola ruta,
// un solo gate de permiso, y el cliente manda el estado al que quiere llegar.
//
// `activo` y no el enum de la DB: para proveedores e items el estado es binario
// (activo/inactivo) y el nombre de la columna no tiene por qué filtrarse a la API. Los
// documentos del circuito NO usan esto: tienen su propio grafo de estados y van por
// estadoRoute con el enum.
export const CambiarActivoSchema = z.object({
  activo: z.boolean({ required_error: "Indicá el estado al que querés llevar el recurso" }),
})

export type CambiarActivo = z.infer<typeof CambiarActivoSchema>
