"use client"

import { useState, useEffect } from "react"
import { notFound, useParams } from "next/navigation"
import { DetailSkeleton } from "@/components/skeletons"
import { ProveedorDetails } from "@/views/proveedor-details"
import { Card, CardContent } from "@/components/ui/card"
import { Proveedor } from "@/models"

// Lógica client del detalle de proveedor (fetch + activar/desactivar). Extraída de la page
// para que la page pueda ser Server Component y aplicar requirePagePermission("proveedores","ver").
export function ProveedorDetailClient() {
  const params = useParams()
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // notFound() tiene que salir del render, no del efecto: ahí adentro el throw cae fuera de
  // React y no lo agarra el límite de not-found. Por eso el 404 viaja como estado.
  const [noExiste, setNoExiste] = useState(false)

  const proveedorId = params.id as string

  useEffect(() => {
    const fetchProveedor = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/proveedores/${proveedorId}`)
        if (res.status === 404) {
          setNoExiste(true)
          return
        }
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
      const res = await fetch(`/api/proveedores/${proveedor.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: true }),
      })
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
      const res = await fetch(`/api/proveedores/${proveedor.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: false }),
      })
      if (res.ok) {
        setProveedor(await res.json())
      }
    } catch (error) {
      console.error("Error al desactivar proveedor:", error)
      throw error
    }
  }

  if (noExiste) notFound()

  if (loading) return <DetailSkeleton />

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
