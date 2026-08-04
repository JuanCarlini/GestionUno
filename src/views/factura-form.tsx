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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormRootError } from "@/components/form-root-error"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"
import { formatCurrency } from "@/shared/format-utils"

// La factura tiene líneas de detalle (LFACT) e imputa un MONTO a certificaciones aprobadas del
// proveedor (N:M). Regla dura (fn_check_imputacion): solo certs aprobadas y Σ monto_asignado ≤ total.

interface CertAprobada {
  id: number
  numero_cert: string
  moneda: string | null
  total_con_iva: number
  saldo_facturable: number
}
interface LineaFactura {
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: number
}

const facturaFormSchema = z.object({
  proveedor_id: z.string().min(1, "Elegí un proveedor"),
  fecha_emision: z.string().min(1, "La fecha es requerida"),
  punto_venta: z.string(),
  numero_comprobante: z.string(),
})
type FacturaFormData = z.infer<typeof facturaFormSchema>

export function FacturaForm() {
  const router = useRouter()

  const form = useForm<FacturaFormData>({
    resolver: zodResolver(facturaFormSchema),
    defaultValues: {
      proveedor_id: "",
      fecha_emision: new Date().toISOString().slice(0, 10),
      punto_venta: "",
      numero_comprobante: "",
    },
  })
  const isSubmitting = form.formState.isSubmitting
  const proveedorId = form.watch("proveedor_id")

  const [proveedores, setProveedores] = useState<any[]>([])
  const [certificaciones, setCertificaciones] = useState<CertAprobada[]>([])
  const [lineas, setLineas] = useState<LineaFactura[]>([
    { descripcion: "", cantidad: 1, precio_unitario: 0, iva_porcentaje: 21 },
  ])
  // certId -> monto imputado (texto del input)
  const [imputaciones, setImputaciones] = useState<Record<number, string>>({})

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProveedores)
      .catch(() => setProveedores([]))
  }, [])

  // Certificaciones imputables: el server ya filtra por proveedor, estado aprobado y
  // saldo facturable > 0, y trae la moneda de la OC.
  useEffect(() => {
    if (!proveedorId) {
      setCertificaciones([])
      setImputaciones({})
      return
    }
    fetch(`/api/facturas/certificaciones-aprobadas?proveedorId=${proveedorId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCertificaciones)
      .catch(() => setCertificaciones([]))
    setImputaciones({})
  }, [proveedorId])

  const totalLineas = lineas.reduce(
    (a, l) => a + l.cantidad * l.precio_unitario * (1 + l.iva_porcentaje / 100),
    0
  )
  const totalImputado = Object.values(imputaciones).reduce((a, v) => a + (Number(v) || 0), 0)

  const setLinea = (i: number, patch: Partial<LineaFactura>) =>
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const onSubmit = async (data: FacturaFormData) => {
    form.clearErrors("root")

    if (lineas.some((l) => !l.descripcion || l.cantidad <= 0)) {
      return form.setError("root", { message: "Completá descripción y cantidad de cada línea" })
    }
    // Pre-validación del tope; el trigger fn_check_imputacion es el que garantiza la regla.
    if (totalImputado > totalLineas + 0.01) {
      return form.setError("root", {
        message: `Lo imputado (${formatCurrency(totalImputado)}) supera el total de líneas (${formatCurrency(totalLineas)})`,
      })
    }
    // No se puede imputar a una certificación más que su saldo facturable.
    const certExcedida = certificaciones.find(
      (c) => Number(imputaciones[c.id] ?? 0) > c.saldo_facturable + 0.01
    )
    if (certExcedida) {
      return form.setError("root", {
        message: `No podés imputar más que el saldo facturable de ${certExcedida.numero_cert} (${formatCurrency(certExcedida.saldo_facturable)})`,
      })
    }

    const imputacionesPayload = Object.entries(imputaciones)
      .filter(([, monto]) => Number(monto) > 0)
      .map(([certId, monto]) => ({ certificacion_id: Number(certId), monto_asignado: Number(monto) }))

    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor_id: Number(data.proveedor_id),
          fecha_emision: data.fecha_emision,
          numero_comprobante: data.numero_comprobante || null,
          punto_venta: data.punto_venta || null,
          lineas,
          imputaciones: imputacionesPayload,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Error al crear la factura")

      showSuccessToast("Factura creada", body.numero_factura)
      router.push(`/facturas/${body.id}`)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido"
      form.setError("root", { message: mensaje })
      showErrorToast("No se pudo crear la factura", mensaje)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormRootError />

        <Card>
          <CardHeader>
            <CardTitle>Nueva factura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="proveedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proveedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {proveedores.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_emision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de emisión *</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="punto_venta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Punto de venta</FormLabel>
                    <FormControl>
                      <Input disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numero_comprobante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° de comprobante</FormLabel>
                    <FormControl>
                      <Input disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Líneas</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLineas((p) => [...p, { descripcion: "", cantidad: 1, precio_unitario: 0, iva_porcentaje: 21 }])}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar línea
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lineas.map((linea, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b pb-3">
                <div className="md:col-span-5 space-y-1">
                  <Label htmlFor={`linea-desc-${i}`}>Descripción</Label>
                  <Input id={`linea-desc-${i}`} value={linea.descripcion} onChange={(e) => setLinea(i, { descripcion: e.target.value })} disabled={isSubmitting} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor={`linea-cant-${i}`}>Cantidad</Label>
                  <Input id={`linea-cant-${i}`} type="number" min="0" step="0.01" value={linea.cantidad} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} disabled={isSubmitting} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor={`linea-precio-${i}`}>Precio</Label>
                  <Input id={`linea-precio-${i}`} type="number" min="0" step="0.01" value={linea.precio_unitario} onChange={(e) => setLinea(i, { precio_unitario: Number(e.target.value) })} disabled={isSubmitting} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor={`linea-iva-${i}`}>IVA %</Label>
                  <Input id={`linea-iva-${i}`} type="number" min="0" max="100" step="0.01" value={linea.iva_porcentaje} onChange={(e) => setLinea(i, { iva_porcentaje: Number(e.target.value) })} disabled={isSubmitting} />
                </div>
                <div className="md:col-span-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar línea" onClick={() => setLineas((p) => p.filter((_, idx) => idx !== i))} disabled={isSubmitting || lineas.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-end text-sm">
              Total facturado: <strong className="ml-2">{formatCurrency(totalLineas)}</strong>
            </div>
          </CardContent>
        </Card>

        {certificaciones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Imputar a certificaciones aprobadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                La suma imputada no puede superar el total de las líneas. Dejá en 0 lo que no imputes.
              </p>
              {certificaciones.map((cert) => {
                const monto = Number(imputaciones[cert.id] ?? 0)
                const excede = monto > cert.saldo_facturable + 0.01
                return (
                  <div key={cert.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end border-b pb-2">
                    <div className="md:col-span-2">
                      <p className="font-mono text-sm">{cert.numero_cert}</p>
                      <p className="text-xs text-muted-foreground break-words">
                        Certificado: {formatCurrency(cert.total_con_iva, cert.moneda ?? "ARS")} · Saldo a facturar:{" "}
                        <strong>{formatCurrency(cert.saldo_facturable, cert.moneda ?? "ARS")}</strong>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`imp-${cert.id}`}>Monto a imputar</Label>
                      <Input
                        id={`imp-${cert.id}`}
                        type="number"
                        min="0"
                        max={cert.saldo_facturable}
                        step="0.01"
                        value={imputaciones[cert.id] ?? ""}
                        onChange={(e) => setImputaciones((prev) => ({ ...prev, [cert.id]: e.target.value }))}
                        disabled={isSubmitting}
                        placeholder="0"
                      />
                      {excede && (
                        <p className="text-xs text-destructive">Máximo {formatCurrency(cert.saldo_facturable, cert.moneda ?? "ARS")}</p>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-end text-sm">
                <span className={totalImputado > totalLineas + 0.01 ? "text-destructive" : ""}>
                  Total imputado: <strong>{formatCurrency(totalImputado)}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear factura
          </Button>
        </div>
      </form>
    </Form>
  )
}
