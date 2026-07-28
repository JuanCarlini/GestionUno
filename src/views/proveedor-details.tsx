"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Edit,
  ArrowLeft,
  CheckCircle,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { Proveedor, EstadoProveedor } from "@/models"
import { useState } from "react"
import { StatusBadge } from "@/components/status-badge"
import { useAuth } from "@/components/auth-context"
import { canModificarProveedor, stringToUserRole } from "@/shared/permissions"

interface Props {
  proveedor: Proveedor
  onActivar?: () => Promise<void>
  onSuspender?: () => Promise<void>
}

// versión segura para que no tire "Invalid time value"
const formatDate = (date?: string | Date | null) => {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function ProveedorDetails({ proveedor, onActivar, onSuspender }: Props) {
  const { user } = useAuth()
  const [isProcessing, setIsProcessing] = useState(false)

  const canModificar = user ? canModificarProveedor(stringToUserRole(user.rol)) : false

  const handleActivar = async () => {
    if (!onActivar) return
    try {
      setIsProcessing(true)
      await onActivar()
    } catch (error) {
      console.error("Error al activar proveedor:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSuspender = async () => {
    if (!onSuspender) return
    try {
      setIsProcessing(true)
      await onSuspender()
    } catch (error) {
      console.error("Error al suspender proveedor:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/proveedores">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {proveedor.nombre || "Proveedor"}
            </h1>
            <p className="text-muted-foreground">CUIT: {proveedor.cuit || "—"}</p>
          </div>
          {proveedor.estado && (
            <StatusBadge estado={proveedor.estado} showIcon />
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/proveedores/${proveedor.id}/editar`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>

          {canModificar && (
            <>
              {proveedor.estado === EstadoProveedor.ACTIVO ? (
                <Button
                  variant="outline"
                  onClick={handleSuspender}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  Desactivar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleActivar}
                  disabled={isProcessing}
                >
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Activar
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información Básica */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Información Básica</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Nombre de la Empresa
                  </p>
                  <p className="text-foreground">{proveedor.nombre || "—"}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">CUIT</p>
                    <p className="text-foreground">{proveedor.cuit || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Estado</p>
                  {proveedor.estado ? (
                    <StatusBadge estado={proveedor.estado} showIcon />
                  ) : (
                    <p className="text-foreground">—</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de Contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Información de Contacto</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      {proveedor.email ? (
                        <a
                          href={`mailto:${proveedor.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {proveedor.email}
                        </a>
                      ) : (
                        <p className="text-foreground">—</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                      {proveedor.telefono ? (
                        <a
                          href={`tel:${proveedor.telefono}`}
                          className="text-blue-600 hover:underline"
                        >
                          {proveedor.telefono}
                        </a>
                      ) : (
                        <p className="text-foreground">—</p>
                      )}
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>

          {/* Ubicación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Ubicación</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Dirección</p>
                  <p className="text-foreground">{proveedor.direccion || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Información del Sistema */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Fecha de Creación
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(proveedor.created_at)}
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Acciones Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/ordenes-compra/nueva?proveedor=${proveedor.id}`}>
                  Crear Orden de Compra
                </Link>
              </Button>

              <Button className="w-full" variant="outline" asChild>
                <Link href={`/ordenes-pago/nueva?proveedor=${proveedor.id}`}>
                  Crear Orden de Pago
                </Link>
              </Button>

              <Button className="w-full" variant="outline" asChild>
                <Link href={`/reportes/proveedor/${proveedor.id}`}>
                  Ver Reportes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
