"use client"

import { useState, useEffect } from "react"
import { api } from "@/shared/api-client"

interface DashboardStats {
  ordenesCompra: {
    total: number
    pendientes: number
    aprobadas: number
    recientes: number
  }
  ordenesPago: {
    total: number
    pendientes: number
    aprobadas: number
    // Aprobadas y todavia no pagadas. No hay fecha de vencimiento en el modelo: llamar
    // "vencida" a una OP por su fecha de emision marcaba como vencida toda OP de ayer.
    porPagar: number
    // Pagado por moneda: sumar ARS y USD en un solo número no tiene sentido.
    montoPagadoPorMoneda: Record<string, number>
  }
  proveedores: {
    total: number
    activos: number
    nuevos: number
  }
  actividadReciente: Array<{
    id: string
    tipo: 'orden_compra' | 'orden_pago' | 'proveedor'
    descripcion: string
    fecha: Date
    estado?: string
  }>
}

// La agregación vive en rpc_dashboard_resumen (SQL): traer las tablas enteras y contar
// en el navegador quedaba truncado en el techo de 1000 filas de PostgREST. Acá solo se
// traduce el shape snake_case del RPC al de la UI.
export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const d = await api("/api/dashboard")

      setStats({
        ordenesCompra: {
          total: Number(d.ordenes_compra?.total ?? 0),
          pendientes: Number(d.ordenes_compra?.pendientes ?? 0),
          aprobadas: Number(d.ordenes_compra?.aprobadas ?? 0),
          recientes: Number(d.ordenes_compra?.recientes ?? 0),
        },
        ordenesPago: {
          total: Number(d.ordenes_pago?.total ?? 0),
          pendientes: Number(d.ordenes_pago?.pendientes ?? 0),
          aprobadas: Number(d.ordenes_pago?.aprobadas ?? 0),
          porPagar: Number(d.ordenes_pago?.aprobadas ?? 0),
          montoPagadoPorMoneda: d.ordenes_pago?.monto_pagado_por_moneda ?? {},
        },
        proveedores: {
          total: Number(d.proveedores?.total ?? 0),
          activos: Number(d.proveedores?.activos ?? 0),
          nuevos: Number(d.proveedores?.nuevos ?? 0),
        },
        actividadReciente: (d.actividad_reciente ?? []).map(
          (a: { id: string; tipo: string; descripcion: string; fecha: string; estado?: string }) => ({
            ...a,
            fecha: new Date(a.fecha),
          })
        ),
      })

      setError(null)
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err)
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  return {
    stats,
    loading,
    error,
    refreshData: fetchDashboardData
  }
}
