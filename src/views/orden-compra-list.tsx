"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/ui/search-bar"
import { Eye, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { ListShell } from "@/components/ui/list-shell"
import Link from "next/link"
import { useOrders } from "@/hooks/use-orders"
import { formatCurrency } from "@/shared/format-utils"
import { SearchStats } from "@/components/ui/search-stats"
import { searchWithScore } from "@/shared/search-utils"
import { showErrorToast } from "@/shared/toast-helpers"
import { StatusBadge } from "@/components/status-badge"
import { useAuth } from "@/components/auth-context"
import { canAnularDocumento, stringToUserRole } from "@/shared/permissions"

export function OrdenCompraList() {
  const { orders, loading, error, cambiarEstadoOrden } = useOrders()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const userRole = user ? stringToUserRole(user.rol) : null
  const canAnular = userRole ? canAnularDocumento(userRole) : false

  const filteredOrders = searchWithScore(
    orders,
    searchTerm,
    ["numero_oc", "estado", "observaciones"],
    {
      numero_oc: 3,
      estado: 2,
      observaciones: 1,
    }
  )

  // El circuito no saltea etapas: de borrador se manda a aprobar, y recién de
  // en_aprobacion se aprueba. Ir directo a 'aprobado' devuelve 409.
  const handleTransicion = async (id: number | string, estado: string) => {
    try {
      setUpdatingId(Number(id))
      await cambiarEstadoOrden(id, estado)
    } catch (error) {
      console.error(`Error al pasar la orden a ${estado}:`, error)
      showErrorToast(
        "No se pudo cambiar el estado",
        error instanceof Error ? error.message : "Error desconocido"
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando órdenes...">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Órdenes de Compra ({filteredOrders.length})</CardTitle>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por número, estado u observación..."
            className="w-80"
          />
        </div>
      </CardHeader>
      <CardContent>
        <SearchStats
          totalItems={orders.length}
          filteredItems={filteredOrders.length}
          searchTerm={searchTerm}
          entityName="orden"
        />

        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm
                  ? `No se encontraron órdenes que coincidan con "${searchTerm}"`
                  : "No hay órdenes de compra registradas"}
              </p>
            </div>
          ) : (
            filteredOrders.map((orden: any) => (
              <div
                key={orden.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* columna 1: número y fecha */}
                  <div>
                    <p className="font-medium text-foreground">
                      {orden.numero_oc ? `OC #${orden.numero_oc}` : `OC ID ${orden.id}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {/* en la tabla la fecha es fecha_oc (date), no fecha_creacion */}
                      {orden.fecha_oc
                        ? new Date(orden.fecha_oc).toLocaleDateString("es-AR")
                        : ""}
                    </p>
                  </div>

                  {/* columna 2: proveedor (solo tenemos id) */}
                  <div>
                    <p className="text-sm text-foreground">
                      {orden.proveedor_nombre ||
                        (orden.proveedor_id ? `Proveedor #${orden.proveedor_id}` : "Sin proveedor")}
                    </p>
                    {orden.observaciones && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {orden.observaciones}
                      </p>
                    )}
                  </div>

                  {/* columna 3: totales y estado */}
                  <div>
                    <p className="font-medium text-foreground">
                      {formatCurrency(orden.total_con_iva ?? orden.total_neto ?? 0)}
                    </p>
                    <StatusBadge estado={orden.estado} showIcon />
                  </div>

                  {/* columna 4: acciones */}
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/ordenes-compra/${orden.id}`} aria-label="Ver orden de compra">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    {/* borrador -> "mandar a aprobar"; en_aprobacion -> "aprobar". */}
                    {canAnular && (orden.estado === "borrador" || orden.estado === "en_aprobacion") && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          title={orden.estado === "borrador" ? "Mandar a aprobar" : "Aprobar"}
                          aria-label={orden.estado === "borrador" ? "Mandar a aprobar" : "Aprobar orden de compra"}
                          onClick={() =>
                            handleTransicion(orden.id, orden.estado === "borrador" ? "en_aprobacion" : "aprobado")
                          }
                          disabled={updatingId === orden.id}
                        >
                          {updatingId === orden.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Anular"
                          aria-label="Anular orden de compra"
                          onClick={() => handleTransicion(orden.id, "anulado")}
                          disabled={updatingId === orden.id}
                        >
                          {updatingId === orden.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
                      </>
                    )}
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
