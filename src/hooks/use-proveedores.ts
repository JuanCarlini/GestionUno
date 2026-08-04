"use client"

import { useState, useEffect } from "react"
import { Proveedor } from "@/models"
import { showSuccessToast, showErrorToast, toastMessages } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"

export function useProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProveedores = async () => {
    try {
      setLoading(true)
      const data = await api("/api/proveedores")
      setProveedores(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  const activarProveedor = async (id: number) => {
    try {
      const updatedProveedor = await api(`/api/proveedores/${id}/activar`, { method: "PATCH" })
      if (updatedProveedor) {
        setProveedores(prev =>
          prev.map(proveedor => proveedor.id === id ? updatedProveedor : proveedor)
        )
        showSuccessToast(toastMessages.proveedor.activated, updatedProveedor.nombre)
      }
      return updatedProveedor
    } catch (err) {
      showErrorToast(toastMessages.proveedor.error, err instanceof Error ? err.message : "Error desconocido")
      throw err
    }
  }

  const suspenderProveedor = async (id: number) => {
    try {
      // La DB solo tiene activo/inactivo: "suspender" se materializa como inactivo
      const updatedProveedor = await api(`/api/proveedores/${id}/suspender`, { method: "PATCH" })
      if (updatedProveedor) {
        setProveedores(prev =>
          prev.map(proveedor => proveedor.id === id ? updatedProveedor : proveedor)
        )
        showSuccessToast(toastMessages.proveedor.deactivated, updatedProveedor.nombre)
      }
      return updatedProveedor
    } catch (err) {
      showErrorToast(toastMessages.proveedor.error, err instanceof Error ? err.message : "Error desconocido")
      throw err
    }
  }

  useEffect(() => {
    fetchProveedores()
  }, [])

  return {
    proveedores,
    loading,
    error,
    activarProveedor,
    suspenderProveedor,
  }
}
