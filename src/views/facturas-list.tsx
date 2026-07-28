"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/ui/search-bar"
import { SearchStats } from "@/components/ui/search-stats"
import { Eye } from "lucide-react"
import Link from "next/link"
import { ListShell } from "@/components/ui/list-shell"
import { searchWithScore } from "@/shared/search-utils"
import { formatCurrency } from "@/shared/format-utils"
import { showErrorToast } from "@/shared/toast-helpers"
import { StatusBadge } from "@/components/status-badge"

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

  const filteredFacturas = searchWithScore(
    facturas,
    searchTerm,
    ["numero_factura", "proveedor_nombre", "estado"],
    { numero_factura: 3, proveedor_nombre: 2, estado: 2 }
  )

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando facturas...">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Facturas ({filteredFacturas.length})</CardTitle>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por número, proveedor, estado..."
            className="w-80"
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

        <div className="space-y-4">
          {filteredFacturas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm
                  ? `No se encontraron facturas que coincidan con "${searchTerm}"`
                  : "No hay facturas registradas"}
              </p>
            </div>
          ) : (
            filteredFacturas.map((factura: any) => (
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
                    <p className="font-medium text-foreground">
                      {formatCurrency(factura.total_con_iva ?? 0)}
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
