"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { formatDateShort } from "@/shared/date-utils"
import { formatCurrency } from "@/shared/format-utils"
import { StatusBadge } from "@/components/status-badge"
import { useAuth } from "@/components/auth-context"
import { showErrorToast } from "@/shared/toast-helpers"
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  DollarSign,
  Building2,
  Calendar,
  Receipt,
  Wallet,
} from "lucide-react"

// La OP paga N facturas y reparte el total en N cajas de la misma moneda.
// Flujo: borrador -> en_aprobacion (aplica fn_op_gate: Σcajas=Σfacturas=total) -> aprobado -> pagado.

// View-model de GET /api/ordenes-pago/[id] (cabecera + líneas de factura + cajas). Los montos
// se pasan directo a formatCurrency (number).
interface OpFacturaDetalle {
  id: number
  factura_id: number
  monto: number
  gu_facturas: { numero_factura: string | null; moneda: string | null } | null
}
interface OpCajaDetalle {
  id: number
  caja_id: number
  monto: number
  gu_cajas: { nombre: string | null; tipo: string | null; moneda: string | null } | null
}
interface OrdenPagoDetalle {
  numero_op: string | null
  estado: string
  total_a_pagar: number
  moneda: string
  proveedor_nombre: string | null
  proveedor_id: number
  proveedor_cuit: string | null
  fecha_op: string | null
  observaciones: string | null
  facturas: OpFacturaDetalle[] | null
  cajas: OpCajaDetalle[] | null
}

export function OrdenPagoDetails() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { puede } = useAuth()
  const [orden, setOrden] = useState<OrdenPagoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  // Aprobar, rechazar y pagar son transiciones sin vuelta atrás: piden confirmación.
  const [confirmAction, setConfirmAction] = useState<"aprobado" | "rechazado" | "pagado" | null>(null)

  const fetchOrden = useCallback(async () => {
    try {
      const res = await fetch(`/api/ordenes-pago/${id}`)
      if (!res.ok) {
        setError("Orden no encontrada")
        setOrden(null)
      } else {
        setOrden(await res.json())
        setError(null)
      }
    } catch (e) {
      setError("Error al cargar la orden")
      setOrden(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchOrden()
  }, [fetchOrden, id])

  const cambiarEstado = async (nuevoEstado: string) => {
    if (!orden) return
    setProcessing(true)
    try {
      const res = await fetch(`/api/ordenes-pago/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al cambiar el estado")
      // El PATCH /estado devuelve solo la cabecera; reconsultamos facturas + cajas.
      await fetchOrden()
    } catch (error) {
      showErrorToast(
        "No se pudo cambiar el estado",
        error instanceof Error ? error.message : "Error desconocido"
      )
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando detalles de la orden de pago...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !orden) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error || "Orden no encontrada"}</p>
          <Button className="mt-4" onClick={() => router.push("/ordenes-pago")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </CardContent>
      </Card>
    )
  }

  const moneda = orden.moneda
  const facturas = orden.facturas ?? []
  const cajas = orden.cajas ?? []

  return (
    <div className="space-y-6">
      {/* Header: volver + acciones según estado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/ordenes-pago")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <div className="flex flex-wrap gap-2">
            {orden.estado === "borrador" && puede("ordenes_pago", "crear") && (
              <Button onClick={() => cambiarEstado("en_aprobacion")} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Mandar a aprobar
              </Button>
            )}
            {orden.estado === "en_aprobacion" && puede("ordenes_pago", "aprobar") && (
              <>
                <Button variant="success" onClick={() => setConfirmAction("aprobado")} disabled={processing}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprobar
                </Button>
                <Button variant="destructive" onClick={() => setConfirmAction("rechazado")} disabled={processing}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
              </>
            )}
            {orden.estado === "aprobado" && puede("ordenes_pago", "aprobar") && (
              <Button variant="success" onClick={() => setConfirmAction("pagado")} disabled={processing}>
                <DollarSign className="h-4 w-4 mr-2" />
                Confirmar pago
              </Button>
            )}
          </div>
      </div>

      {/* Cabecera */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl md:text-3xl mb-2">{orden.numero_op}</CardTitle>
              <StatusBadge estado={orden.estado} showIcon />
            </div>
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-bold tabular-nums">
                {formatCurrency(orden.total_a_pagar, moneda)}
              </div>
              <div className="text-sm text-muted-foreground">Total a pagar</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Proveedor</div>
                <div className="font-semibold">{orden.proveedor_nombre ?? `ID: ${orden.proveedor_id}`}</div>
                {orden.proveedor_cuit && (
                  <div className="text-sm text-muted-foreground">CUIT: {orden.proveedor_cuit}</div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Fecha de la orden</div>
                <div className="font-semibold">{orden.fecha_op ? formatDateShort(orden.fecha_op) : "—"}</div>
              </div>
            </div>
          </div>

          {orden.observaciones && (
            <div>
              <div className="text-sm text-muted-foreground">Observaciones</div>
              <div className="text-sm break-words">{orden.observaciones}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Facturas pagadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Facturas pagadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {facturas.length === 0 ? (
            <p className="text-muted-foreground">No hay facturas asociadas</p>
          ) : (
            <div className="space-y-2">
              {facturas.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-4 border rounded-lg">
                  <div className="font-semibold min-w-0 truncate">
                    {f.gu_facturas?.numero_factura ?? `Factura #${f.factura_id}`}
                  </div>
                  <div className="font-medium shrink-0 tabular-nums whitespace-nowrap">{formatCurrency(f.monto, f.gu_facturas?.moneda ?? moneda)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medios de pago (cajas) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Medios de pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cajas.length === 0 ? (
            <p className="text-muted-foreground">No hay cajas asociadas</p>
          ) : (
            <div className="space-y-2">
              {cajas.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4 border rounded-lg">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.gu_cajas?.nombre ?? `Caja #${c.caja_id}`}</div>
                    {c.gu_cajas?.tipo && (
                      <div className="text-xs text-muted-foreground capitalize">{c.gu_cajas.tipo}</div>
                    )}
                  </div>
                  <div className="font-medium shrink-0 tabular-nums whitespace-nowrap">{formatCurrency(c.monto, c.gu_cajas?.moneda ?? moneda)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "pagado" && "¿Confirmar el pago?"}
              {confirmAction === "aprobado" && "¿Aprobar la orden de pago?"}
              {confirmAction === "rechazado" && "¿Rechazar la orden de pago?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "pagado"
                ? `Vas a marcar como pagada la orden ${orden.numero_op ?? ""} por ${formatCurrency(orden.total_a_pagar, moneda)} a ${orden.proveedor_nombre ?? "el proveedor"}. Esta acción no se puede deshacer.`
                : confirmAction === "aprobado"
                  ? `Vas a aprobar la orden ${orden.numero_op ?? ""} por ${formatCurrency(orden.total_a_pagar, moneda)} a ${orden.proveedor_nombre ?? "el proveedor"}, dejándola lista para pagar.`
                  : `Vas a rechazar la orden ${orden.numero_op ?? ""}. El circuito de esta orden termina acá.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              className={buttonVariants({ variant: confirmAction === "rechazado" ? "destructive" : "success" })}
              onClick={() => {
                if (confirmAction) cambiarEstado(confirmAction)
                setConfirmAction(null)
              }}
            >
              {confirmAction === "pagado" ? "Confirmar pago" : confirmAction === "aprobado" ? "Aprobar" : "Rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
