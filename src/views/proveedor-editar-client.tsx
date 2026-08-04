"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { ProveedorForm } from "@/views/proveedor-form"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Proveedor } from "@/models"

// Lógica client de la edición de proveedor (fetch + cabecera + form). Extraída de la page para
// que sea Server Component y aplique requirePagePermission("proveedores","crear").
export function ProveedorEditarClient() {
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/proveedores/${proveedor.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Editar Proveedor</h1>
          <p className="text-muted-foreground break-words">Modifica la información del proveedor {proveedor.nombre}</p>
        </div>
      </div>

      <ProveedorForm proveedor={proveedor} isEditing={true} />
    </div>
  )
}
