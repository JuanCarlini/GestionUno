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
import { FormRootError } from "@/components/ui/form-root-error"
import { Loader2 } from "lucide-react"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"
import { formatCurrency } from "@/shared/format-utils"

// La OP paga N facturas FINALIZADAS del mismo proveedor y reparte el total en N cajas de la
// misma moneda. Regla dura (fn_op_gate): Σcajas = Σfacturas = total_a_pagar; se valida al aprobar.

const opFormSchema = z.object({
  proveedor_id: z.string().min(1, "Elegí un proveedor"),
  moneda: z.string().min(1),
  fecha_op: z.string().min(1, "La fecha es requerida"),
})
type OpFormData = z.infer<typeof opFormSchema>

export function OrdenPagoForm() {
  const router = useRouter()

  const form = useForm<OpFormData>({
    resolver: zodResolver(opFormSchema),
    defaultValues: {
      proveedor_id: "",
      moneda: "ARS",
      fecha_op: new Date().toISOString().slice(0, 10),
    },
  })
  const isSubmitting = form.formState.isSubmitting
  const proveedorId = form.watch("proveedor_id")
  const moneda = form.watch("moneda")

  const [proveedores, setProveedores] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [cajas, setCajas] = useState<any[]>([])

  // facturaId -> monto a pagar de esa factura (texto)
  const [pagos, setPagos] = useState<Record<number, string>>({})
  // cajaId -> monto desde esa caja (texto)
  const [repartos, setRepartos] = useState<Record<number, string>>({})

  useEffect(() => {
    fetch("/api/proveedores").then((r) => (r.ok ? r.json() : [])).then(setProveedores).catch(() => {})
    fetch("/api/cajas").then((r) => (r.ok ? r.json() : [])).then(setCajas).catch(() => {})
  }, [])

  // Facturas finalizadas del proveedor (las únicas pagables — fn_lop_factura_pagable).
  useEffect(() => {
    if (!proveedorId) {
      setFacturas([])
      setPagos({})
      return
    }
    fetch("/api/facturas")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) =>
        setFacturas(data.filter((f) => f.proveedor_id === Number(proveedorId) && f.estado === "finalizado"))
      )
      .catch(() => setFacturas([]))
    setPagos({})
  }, [proveedorId])

  const cajasDeLaMoneda = cajas.filter((c) => c.moneda === moneda)
  const totalFacturas = Object.values(pagos).reduce((a, v) => a + (Number(v) || 0), 0)
  const totalCajas = Object.values(repartos).reduce((a, v) => a + (Number(v) || 0), 0)
  const sumasCoinciden = Math.abs(totalFacturas - totalCajas) < 0.01 && totalFacturas > 0

  const onSubmit = async (data: OpFormData) => {
    form.clearErrors("root")

    const facturasPayload = Object.entries(pagos).filter(([, m]) => Number(m) > 0)
    if (facturasPayload.length === 0) {
      return form.setError("root", { message: "Cargá el monto de al menos una factura" })
    }
    // Pre-validación de la regla dura; el gate fn_op_gate es el que la garantiza.
    if (!sumasCoinciden) {
      return form.setError("root", {
        message: `El total de las cajas (${formatCurrency(totalCajas)}) debe igualar el de las facturas (${formatCurrency(totalFacturas)})`,
      })
    }

    try {
      // 1) crear la OP vacía
      let res = await fetch("/api/ordenes-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor_id: Number(data.proveedor_id), fecha_op: data.fecha_op, moneda: data.moneda }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Error al crear la orden de pago")
      const opId = body.id

      // 2) agregar facturas (fn_lop_factura_pagable valida cada una)
      for (const [facturaId, monto] of facturasPayload) {
        res = await fetch(`/api/ordenes-pago/${opId}/facturas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factura_id: Number(facturaId), monto: Number(monto) }),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Error al agregar una factura")
      }

      // 3) repartir en cajas
      for (const [cajaId, monto] of Object.entries(repartos).filter(([, m]) => Number(m) > 0)) {
        res = await fetch(`/api/ordenes-pago/${opId}/cajas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caja_id: Number(cajaId), monto: Number(monto) }),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Error al agregar una caja")
      }

      showSuccessToast("Orden de pago creada", body.numero_op)
      router.push(`/ordenes-pago/${opId}`)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido"
      form.setError("root", { message: mensaje })
      showErrorToast("No se pudo crear la orden de pago", mensaje)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormRootError />

        <Card>
          <CardHeader>
            <CardTitle>Nueva orden de pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="proveedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {proveedores.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["ARS", "USD", "EUR"].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_op"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {proveedorId && (
          <Card>
            <CardHeader><CardTitle>Facturas a pagar (finalizadas)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {facturas.length === 0 && (
                <p className="text-sm text-muted-foreground">Este proveedor no tiene facturas finalizadas.</p>
              )}
              {facturas.map((f) => (
                <div key={f.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end border-b pb-2">
                  <div className="md:col-span-2">
                    <p className="font-mono text-sm">{f.numero_factura}</p>
                    <p className="text-xs text-muted-foreground">Total: {formatCurrency(f.total_facturado)} {f.moneda}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pago-${f.id}`}>Monto a pagar</Label>
                    <Input id={`pago-${f.id}`} type="number" min="0" step="0.01" value={pagos[f.id] ?? ""} onChange={(e) => setPagos((p) => ({ ...p, [f.id]: e.target.value }))} disabled={isSubmitting} placeholder="0" />
                  </div>
                </div>
              ))}
              <div className="flex justify-end text-sm">
                Total facturas: <strong className="ml-2">{formatCurrency(totalFacturas)}</strong>
              </div>
            </CardContent>
          </Card>
        )}

        {proveedorId && (
          <Card>
            <CardHeader><CardTitle>Repartir en cajas ({moneda})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cajasDeLaMoneda.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay cajas en {moneda}. Creá una en el catálogo.</p>
              )}
              {cajasDeLaMoneda.map((c) => (
                <div key={c.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end border-b pb-2">
                  <div className="md:col-span-2">
                    <p className="font-medium text-sm">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.tipo}{c.entidad ? ` · ${c.entidad}` : ""}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`reparto-${c.id}`}>Monto</Label>
                    <Input id={`reparto-${c.id}`} type="number" min="0" step="0.01" value={repartos[c.id] ?? ""} onChange={(e) => setRepartos((p) => ({ ...p, [c.id]: e.target.value }))} disabled={isSubmitting} placeholder="0" />
                  </div>
                </div>
              ))}
              <div className="flex justify-end text-sm">
                <span className={!sumasCoinciden && totalCajas > 0 ? "text-red-600" : ""}>
                  Total cajas: <strong>{formatCurrency(totalCajas)}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !sumasCoinciden}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear orden de pago
          </Button>
        </div>
      </form>
    </Form>
  )
}
