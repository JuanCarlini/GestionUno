"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/ui/search-bar"
import { Eye, CheckCircle, XCircle, DollarSign } from "lucide-react"
import { ListShell } from "@/components/ui/list-shell"
import Link from "next/link"
import { useState } from "react"
import { useOrdensPago } from "@/hooks/use-ordenes-pago"
import { formatCurrency } from "@/shared/format-utils"
import { formatDateShort } from "@/shared/date-utils"
import { searchWithScore } from "@/shared/search-utils"
import { SearchStats } from "@/components/ui/search-stats"
import { StatusBadge } from "@/components/status-badge"
import { useAuth } from "@/components/auth-context"
import { canAnularDocumento, stringToUserRole } from "@/shared/permissions"

export function OrdenPagoList() {
  const { orders, loading, error, cambiarEstado, aprobarOrder, pagarOrder, rechazarOrder } = useOrdensPago()
  const { user } = useAuth()
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const userRole = user ? stringToUserRole(user.rol) : null
  const canModify = userRole ? canAnularDocumento(userRole) : false

  const filteredOrders = searchWithScore(
    orders,
    searchTerm,
    ['numero_op', 'proveedor_nombre', 'estado'],
    {
      numero_op: 3,         // Mayor peso para número de orden
      proveedor_nombre: 2,  // Peso medio para proveedor
      estado: 2             // Peso medio para estado
    }
  )

  const handleAprobar = async (id: number) => {
    try {
      setProcessingId(id)
      await aprobarOrder(id)
    } catch (error) {
      console.error("Error al aprobar orden:", error)
    } finally {
      setProcessingId(null)
    }
  }

  // borrador -> "mandar a aprobar" (aplica fn_op_gate: Σcajas=Σfacturas=total); el resto
  // son transiciones directas. Un 422 trae el mensaje del gate en el toast del hook.
  const handleMandarAAprobar = async (id: number) => {
    try {
      setProcessingId(id)
      await cambiarEstado(id, "en_aprobacion")
    } catch (error) {
      console.error("Error al mandar a aprobar:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handlePagar = async (id: number) => {
    try {
      setProcessingId(id)
      await pagarOrder(id)
    } catch (error) {
      console.error("Error al registrar pago:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRechazar = async (id: number) => {
    try {
      setProcessingId(id)
      await rechazarOrder(id)
    } catch (error) {
      console.error("Error al rechazar orden:", error)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando órdenes de pago...">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Lista de Órdenes de Pago ({filteredOrders.length})</CardTitle>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por número, proveedor, método..."
            className="w-80"
          />
        </div>
      </CardHeader>
      <CardContent>
        <SearchStats
          totalItems={orders.length}
          filteredItems={filteredOrders.length}
          searchTerm={searchTerm}
          entityName="orden de pago"
        />

        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm 
                  ? `No se encontraron órdenes que coincidan con "${searchTerm}"`
                  : "No hay órdenes de pago registradas"
                }
              </p>
            </div>
          ) : (
            filteredOrders.map((orden) => (
              <div 
                key={orden.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <p className="font-medium text-foreground">Orden #{orden.numero_op}</p>
                    <p className="text-sm text-muted-foreground">{formatDateShort(orden.fecha_op)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{orden.proveedor_nombre}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{formatCurrency(orden.total_a_pagar)}</p>
                  </div>
                  <div>
                    <StatusBadge estado={orden.estado} showIcon />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/ordenes-pago/${orden.id}`} aria-label="Ver orden de pago">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    {canModify && orden.estado === "borrador" && (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Mandar a aprobar"
                        aria-label="Mandar a aprobar"
                        onClick={() => handleMandarAAprobar(orden.id)}
                        disabled={processingId === orden.id}
                      >
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      </Button>
                    )}

                    {canModify && orden.estado === "en_aprobacion" && (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Aprobar"
                        aria-label="Aprobar orden de pago"
                        onClick={() => handleAprobar(orden.id)}
                        disabled={processingId === orden.id}
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}

                    {canModify && orden.estado === "aprobado" && (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Registrar pago"
                        aria-label="Registrar pago"
                        onClick={() => handlePagar(orden.id)}
                        disabled={processingId === orden.id}
                      >
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </Button>
                    )}

                    {canModify && (orden.estado === "en_aprobacion" || orden.estado === "aprobado") && (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Rechazar"
                        aria-label="Rechazar orden de pago"
                        onClick={() => handleRechazar(orden.id)}
                        disabled={processingId === orden.id}
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
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
