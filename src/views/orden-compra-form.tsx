"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormRootError } from "@/components/ui/form-root-error"
import { Loader2, Plus, Trash2, ShoppingCart } from "lucide-react"
import { Proveedor, Item } from "@/models"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"
import { formatCurrency } from "@/shared/format-utils"
import { ItemSelector } from "@/views/item-selector"

// La CABECERA va por react-hook-form + zodResolver; los items se agregan por un mini-form de
// staging y viven en una lista de solo lectura → estado controlado (useFieldArray no aporta acá).

interface ItemOrden {
  id: string
  item_id?: number | null
  producto: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: number
  subtotal: number
}

// Alícuotas de IVA vigentes en Argentina. Cada línea de OC elige la suya.
const IVA_RATES = [0, 10.5, 21, 27] as const

const ocFormSchema = z.object({
  proveedor_id: z.string().min(1, "Seleccioná un proveedor"),
  fecha_oc: z.string().min(1, "La fecha es requerida"),
  moneda: z.string().min(1),
  observaciones: z.string(),
})
type OcFormData = z.infer<typeof ocFormSchema>

export function OrdenCompraForm() {
  const router = useRouter()

  const form = useForm<OcFormData>({
    resolver: zodResolver(ocFormSchema),
    defaultValues: {
      proveedor_id: "",
      fecha_oc: new Date().toISOString().split("T")[0],
      moneda: "ARS",
      observaciones: "",
    },
  })
  const isLoading = form.formState.isSubmitting

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loadingProveedores, setLoadingProveedores] = useState(true)

  // items solo para el front, después los convertimos al formato de la tabla de líneas
  const [items, setItems] = useState<ItemOrden[]>([])
  const [nuevoItem, setNuevoItem] = useState({
    item_id: null as number | null,
    producto: "",
    descripcion: "",
    cantidad: "1",
    precio_unitario: "",
    iva_porcentaje: "21",
  })
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)

  // ===== helpers de totales =====

  const calcularSubtotal = () => items.reduce((sum, item) => sum + item.subtotal, 0)
  // Cada línea puede tener su propia alícuota → IVA por línea, no un 21% plano.
  const calcularImpuestos = () => items.reduce((sum, item) => sum + item.subtotal * (item.iva_porcentaje / 100), 0)
  const calcularTotal = () => calcularSubtotal() + calcularImpuestos()

  // ===== cargar proveedores =====

  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        setLoadingProveedores(true)
        const res = await fetch("/api/proveedores")
        const data: any[] = res.ok ? await res.json() : []
        // en la base el estado es 'activo' / 'inactivo'
        const activos = data.filter((p) => (p.estado ?? "activo") === "activo")
        setProveedores(activos)
      } catch (err) {
        console.error("Error al cargar proveedores:", err)
        form.setError("root", { message: "No se pudieron cargar los proveedores" })
      } finally {
        setLoadingProveedores(false)
      }
    }

    fetchProveedores()
  }, [form])

  // ===== handlers =====

  const handleNuevoItemChange = (field: string, value: string) => {
    setNuevoItem((prev) => ({ ...prev, [field]: value }))
  }

  const agregarItem = () => {
    if (!nuevoItem.producto.trim()) {
      return form.setError("root", { message: "El nombre del producto es requerido" })
    }

    const cantidad = parseFloat(nuevoItem.cantidad) || 0
    const precioUnitario = parseFloat(nuevoItem.precio_unitario) || 0

    if (cantidad <= 0) {
      return form.setError("root", { message: "La cantidad debe ser mayor a 0" })
    }
    if (precioUnitario <= 0) {
      return form.setError("root", { message: "El precio unitario debe ser mayor a 0" })
    }

    const item: ItemOrden = {
      id: `temp-${Date.now()}`,
      item_id: nuevoItem.item_id,
      producto: nuevoItem.producto,
      descripcion: nuevoItem.descripcion,
      cantidad,
      precio_unitario: precioUnitario,
      iva_porcentaje: parseFloat(nuevoItem.iva_porcentaje) || 0,
      subtotal: cantidad * precioUnitario,
    }

    setItems((prev) => [...prev, item])

    // Reset del staging (el IVA vuelve al 21% por defecto)
    setNuevoItem({ item_id: null, producto: "", descripcion: "", cantidad: "1", precio_unitario: "", iva_porcentaje: "21" })
    setSelectedItem(null)
    form.clearErrors("root")
  }

  const eliminarItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const onSubmit = async (data: OcFormData) => {
    form.clearErrors("root")

    if (items.length === 0) {
      return form.setError("root", { message: "Debes agregar al menos un item" })
    }

    try {
      // líneas para gu_lineasdeordenesdecompra (el orden_compra_id lo asigna el backend)
      const lineas = items.map((item) => {
        const totalNeto = item.subtotal
        const iva = item.iva_porcentaje
        return {
          item_id: item.item_id || null,
          // la columna descripcion es NOT NULL en la tabla, así que le mando algo sí o sí
          descripcion: item.descripcion || item.producto,
          cantidad: item.cantidad,
          precio_unitario_neto: item.precio_unitario,
          iva_porcentaje: iva,
          total_neto: totalNeto,
          total_con_iva: totalNeto * (1 + iva / 100),
          estado: "borrador",
        }
      })

      // cabecera + líneas en un solo POST (el backend crea todo y audita)
      const res = await fetch("/api/ordenes-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // numero_oc, totales y estado los pone la DB/el server (Zod descarta lo demás)
          proveedor_id: Number(data.proveedor_id),
          proyecto_id: null,
          fecha_oc: data.fecha_oc, // la tabla es DATE
          moneda: data.moneda, // enum en la base
          observaciones: data.observaciones || null,
          lineas,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }

      showSuccessToast("Orden de compra creada exitosamente")
      router.push("/ordenes-compra")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      form.setError("root", { message: `Error al crear la orden de compra: ${errorMessage}` })
      showErrorToast("Error al crear la orden de compra", errorMessage)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Orden de Compra</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormRootError />

            {/* Información de la OC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="proveedor_id"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Proveedor *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={loadingProveedores || isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingProveedores
                                ? "Cargando proveedores..."
                                : proveedores.length === 0
                                ? "No hay proveedores disponibles"
                                : "Selecciona un proveedor"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {proveedores.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No hay proveedores registrados
                          </SelectItem>
                        ) : (
                          proveedores.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nombre}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fecha_oc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de la OC *</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ARS">ARS</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea rows={2} disabled={isLoading} placeholder="Notas u observaciones internas..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Items */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Items de la Orden
              </h3>

              {/* Form para agregar item */}
              <div className="bg-muted p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Producto / Servicio *</Label>
                    <ItemSelector
                      value={nuevoItem.item_id}
                      onChange={(itemId, item) => {
                        setSelectedItem(item)
                        setNuevoItem((prev) => ({ ...prev, item_id: itemId, producto: item?.nombre || "" }))
                      }}
                      disabled={isLoading}
                      placeholder="Buscar o crear item..."
                    />
                    {selectedItem && selectedItem.descripcion && (
                      <p className="text-xs text-muted-foreground mt-1">{selectedItem.descripcion}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevo-item-cantidad">Cantidad *</Label>
                    <Input
                      id="nuevo-item-cantidad"
                      type="number"
                      min="1"
                      value={nuevoItem.cantidad}
                      onChange={(e) => handleNuevoItemChange("cantidad", e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevo-item-precio">Precio Unit. *</Label>
                    <Input
                      id="nuevo-item-precio"
                      type="number"
                      min="0"
                      step="0.01"
                      value={nuevoItem.precio_unitario}
                      onChange={(e) => handleNuevoItemChange("precio_unitario", e.target.value)}
                      disabled={isLoading}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevo-item-iva">IVA *</Label>
                    <Select
                      value={nuevoItem.iva_porcentaje}
                      onValueChange={(value) => handleNuevoItemChange("iva_porcentaje", value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="nuevo-item-iva">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IVA_RATES.map((rate) => (
                          <SelectItem key={rate} value={String(rate)}>
                            {rate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={agregarItem} disabled={isLoading} className="w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  <Label htmlFor="nuevo-item-desc">Descripción del item (opcional)</Label>
                  <Input
                    id="nuevo-item-desc"
                    value={nuevoItem.descripcion}
                    onChange={(e) => handleNuevoItemChange("descripcion", e.target.value)}
                    disabled={isLoading}
                    placeholder="Detalles adicionales del producto"
                  />
                </div>
              </div>

              {/* lista de items */}
              {items.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted rounded-t font-medium text-sm">
                    <div className="col-span-4">Producto</div>
                    <div className="col-span-2 text-right">Cantidad</div>
                    <div className="col-span-2 text-right">P. Unitario</div>
                    <div className="col-span-1 text-right">IVA</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                    <div className="col-span-1" />
                  </div>
                  {items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-3 border rounded hover:bg-accent">
                      <div className="col-span-4">
                        <p className="font-medium">{item.producto}</p>
                        {item.descripcion && <p className="text-sm text-muted-foreground">{item.descripcion}</p>}
                      </div>
                      <div className="col-span-2 text-right">{item.cantidad}</div>
                      <div className="col-span-2 text-right">{formatCurrency(item.precio_unitario)}</div>
                      <div className="col-span-1 text-right">{item.iva_porcentaje}%</div>
                      <div className="col-span-2 text-right font-medium">{formatCurrency(item.subtotal)}</div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Quitar ${item.producto}`}
                          onClick={() => eliminarItem(item.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded">
                  No hay items agregados. Usa el formulario de arriba para agregarlos.
                </div>
              )}
            </div>

            {/* Totales */}
            {items.length > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Neto:</span>
                    <span className="font-medium">{formatCurrency(calcularSubtotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA:</span>
                    <span className="font-medium">{formatCurrency(calcularImpuestos())}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t text-lg font-bold">
                    <span>Total con IVA:</span>
                    <span className="text-green-600">{formatCurrency(calcularTotal())}</span>
                  </div>
                </div>
              </div>
            )}

            {/* acciones */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading || loadingProveedores}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLoading ? "Creando..." : "Crear Orden"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/ordenes-compra")} disabled={isLoading}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
