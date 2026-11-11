"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchBar } from "@/components/search-bar"
import { ListShell } from "@/components/list-shell"
import { SortControl, useSortRemoto, type SortField } from "@/components/sort-control"
import { Paginador } from "@/components/paginador"
import { Edit, FolderKanban } from "lucide-react"
import { useProyectos } from "@/hooks/use-proyectos"
import { useAuth } from "@/components/auth-context"
import { formatDateShort } from "@/shared/date-utils"
import { getStatusStyle } from "@/components/status-colors"
import { EmptyState } from "@/components/empty-state"
import { CrearButton } from "@/components/crear-button"
import { LABEL_PROYECTO_ESTADO } from "@/shared/validation/proyecto-validation"
import type { EstadoProyecto } from "@/models/proyecto.model"

const SORT_FIELDS: SortField[] = [
  { key: "nombre", label: "Nombre" },
  { key: "codigo", label: "Código" },
  { key: "fecha_inicio", label: "Fecha de inicio" },
  // Ordena por la etiqueta visible, no por el valor crudo del enum.
  { key: "estado", label: "Estado", get: (p) => LABEL_PROYECTO_ESTADO[p.estado as EstadoProyecto] ?? p.estado },
]

export function ProyectoList() {
  const {
    proyectos,
    loading,
    error,
    total,
    page,
    paginas,
    limit,
    refrescando,
    q,
    setQ,
    orden,
    setOrden,
    irA,
  } = useProyectos()
  const { puede } = useAuth()

  // La búsqueda y el orden los hace la base: con la lista paginada, filtrar en el cliente
  // filtraría solo dentro de la página visible. De paso se va el useMemo, que estaba para no
  // re-puntuar la lista completa en cada render.
  const sort = useSortRemoto(SORT_FIELDS, orden, setOrden)

  const canEdit = puede("proyectos", "crear")

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando proyectos...">
      <div className="space-y-4">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Buscar por nombre, código o descripción..."
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? "proyecto" : "proyectos"}
          </p>
          <SortControl {...sort} />
        </div>

        {proyectos.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={FolderKanban}
                title={
                  proyectos.length === 0
                    ? "Todavía no hay proyectos cargados."
                    : "Ningún proyecto coincide con la búsqueda."
                }
              >
                {proyectos.length === 0 && (
                  <CrearButton modulo="proyectos" href="/proyectos/nuevo" label="Crear el primer proyecto" />
                )}
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {proyectos.map((proyecto) => (
              <Card key={proyecto.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg break-words">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      {proyecto.nombre}
                    </CardTitle>
                    {proyecto.codigo && (
                      <p className="text-sm text-muted-foreground">{proyecto.codigo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {proyecto.estado && (
                      <Badge className={getStatusStyle(proyecto.estado).color}>
                        {LABEL_PROYECTO_ESTADO[proyecto.estado]}
                      </Badge>
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/proyectos/${proyecto.id}/editar`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {proyecto.descripcion && (
                    <p className="text-sm text-muted-foreground">{proyecto.descripcion}</p>
                  )}
                  {(proyecto.fecha_inicio || proyecto.fecha_fin) && (
                    <p className="text-sm text-muted-foreground">
                      {proyecto.fecha_inicio ? formatDateShort(proyecto.fecha_inicio) : "Sin inicio"}
                      {" — "}
                      {proyecto.fecha_fin ? formatDateShort(proyecto.fecha_fin) : "Sin cierre"}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      <Paginador
        page={page}
        paginas={paginas}
        total={total}
        limit={limit}
        refrescando={refrescando}
        onIrA={irA}
      />
      </div>
    </ListShell>
  )
}
