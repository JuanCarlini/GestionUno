"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { ProveedorDetails } from "@/views/proveedor-details"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Proveedor } from "@/models"

// Lógica client del detalle de proveedor (fetch + activar/desactivar). Extraída de la page
// para que la page pueda ser Server Component y aplicar requirePagePermission("proveedores","ver").
export function ProveedorDetailClient() {
  const params = useParams()
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const proveedorId = params.id as string

  useEffect(() => {
    const fetchProveedor = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/proveedores/${proveedorId}`)
        if (!res.ok) {
          setError("Proveedor no encontrado")
          return
        }
        setProveedor(await res.json())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    if (proveedorId) {
      fetchProveedor()
    }
  }, [proveedorId])

  const handleActivar = async () => {
    if (!proveedor) return
    try {
      const res = await fetch(`/api/proveedores/${proveedor.id}/activar`, { method: "PATCH" })
      if (res.ok) {
        setProveedor(await res.json())
      }
    } catch (error) {
      console.error("Error al activar proveedor:", error)
      throw error
    }
  }

  const handleSuspender = async () => {
    if (!proveedor) return
    try {
      // La ruta materializa "desactivar" como inactivo y chequea permisos.
      const res = await fetch(`/api/proveedores/${proveedor.id}/suspender`, { method: "PATCH" })
      if (res.ok) {
        setProveedor(await res.json())
      }
    } catch (error) {
      console.error("Error al desactivar proveedor:", error)
      throw error
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando proveedor...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!proveedor) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Proveedor no encontrado</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ProveedorDetails
      proveedor={proveedor}
      onActivar={handleActivar}
      onSuspender={handleSuspender}
    />
  )
}
