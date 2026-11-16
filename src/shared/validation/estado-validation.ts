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
  // Devolver undefined para el resto de los casos deja el mensaje por defecto de zod, que es
  // lo que pasaba antes con required_error: solo pisaba el mensaje de campo faltante.
  activo: z.boolean({
    error: (issue) =>
      issue.input === undefined ? "Indicá el estado al que querés llevar el recurso" : undefined,
  }),
})

export type CambiarActivo = z.infer<typeof CambiarActivoSchema>
