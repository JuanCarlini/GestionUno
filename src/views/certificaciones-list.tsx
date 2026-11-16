"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchBar } from "@/components/search-bar"
import { Eye, FileCheck } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { CrearButton } from "@/components/crear-button"
import { ListShell } from "@/components/list-shell"
import { SortControl, useSortRemoto, type SortField } from "@/components/sort-control"
import { Paginador } from "@/components/paginador"
import { useListado } from "@/hooks/use-listado"
import { LABEL_ESTADO } from "@/models"
import Link from "next/link"
import { formatCurrency } from "@/shared/format-utils"
import { showErrorToast } from "@/shared/toast-helpers"
import { StatusBadge } from "@/components/status-badge"

const SORT_FIELDS: SortField[] = [
  { key: "numero_cert", label: "Número de certificación" },
  { key: "fecha_cert", label: "Fecha" },
  { key: "total_con_iva", label: "Total" },
  // Ordena por la etiqueta visible, no por el valor crudo del enum.
  { key: "estado", label: "Estado", get: (i) => LABEL_ESTADO[i.estado as keyof typeof LABEL_ESTADO] ?? i.estado },
]

export function CertificacionesList() {
  const {
    items: certificaciones,
    total,
    page,
    paginas,
    limit,
    loading,
    refrescando,
    error,
    q,
    setQ,
    orden,
    setOrden,
    irA,
  } = useListado<any>("/api/certificaciones", { ordenInicial: "created_at.desc" })

  // La búsqueda y el orden los hace la base: con la lista paginada, filtrar en el cliente
  // filtraría solo dentro de la página visible.
  const sort = useSortRemoto(SORT_FIELDS, orden, setOrden)



  return (
    <ListShell loading={loading} error={error} loadingText="Cargando certificaciones...">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Certificaciones ({total})</CardTitle>
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Buscar por número, OC, proveedor..."
            className="w-full sm:w-80"
          />
        </div>
      </CardHeader>
      <CardContent>

        <div className="mb-4 flex justify-end">
          <SortControl {...sort} />
        </div>

        <div className="space-y-4">
          {certificaciones.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title={
                q
                  ? `No se encontraron certificaciones que coincidan con "${q}"`
                  : "No hay certificaciones registradas"
              }
            >
              {!q && (
                <CrearButton modulo="certificaciones" href="/certificaciones/nueva" label="Crear la primera certificación" />
              )}
            </EmptyState>
          ) : (
            certificaciones.map((cert: any) => (
              <div
                key={cert.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="font-medium text-foreground">{cert.numero_cert}</p>
                    <p className="text-sm text-muted-foreground">
                      {cert.fecha_cert
                        ? new Date(cert.fecha_cert).toLocaleDateString("es-AR")
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-foreground">
                      {cert.proveedor_nombre || "Sin proveedor"}
                    </p>
                    <p className="text-sm text-muted-foreground">{cert.numero_oc || "Sin OC"}</p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground tabular-nums">
                      {formatCurrency(cert.total_con_iva ?? 0, cert.moneda ?? "ARS")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge estado={cert.estado} showIcon />
                      {cert.estado_facturacion && (
                        <Badge variant="outline" className="font-normal">
                          Fact.: {cert.estado_facturacion}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/certificaciones/${cert.id}`} aria-label="Ver certificación">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <Paginador
            page={page}
            paginas={paginas}
            total={total}
            limit={limit}
            refrescando={refrescando}
            onIrA={irA}
          />
        </div>
      </CardContent>
    </Card>
    </ListShell>
  )
}
