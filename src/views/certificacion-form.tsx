"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormRootError } from "@/components/form-root-error"
import { Loader2 } from "lucide-react"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"
import { formatCurrency } from "@/shared/format-utils"

// La certificación cuelga de UNA orden de compra aprobada (hereda proveedor y moneda, no se eligen).
// La única entrada por línea es el AVANCE EN UNIDADES; el tope del 100% lo aplica fn_check_avance_100.

interface OrdenCompraAprobada {
  id: number
  numero_oc: string
  estado: string
  estado_certificacion: "sin" | "parcial" | "total"
  moneda: string
  total_con_iva: number
}

interface LineaOCDisponible {
  id: number
  numero_loc: string
  descripcion: string
  unidad_medida: string | null
  cantidad: number
  precio_unitario_neto: number
  iva_porcentaje: number
  cantidad_certificada: number
  cantidad_disponible: number
  estado_certificacion: "sin" | "parcial" | "total"
}

const certFormSchema = z.object({
  orden_compra_id: z.string().min(1, "Elegí una orden de compra"),
  fecha_devengado: z.string(),
  observaciones: z.string(),
})
type CertFormData = z.infer<typeof certFormSchema>

export function CertificacionForm() {
  const router = useRouter()

  const form = useForm<CertFormData>({
    resolver: zodResolver(certFormSchema),
    defaultValues: {
      orden_compra_id: "",
      fecha_devengado: new Date().toISOString().slice(0, 10),
      observaciones: "",
    },
  })
  const isSubmitting = form.formState.isSubmitting
  const ordenCompraId = form.watch("orden_compra_id")

  const [ordenes, setOrdenes] = useState<OrdenCompraAprobada[]>([])
  const [lineasOC, setLineasOC] = useState<LineaOCDisponible[]>([])
  const [avances, setAvances] = useState<Record<number, string>>({})

  // Solo se puede certificar contra una OC aprobada (fn_cert_oc_aprobada lo garantiza) y que
  // NO esté 100% certificada: estado_certificacion "total" significa que ya no queda avance.
  useEffect(() => {
    fetch("/api/ordenes-compra")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OrdenCompraAprobada[]) =>
        setOrdenes(data.filter((o) => o.estado === "aprobado" && o.estado_certificacion !== "total"))
      )
      .catch(() => setOrdenes([]))
  }, [])

  useEffect(() => {
    if (!ordenCompraId) {
      setLineasOC([])
      setAvances({})
      return
    }
    fetch(`/api/certificaciones/lineas-oc-disponibles?ordenCompraId=${ordenCompraId}`)
      .then((r) => (r.ok ? r.json() : []))
      // No mostrar líneas ya 100% certificadas (sin avance disponible).
      .then((data: LineaOCDisponible[]) => setLineasOC(data.filter((l) => l.cantidad_disponible > 0)))
      .catch(() => setLineasOC([]))
    setAvances({})
  }, [ordenCompraId])

  const lineasCargadas = lineasOC
    .map((l) => ({ linea: l, avance: Number(avances[l.id] ?? 0) }))
    .filter(({ avance }) => avance > 0)

  const totalNeto = lineasCargadas.reduce((a, { linea, avance }) => a + avance * linea.precio_unitario_neto, 0)
  const totalConIva = lineasCargadas.reduce(
    (a, { linea, avance }) => a + avance * linea.precio_unitario_neto * (1 + linea.iva_porcentaje / 100),
    0
  )

  // Pre-validación: el tope real lo aplica el trigger y devuelve 422.
  const excedidas = lineasCargadas.filter(({ linea, avance }) => avance > linea.cantidad_disponible)

  const onSubmit = async (data: CertFormData) => {
    form.clearErrors("root")

    if (lineasCargadas.length === 0) {
      return form.setError("root", { message: "Cargá el avance de al menos una línea" })
    }
    if (excedidas.length > 0) {
      return form.setError("root", {
        message: `No se puede certificar más del disponible en: ${excedidas.map((x) => x.linea.numero_loc).join(", ")}`,
      })
    }

    try {
      const res = await fetch("/api/certificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden_compra_id: Number(data.orden_compra_id),
          fecha_devengado: data.fecha_devengado,
          observaciones: data.observaciones || null,
          lineas: lineasCargadas.map(({ linea, avance }) => ({
            linea_oc_id: linea.id,
            avance_unidades: avance,
          })),
        }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Error al crear la certificación")

      showSuccessToast("Certificación creada", body.numero_cert)
      router.push(`/certificaciones/${body.id}`)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido"
      form.setError("root", { message: mensaje })
      showErrorToast("No se pudo crear la certificación", mensaje)
    }
  }

  const ocElegida = ordenes.find((o) => String(o.id) === ordenCompraId)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormRootError />

        <Card>
          <CardHeader>
            <CardTitle>Nueva certificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="orden_compra_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden de compra (aprobada) *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar orden de compra" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ordenes.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.numero_oc} — {formatCurrency(o.total_con_iva, o.moneda)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ordenes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No hay órdenes de compra aprobadas con avance pendiente de certificar.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fecha_devengado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de devengado</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {lineasOC.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Avance por línea</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineasOC.map((linea) => {
                const avance = Number(avances[linea.id] ?? 0)
                const excede = avance > linea.cantidad_disponible
                return (
                  <div key={linea.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end border-b pb-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{linea.numero_loc}</p>
                      <p className="font-medium">{linea.descripcion}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(linea.precio_unitario_neto, ocElegida?.moneda)} / {linea.unidad_medida ?? "u"} · IVA{" "}
                        {linea.iva_porcentaje}%
                      </p>
                    </div>
                    <div className="text-sm">
                      <p>
                        Certificado: <strong>{linea.cantidad_certificada}</strong> de {linea.cantidad}
                      </p>
                      <p className={linea.cantidad_disponible <= 0 ? "text-muted-foreground" : ""}>
                        Disponible: <strong>{linea.cantidad_disponible}</strong>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`avance-${linea.id}`}>Avance (unidades)</Label>
                      <Input
                        id={`avance-${linea.id}`}
                        type="number"
                        min="0"
                        max={linea.cantidad_disponible}
                        step="0.01"
                        value={avances[linea.id] ?? ""}
                        onChange={(e) => setAvances((prev) => ({ ...prev, [linea.id]: e.target.value }))}
                        disabled={isSubmitting || linea.cantidad_disponible <= 0}
                        placeholder="0"
                      />
                      {excede && (
                        <p className="text-xs text-destructive">
                          Máximo {linea.cantidad_disponible} (el resto ya está certificado)
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}

              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 pt-2 text-sm">
                <span>
                  Neto: <strong>{formatCurrency(totalNeto, ocElegida?.moneda)}</strong>
                </span>
                <span>
                  Total: <strong>{formatCurrency(totalConIva, ocElegida?.moneda)}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || lineasCargadas.length === 0}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear certificación
          </Button>
        </div>
      </form>
    </Form>
  )
}
