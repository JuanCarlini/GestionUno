"use client"

import type { Proyecto } from "@/models/proyecto.model"
import { useListado } from "./use-listado"

export function useProyectos() {
  const listado = useListado<Proyecto>("/api/proyectos", { ordenInicial: "created_at.desc" })
  return { ...listado, proyectos: listado.items, refreshProyectos: listado.recargar }
}
