"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Building2, Calendar, FileCheck, Check, X } from "lucide-react"
import { showErrorToast, showSuccessToast } from "@/shared/toast-helpers"
import { formatCurrency } from "@/shared/format-utils"
import { useAuth } from "@/components/auth-context"
import { StatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// View-model de GET /api/facturas/[id] (cabecera + joins de proveedor + imputaciones +
// líneas). Numéricos como string desde Postgres → Number() en el render.
type Num = number | string | null
interface FacturaImputacionDetalle {
  certificacion_id: number
  monto_asignado: Num
  gu_certificaciones: { numero_cert: string | null; total_con_iva: Num } | null
}
interface FacturaLineaDetalle {
  id: number | null
  descripcion: string | null
  cantidad: Num
  precio_unitario: Num
  total_con_iva: Num
  iva_porcentaje: Num
}
interface FacturaDetalle {
  numero_factura: string | null
  estado: string
  total_neto: Num
  total_iva: Num
  total_con_iva: Num
  proveedor_nombre: string | null
  proveedor_cuit: string | null
  proveedor_email: string | null
  proveedor_direccion: string | null
  fecha_emision: string | null
  imputaciones: FacturaImputacionDetalle[] | null
  lineas: FacturaLineaDetalle[] | null
}

interface Props {
  params: Promise<{ id: string }>
}

export function FacturaDetail({ params }: Props) {
  const { id } = use(params)
  const { puede } = useAuth()
  const [factura, setFactura] = useState<FacturaDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const router = useRouter()

  const fetchFactura = useCallback(async () => {
    try {
      const response = await fetch(`/api/facturas/${id}`)
      if (!response.ok) throw new Error("Error al cargar factura")
      const data = await response.json()
      setFactura(data)
    } catch (error) {
      showErrorToast("Error", "No se pudo cargar la factura")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchFactura()
  }, [fetchFactura])

  // FACT no tiene aprobación intermedia: borrador -> finalizado (habilita pagar) | anulado.
  // Finalizar exige >=1 imputación; un 422 trae ese mensaje o el del trigger de imputación.
  const cambiarEstado = async (nuevoEstado: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/facturas/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      const updated = await response.json()
      if (!response.ok) throw new Error(updated.error || "Error al actualizar factura")

      // El PATCH /estado devuelve solo la cabecera (sin lineas ni imputaciones).
      // Reconsultamos el detalle completo para no borrar esas secciones.
      await fetchFactura()
      showSuccessToast("Éxito", nuevoEstado === "finalizado" ? "Factura finalizada" : "Factura anulada")
    } catch (error) {
      showErrorToast(
        "No se pudo cambiar el estado",
        error instanceof Error ? error.message : "Error al actualizar factura"
      )
    } finally {
      setUpdating(false)
      setShowApproveDialog(false)
      setShowRejectDialog(false)
    }
  }


  if (loading) return <div className="text-center py-8">Cargando...</div>
  if (!factura) return <div className="text-center py-8">Factura no encontrada</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/facturas")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {factura.estado === "borrador" && (
          <div className="flex gap-2">
            {puede("facturas", "crear") && (
              <Button
                onClick={() => setShowApproveDialog(true)}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            )}
            {puede("facturas", "aprobar") && (
              <Button onClick={() => setShowRejectDialog(true)} disabled={updating} variant="destructive">
                <X className="h-4 w-4 mr-2" />
                Anular
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl mb-2">
                {factura.numero_factura}
              </CardTitle>
              <StatusBadge estado={factura.estado} />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(Number(factura.total_con_iva ?? 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total con IVA</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Proveedor</div>
                  <div className="font-semibold">{factura.proveedor_nombre ?? "—"}</div>
                  {factura.proveedor_cuit && (
                    <Badge variant="outline" className="mt-1">
                      CUIT: {factura.proveedor_cuit}
                    </Badge>
                  )}
                  {factura.proveedor_email && (
                    <div className="text-sm text-muted-foreground mt-1">{factura.proveedor_email}</div>
                  )}
                  {factura.proveedor_direccion && (
                    <div className="text-sm text-muted-foreground">{factura.proveedor_direccion}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Fecha de emisión</div>
                  <div className="font-semibold">
                    {factura.fecha_emision
                      ? new Date(factura.fecha_emision).toLocaleDateString("es-AR")
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Resumen Financiero</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (Neto)</span>
                <span className="font-semibold">
                  {formatCurrency(Number(factura.total_neto ?? 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="font-semibold">
                  {formatCurrency(Number(factura.total_iva ?? 0))}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total con IVA</span>
                <span className="text-green-600">
                  {formatCurrency(Number(factura.total_con_iva ?? 0))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {factura.imputaciones && factura.imputaciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Certificaciones imputadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {factura.imputaciones.map((imp) => (
                <div
                  key={imp.certificacion_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => router.push(`/certificaciones/${imp.certificacion_id}`)}
                >
                  <div>
                    <div className="font-semibold">{imp.gu_certificaciones?.numero_cert}</div>
                    <div className="text-sm text-muted-foreground">
                      Certificado: {formatCurrency(Number(imp.gu_certificaciones?.total_con_iva ?? 0))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Imputado</div>
                    <div className="text-sm font-medium mt-1">
                      {formatCurrency(Number(imp.monto_asignado ?? 0))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Líneas de la Factura</CardTitle>
        </CardHeader>
        <CardContent>
          {!factura.lineas || factura.lineas.length === 0 ? (
            <p className="text-muted-foreground">No hay líneas registradas</p>
          ) : (
            <div className="space-y-4">
              {factura.lineas.map((linea, index) => (
                <div key={linea.id ?? index} className="border rounded-lg p-4 bg-muted">
                  <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">Descripción</div>
                      <div className="font-medium">{linea.descripcion}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cantidad</div>
                      <div className="font-medium">{linea.cantidad}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Precio Unitario</div>
                      <div className="font-medium">
                        {formatCurrency(Number(linea.precio_unitario ?? 0))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="font-bold text-green-600">
                        {formatCurrency(Number(linea.total_con_iva ?? 0))}
                      </div>
                      <div className="text-xs text-muted-foreground">IVA: {linea.iva_porcentaje}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar factura</AlertDialogTitle>
            <AlertDialogDescription>
              Al finalizar, la factura queda habilitada para pagarse. Requiere al menos una
              certificación imputada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cambiarEstado("finalizado")}
              className="bg-green-600 hover:bg-green-700"
            >
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular factura</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas anular esta factura? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cambiarEstado("anulado")}
              className="bg-red-600 hover:bg-red-700"
            >
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
