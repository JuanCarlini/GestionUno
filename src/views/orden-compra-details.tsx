"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { formatCurrency } from "@/shared/format-utils"
import { formatDateShort } from "@/shared/date-utils"
import { StatusBadge } from "@/components/status-badge"

// View-models de esta vista (cabecera de OC + líneas + proveedor). Numéricos como string
// desde Postgres → Number() en el render.
type Num = number | string | null
interface OcLineaDetalle {
  id: number
  descripcion: string | null
  item_codigo: string | null
  cantidad: Num
  precio_unitario_neto: Num
  total_neto: Num
}
interface OrdenCompraDetalle {
  id: number
  numero_oc: string | null
  estado: string
  fecha_oc: string | null
  proveedor_id: number | null
  moneda: string | null
  observaciones: string | null
  total_neto: Num
  total_iva: Num
  total_con_iva: Num
}

interface Props {
  ordenId: string
}

export function OrdenCompraDetails({ ordenId }: Props) {
  const [orden, setOrden] = useState<OrdenCompraDetalle | null>(null)
  const [lineas, setLineas] = useState<OcLineaDetalle[]>([])
  const [proveedor, setProveedor] = useState<{ nombre: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // 1) cabecera
        const ocRes = await fetch(`/api/ordenes-compra/${ordenId}`)
        if (!ocRes.ok) {
          setError("Orden no encontrada")
          setOrden(null)
          setLineas([])
          return
        }
        const oc = await ocRes.json()
        setOrden(oc)

        // 2) proveedor
        if (oc.proveedor_id) {
          const provRes = await fetch(`/api/proveedores/${oc.proveedor_id}`)
          setProveedor(provRes.ok ? await provRes.json() : null)
        } else {
          setProveedor(null)
        }

        // 3) líneas
        const lineasRes = await fetch(`/api/ordenes-compra/${ordenId}/lineas`)
        setLineas(lineasRes.ok ? await lineasRes.json() : [])
      } catch (err) {
        console.error("Error cargando orden:", err)
        setError("Error al cargar la orden")
        setOrden(null)
        setLineas([])
      } finally {
        setLoading(false)
      }
    }

    if (ordenId) {
      fetchData()
    }
  }, [ordenId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando detalles de la orden...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !orden) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            {error || "Orden no encontrada"}
          </h3>
          <p className="text-muted-foreground mb-4">
            No se pudo cargar la información de esta orden.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            Volver
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6 pb-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Orden de Compra {orden.numero_oc ?? `#${orden.id}`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Fecha: {orden.fecha_oc ? formatDateShort(orden.fecha_oc) : "—"}
            </p>
          </div>
          <StatusBadge estado={orden.estado} showIcon />
        </div>

        {/* 2 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {/* info general */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Información General
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Proveedor:</p>
                <p className="text-base text-foreground">
                  {proveedor?.nombre ??
                    (orden.proveedor_id
                      ? `Proveedor #${orden.proveedor_id}`
                      : "—")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moneda:</p>
                <p className="text-base text-foreground">
                  {orden.moneda ?? "ARS"}
                </p>
              </div>
              {orden.observaciones && (
                <div>
                  <p className="text-sm text-muted-foreground">Observaciones:</p>
                  <p className="text-base text-foreground whitespace-pre-wrap break-words">
                    {orden.observaciones}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* totales */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Totales
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subtotal:</span>
                <span className="text-base text-foreground">
                  {formatCurrency(Number(orden.total_neto ?? 0), orden.moneda ?? "ARS")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Impuestos:</span>
                <span className="text-base text-foreground">
                  {formatCurrency(Number(orden.total_iva ?? 0), orden.moneda ?? "ARS")}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-lg font-bold text-foreground">Total:</span>
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(Number(orden.total_con_iva ?? 0), orden.moneda ?? "ARS")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* líneas */}
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Items de la Orden ({lineas.length})
          </h3>

          {lineas.length === 0 ? (
            <p className="text-muted-foreground">Esta orden no tiene líneas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Cantidad
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      P. Unitario
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lineas.map((linea) => (
                    <tr key={linea.id} className="hover:bg-accent">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {linea.descripcion}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {linea.item_codigo ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground tabular-nums whitespace-nowrap">
                        {Number(linea.cantidad ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground tabular-nums whitespace-nowrap">
                        {formatCurrency(Number(linea.precio_unitario_neto ?? 0), orden.moneda ?? "ARS")}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground tabular-nums whitespace-nowrap">
                        {formatCurrency(Number(linea.total_neto ?? 0), orden.moneda ?? "ARS")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
