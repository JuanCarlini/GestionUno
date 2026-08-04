"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/search-bar"
import { SearchStats } from "@/components/search-stats"
import { Eye, Receipt } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { CrearButton } from "@/components/crear-button"
import Link from "next/link"
import { ListShell } from "@/components/list-shell"
import { SortControl, useSort, type SortField } from "@/components/sort-control"
import { LABEL_ESTADO } from "@/models"
import { searchWithScore } from "@/shared/search-utils"
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
  const [facturas, setFacturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchFacturas()
  }, [])

  const fetchFacturas = async () => {
    try {
      const response = await fetch('/api/facturas')
      if (!response.ok) throw new Error('Error al cargar facturas')
      const data = await response.json()
      setFacturas(data)
      setError(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudieron cargar las facturas"
      setError(msg)
      showErrorToast("Error", msg)
    } finally {
      setLoading(false)
    }
  }

  const sort = useSort(SORT_FIELDS)


  const filteredFacturas = searchWithScore(
    facturas,
    searchTerm,
    ["numero_factura", "proveedor_nombre", "estado"],
    { numero_factura: 3, proveedor_nombre: 2, estado: 2 }
  )

  const sorted = sort.apply(filteredFacturas)

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando facturas...">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Facturas ({filteredFacturas.length})</CardTitle>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por número, proveedor, estado..."
            className="w-full sm:w-80"
          />
        </div>
      </CardHeader>
      <CardContent>
        <SearchStats
          totalItems={facturas.length}
          filteredItems={filteredFacturas.length}
          searchTerm={searchTerm}
          entityName="factura"
        />

        <div className="mb-4 flex justify-end">
          <SortControl {...sort} />
        </div>

        <div className="space-y-4">
          {filteredFacturas.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={
                searchTerm
                  ? `No se encontraron facturas que coincidan con "${searchTerm}"`
                  : "No hay facturas registradas"
              }
            >
              {!searchTerm && (
                <CrearButton modulo="facturas" href="/facturas/nueva" label="Crear la primera factura" />
              )}
            </EmptyState>
          ) : (
            sorted.map((factura: any) => (
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
      </CardContent>
    </Card>
    </ListShell>
  )
}
