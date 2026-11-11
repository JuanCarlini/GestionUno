"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/search-bar"
import { Eye, Receipt } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { CrearButton } from "@/components/crear-button"
import Link from "next/link"
import { ListShell } from "@/components/list-shell"
import { SortControl, useSortRemoto, type SortField } from "@/components/sort-control"
import { Paginador } from "@/components/paginador"
import { useListado } from "@/hooks/use-listado"
import { LABEL_ESTADO } from "@/models"
import { formatCurrency } from "@/shared/format-utils"
import { showErrorToast } from "@/shared/toast-helpers"
import { StatusBadge } from "@/components/status-badge"

const SORT_FIELDS: SortField[] = [
  { key: "numero_factura", label: "Número de factura" },
  { key: "fecha_emision", label: "Fecha de emisión" },
  { key: "total_con_iva", label: "Total" },
  // Ordena por la etiqueta visible, no por el valor crudo del enum.
  { key: "estado", label: "Estado", get: (i) => LABEL_ESTADO[i.estado as keyof typeof LABEL_ESTADO] ?? i.estado },
]

export function FacturasList() {
  const {
    items: facturas,
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
  } = useListado<any>("/api/facturas", { ordenInicial: "created_at.desc" })

  // La busqueda y el orden los hace la base: con la lista paginada, filtrar en el cliente
  // filtraria solo dentro de la pagina visible.
  const sort = useSortRemoto(SORT_FIELDS, orden, setOrden)



  return (
    <ListShell loading={loading} error={error} loadingText="Cargando facturas...">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Facturas ({total})</CardTitle>
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Buscar por número, proveedor, estado..."
            className="w-full sm:w-80"
          />
        </div>
      </CardHeader>
      <CardContent>

        <div className="mb-4 flex justify-end">
          <SortControl {...sort} />
        </div>

        <div className="space-y-4">
          {facturas.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={
                q
                  ? `No se encontraron facturas que coincidan con "${q}"`
                  : "No hay facturas registradas"
              }
            >
              {!q && (
                <CrearButton modulo="facturas" href="/facturas/nueva" label="Crear la primera factura" />
              )}
            </EmptyState>
          ) : (
            facturas.map((factura: any) => (
              <div
                key={factura.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="font-medium text-foreground">{factura.numero_factura}</p>
                    <p className="text-sm text-muted-foreground">
                      {factura.fecha_emision
                        ? new Date(factura.fecha_emision).toLocaleDateString("es-AR")
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-foreground">
                      {factura.proveedor_nombre || "Sin proveedor"}
                    </p>
                    {factura.proveedor_cuit && (
                      <p className="text-sm text-muted-foreground">CUIT: {factura.proveedor_cuit}</p>
                    )}
                  </div>

                  <div>
                    <p className="font-medium text-foreground tabular-nums">
                      {formatCurrency(factura.total_con_iva ?? 0, factura.moneda ?? "ARS")}
                    </p>
                    <StatusBadge estado={factura.estado} showIcon />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/facturas/${factura.id}`} aria-label="Ver factura">
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
