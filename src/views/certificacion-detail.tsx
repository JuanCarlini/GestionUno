"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, FileText, Calendar, Building2, User, Check, X } from "lucide-react"
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

// View-model de GET /api/certificaciones/[id]. Los numéricos llegan como string desde Postgres
// → se coercionan con Number() en el render; el tipo captura los nombres de campo.
type Num = number | string | null
interface CertLineaDetalle {
  id: number
  numero_lce: string | null
  linea_oc_id: number | null
  avance_unidades: Num
  avance_monto: Num
  iva_porcentaje: Num
  gu_lineasdeordenesdecompra: {
    descripcion: string | null
    numero_loc: string | null
    precio_unitario_neto: Num
  } | null
}
interface CertDetalle {
  id: number
  numero_cert: string | null
  estado: string
  total_neto: Num
  total_con_iva: Num
  fecha_cert: string | null
  observaciones: string | null
  numero_oc: string | null
  moneda: string | null
  proveedor_nombre: string | null
  proveedor_cuit: string | null
  estado_facturacion: string | null
  lineas: CertLineaDetalle[] | null
}

interface Props {
  params: Promise<{ id: string }>
}

export function CertificacionDetail({ params }: Props) {
  const { id } = use(params)
  const { puede } = useAuth()
  const [cert, setCert] = useState<CertDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const router = useRouter()

  const fetchCertificacion = useCallback(async () => {
    try {
      const response = await fetch(`/api/certificaciones/${id}`)
      if (!response.ok) throw new Error("Error al cargar certificación")
      const data = await response.json()
      setCert(data)
    } catch (error) {
      showErrorToast("Error", "No se pudo cargar la certificación")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCertificacion()
  }, [fetchCertificacion])

  // Las transiciones tienen ruta propia: el PUT solo edita la cabecera. Un 422 trae el mensaje
  // del trigger (regla del 100%, OC no aprobada); un 409, una transición imposible.
  const cambiarEstado = async (nuevoEstado: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/certificaciones/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Error al actualizar estado")

      // El PATCH /estado devuelve solo la cabecera (sin lineas ni joins). Reconsultamos
      // el detalle completo para no borrar las líneas ni los datos derivados de la vista.
      await fetchCertificacion()

      const mensajes: Record<string, string> = {
        en_aprobacion: "Certificación enviada a aprobación",
        aprobado: "Certificación aprobada correctamente",
        rechazado: "Certificación rechazada",
        anulado: "Certificación anulada",
      }

      showSuccessToast("Éxito", mensajes[nuevoEstado] || "Estado actualizado")
      setShowApproveDialog(false)
      setShowRejectDialog(false)
    } catch (error) {
      showErrorToast(
        "No se pudo cambiar el estado",
        error instanceof Error ? error.message : "Error desconocido"
      )
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>
  if (!cert) return <div className="text-center py-8">Certificación no encontrada</div>

  // El circuito no saltea etapas: de borrador se manda a aprobar; recién de en_aprobacion
  // se aprueba. Ir de borrador directo a aprobado devuelve 409.
  const esBorrador = cert.estado === "borrador"
  const puedeMandarAAprobar = esBorrador
  const puedeAprobar = cert.estado === "en_aprobacion"
  const puedeRechazar = cert.estado === "en_aprobacion"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/certificaciones")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <div className="flex flex-wrap gap-2">
          {puedeMandarAAprobar && puede("certificaciones", "crear") && (
            <Button onClick={() => cambiarEstado("en_aprobacion")} disabled={updating}>
              <Check className="h-4 w-4 mr-2" />
              Mandar a aprobar
            </Button>
          )}

          {puede("certificaciones", "aprobar") && puedeAprobar && (
            <Button
              onClick={() => setShowApproveDialog(true)}
              disabled={updating}
              variant="success"
            >
              <Check className="h-4 w-4 mr-2" />
              Aprobar
            </Button>
          )}

          {puede("certificaciones", "aprobar") && puedeRechazar && (
            <Button
              onClick={() => setShowRejectDialog(true)}
              disabled={updating}
              variant="destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl md:text-3xl mb-2">
                {cert.numero_cert ?? `CERT-${cert.id}`}
              </CardTitle>
              <StatusBadge estado={cert.estado} />
            </div>
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(Number(cert.total_con_iva ?? 0), cert.moneda ?? "ARS")}
              </div>
              <div className="text-sm text-muted-foreground">Total con IVA</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  {/* La CE ya no cuelga de un proyecto: cuelga de UNA orden de compra. */}
                  <div className="text-sm text-muted-foreground">Orden de compra</div>
                  <div className="font-semibold">{cert.numero_oc ?? "—"}</div>
                  {cert.estado_facturacion && (
                    <Badge variant="outline" className="mt-1">
                      Facturación: {cert.estado_facturacion}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Proveedor</div>
                  <div className="font-semibold">{cert.proveedor_nombre ?? "—"}</div>
                  {cert.proveedor_cuit && (
                    <div className="text-sm text-muted-foreground">
                      CUIT: {cert.proveedor_cuit}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Fecha de Certificación</div>
                  <div className="font-semibold">
                    {cert.fecha_cert
                      ? new Date(cert.fecha_cert).toLocaleDateString("es-AR")
                      : "—"}
                  </div>
                </div>
              </div>

              {cert.observaciones && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">Observaciones</div>
                    <div className="text-sm">{cert.observaciones}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas de Certificación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cert.lineas?.map((linea) => {
              // La LCE deriva del avance por unidades; el precio/desc vienen
              // de la línea de OC. avance_monto es NETO → total con IVA = neto * (1 + iva%).
              const ocLinea = linea.gu_lineasdeordenesdecompra
              const iva = Number(linea.iva_porcentaje ?? 0)
              const totalConIva = Number(linea.avance_monto ?? 0) * (1 + iva / 100)
              return (
                <div key={linea.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
                    <div className="col-span-2 md:col-span-5">
                      <div className="font-semibold">{ocLinea?.descripcion ?? linea.numero_lce}</div>
                      {linea.linea_oc_id && ocLinea?.numero_loc ? (
                        <div className="text-xs text-muted-foreground mt-1">Línea {ocLinea.numero_loc}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground mt-1">Línea libre (sin OC)</div>
                      )}
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <div className="text-sm text-muted-foreground">Cantidad</div>
                      <div className="tabular-nums">{Number(linea.avance_unidades ?? 0)}</div>
                    </div>
                    <div className="text-right md:col-span-2">
                      <div className="text-sm text-muted-foreground">Precio Unit.</div>
                      <div className="tabular-nums">{formatCurrency(Number(ocLinea?.precio_unitario_neto ?? 0), cert.moneda ?? "ARS")}</div>
                    </div>
                    <div className="md:col-span-1 md:text-right">
                      <div className="text-sm text-muted-foreground">IVA</div>
                      <div className="tabular-nums">{iva}%</div>
                    </div>
                    <div className="text-right md:col-span-2">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="font-semibold tabular-nums">{formatCurrency(totalConIva, cert.moneda ?? "ARS")}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex flex-wrap justify-end gap-x-8 gap-y-3">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Neto</div>
                <div className="text-xl font-bold">
                  {formatCurrency(Number(cert.total_neto ?? 0), cert.moneda ?? "ARS")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total con IVA</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(Number(cert.total_con_iva ?? 0), cert.moneda ?? "ARS")}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Aprobación */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprobar Certificación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas aprobar la certificación {cert.numero_cert}?
              Esta acción permitirá que la certificación sea utilizada en facturas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cambiarEstado("aprobado")}
              disabled={updating}
              className={buttonVariants({ variant: "success" })}
            >
              {updating ? "Aprobando..." : "Aprobar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Rechazo */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Certificación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas rechazar la certificación {cert.numero_cert}?
              Esta acción cambiará el estado a rechazado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cambiarEstado("rechazado")}
              disabled={updating}
              className={buttonVariants({ variant: "destructive" })}
            >
              {updating ? "Rechazando..." : "Rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
