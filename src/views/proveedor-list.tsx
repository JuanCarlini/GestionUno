"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/search-bar"
import { Eye, Edit, CheckCircle, XCircle, Building2, Mail, Phone, MapPin } from "lucide-react"
import { ListShell } from "@/components/list-shell"
import { SortControl, useSort, type SortField } from "@/components/sort-control"
import Link from "next/link"
import { useState } from "react"
import { useProveedores } from "@/hooks/use-proveedores"
import { EstadoProveedor } from "@/models"
import { searchWithScore } from "@/shared/search-utils"
import { SearchStats } from "@/components/search-stats"
import { StatusBadge } from "@/components/status-badge"
import { useAuth } from "@/components/auth-context"
import { canModificarProveedor, stringToUserRole } from "@/shared/permissions"
import { showErrorToast } from "@/shared/toast-helpers"
import { EmptyState } from "@/components/empty-state"
import { CrearButton } from "@/components/crear-button"

const SORT_FIELDS: SortField[] = [
  { key: "nombre", label: "Nombre" },
  { key: "cuit", label: "CUIT" },
  { key: "estado", label: "Estado" },
]

export function ProveedorList() {
  const { proveedores, loading, error, activarProveedor, suspenderProveedor } = useProveedores()
  const { user } = useAuth()
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const userRole = user ? stringToUserRole(user.rol) : null
  const canModify = userRole ? canModificarProveedor(userRole) : false

  const sort = useSort(SORT_FIELDS)

  // buscamos solo por los campos que realmente existen en el formulario/base
  const filteredProveedores = searchWithScore(
    proveedores,
    searchTerm,
    ["nombre", "cuit", "email", "telefono", "direccion"],
    {
      nombre: 3,
      cuit: 3,
      email: 2,
      telefono: 1,
      direccion: 1,
    }
  )
  const sorted = sort.apply(filteredProveedores)

  const handleActivar = async (id: number) => {
    try {
      setProcessingId(id)
      await activarProveedor(id)
    } catch (error) {
      showErrorToast(
        "No se pudo activar el proveedor",
        error instanceof Error ? error.message : "Error desconocido"
      )
    } finally {
      setProcessingId(null)
    }
  }

  const handleSuspender = async (id: number) => {
    try {
      setProcessingId(id)
      await suspenderProveedor(id)
    } catch (error) {
      showErrorToast(
        "No se pudo suspender el proveedor",
        error instanceof Error ? error.message : "Error desconocido"
      )
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <ListShell loading={loading} error={error} loadingText="Cargando proveedores...">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Lista de Proveedores ({filteredProveedores.length})</CardTitle>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por nombre, CUIT, email..."
            className="w-full sm:w-80"
          />
        </div>
      </CardHeader>
      <CardContent>
        <SearchStats
          totalItems={proveedores.length}
          filteredItems={filteredProveedores.length}
          searchTerm={searchTerm}
          entityName="proveedor"
        />

        <div className="mb-4 flex justify-end">
          <SortControl {...sort} />
        </div>

        <div className="space-y-4">
          {filteredProveedores.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={
                searchTerm
                  ? `No se encontraron proveedores que coincidan con "${searchTerm}"`
                  : "No hay proveedores registrados"
              }
            >
              {!searchTerm && (
                <CrearButton modulo="proveedores" href="/proveedores/nuevo" label="Registrar el primer proveedor" />
              )}
            </EmptyState>
          ) : (
            sorted.map((proveedor) => (
              <div
                key={proveedor.id}
                className="border border-border rounded-lg p-4 hover:bg-accent transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* columnas */}
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Información Principal */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium text-foreground">
                          {proveedor.nombre || "—"}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        CUIT: {proveedor.cuit || "—"}
                      </p>
                      {proveedor.estado && (
                        <StatusBadge estado={proveedor.estado} showIcon />
                      )}
                    </div>

                    {/* Información de Contacto */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {proveedor.email || "Sin email"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {proveedor.telefono || "Sin teléfono"}
                        </span>
                      </div>
                    </div>

                    {/* Ubicación / Dirección */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {proveedor.direccion || "Sin dirección"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/proveedores/${proveedor.id}`} aria-label="Ver proveedor">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/proveedores/${proveedor.id}/editar`} aria-label="Editar proveedor">
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>

                    {canModify && (proveedor.estado === EstadoProveedor.ACTIVO ? (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Desactivar proveedor"
                        aria-label="Desactivar proveedor"
                        onClick={() => handleSuspender(proveedor.id)}
                        disabled={processingId === proveedor.id}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Activar proveedor"
                        aria-label="Activar proveedor"
                        onClick={() => handleActivar(proveedor.id)}
                        disabled={processingId === proveedor.id}
                      >
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
    </ListShell>
  )
}
