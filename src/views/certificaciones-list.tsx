"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchBar } from "@/components/ui/search-bar"
import { SearchStats } from "@/components/ui/search-stats"
import { Eye } from "lucide-react"
import { ListShell } from "@/components/ui/list-shell"
import Link from "next/link"
import { searchWithScore } from "@/shared/search-utils"
import { formatCurrency } from "@/shared/format-utils"
import { showErrorToast } from "@/shared/toast-helpers"
import { StatusBadge } from "@/components/status-badge"

export function CertificacionesList() {
  const [certificaciones, setCertificaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchCertificaciones()
  }, [])

  const fetchCertificaciones = async () => {
    try {
      const response = await fetch('/api/certificaciones')
      if (!response.ok) throw new Error('Error al cargar certificaciones')
      const data = await response.json()
      setCertificaciones(data)
      setError(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudieron cargar las certificaciones"
      setError(msg)
      showErrorToast("Error", msg)
    } finally {
      setLoading(false)
    }
  }

  const filteredCertificaciones = searchWithScore(
    certificaciones,
    searchTerm,
    ["numero_cert", "numero_oc", "proveedor_nombre", "estado"],
    { numero_cert: 3, numero_oc: 2, proveedor_nombre: 2, estado: 2 }
  )

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando certificaciones...">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Certificaciones ({filteredCertificaciones.length})</CardTitle>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por número, OC, proveedor..."
            className="w-80"
          />
        </div>
      </CardHeader>
      <CardContent>
        <SearchStats
          totalItems={certificaciones.length}
          filteredItems={filteredCertificaciones.length}
          searchTerm={searchTerm}
          entityName="certificación"
        />

        <div className="space-y-4">
          {filteredCertificaciones.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm
                  ? `No se encontraron certificaciones que coincidan con "${searchTerm}"`
                  : "No hay certificaciones registradas"}
              </p>
            </div>
          ) : (
            filteredCertificaciones.map((cert: any) => (
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
                    <p className="font-medium text-foreground">
                      {formatCurrency(cert.total_con_iva ?? 0)}
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
      </CardContent>
    </Card>
    </ListShell>
  )
}
