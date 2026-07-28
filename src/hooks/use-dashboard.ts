"use client"

import { useState, useEffect } from "react"

export interface DashboardStats {
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
    vencidas: number
    montoTotal: number
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

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Obtener datos en paralelo usando fetch
      const [ocRes, opRes, provRes] = await Promise.all([
        fetch('/api/ordenes-compra'),
        fetch('/api/ordenes-pago'),
        fetch('/api/proveedores')
      ])

      const ordenesCompra: any[] = ocRes.ok ? await ocRes.json() : []
      const ordenesPago: any[] = opRes.ok ? await opRes.json() : []
      const proveedores: any[] = provRes.ok ? await provRes.json() : []

      // Calcular estadísticas de órdenes de compra
      const ordenesCompraStats = {
        total: ordenesCompra.length,
        pendientes: ordenesCompra.filter(o => o.estado === 'borrador' || o.estado === 'en_aprobacion').length,
        aprobadas: ordenesCompra.filter(o => o.estado === 'aprobado').length,
        recientes: ordenesCompra.filter(o => {
          const unaSemanaAtras = new Date()
          unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7)
          return new Date(o.created_at) >= unaSemanaAtras
        }).length
      }

      // Calcular estadísticas de órdenes de pago
      const ordenesPagoStats = {
        total: ordenesPago.length,
        pendientes: ordenesPago.filter(o => o.estado === 'borrador' || o.estado === 'en_aprobacion').length,
        aprobadas: ordenesPago.filter(o => o.estado === 'aprobado').length,
        vencidas: ordenesPago.filter(o => {
          if (!o.fecha_op) return false
          const hoy = new Date()
          const pendienteDePago = o.estado !== 'pagado' && o.estado !== 'anulado' && o.estado !== 'rechazado'
          return new Date(o.fecha_op) < hoy && pendienteDePago
        }).length,
        montoTotal: ordenesPago
          .filter(o => o.estado === 'pagado')
          .reduce((sum, o) => sum + (o.total_a_pagar || 0), 0)
      }

      // Calcular estadísticas de proveedores
      const proveedoresStats = {
        total: proveedores.length,
        activos: proveedores.filter(p => p.estado === 'activo').length,
        nuevos: proveedores.filter(p => {
          if (!p.created_at) return false
          const unMesAtras = new Date()
          unMesAtras.setMonth(unMesAtras.getMonth() - 1)
          return new Date(p.created_at) >= unMesAtras
        }).length
      }

      // Generar actividad reciente (últimas 10 actividades)
      const actividadReciente: DashboardStats['actividadReciente'] = []
      
      // Agregar órdenes de compra recientes
      ordenesCompra
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .forEach(orden => {
          actividadReciente.push({
            id: String(orden.id),
            tipo: 'orden_compra',
            descripcion: `Nueva orden de compra ${orden.numero_oc}`,
            fecha: new Date(orden.created_at),
            estado: orden.estado
          })
        })

      // Agregar órdenes de pago recientes
      ordenesPago
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .forEach(orden => {
          actividadReciente.push({
            id: String(orden.id),
            tipo: 'orden_pago',
            descripcion: `Orden de pago ${orden.numero_op} - ${orden.proveedor_nombre || 'Sin proveedor'}`,
            fecha: new Date(orden.created_at),
            estado: orden.estado
          })
        })

      // Agregar proveedores recientes
      proveedores
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .forEach(proveedor => {
          actividadReciente.push({
            id: String(proveedor.id),
            tipo: 'proveedor',
            descripcion: `Nuevo proveedor: ${proveedor.nombre}`,
            fecha: new Date(proveedor.created_at),
            estado: proveedor.estado
          })
        })

      // Ordenar actividad por fecha (más reciente primero) y tomar las últimas 10
      actividadReciente.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      actividadReciente.splice(10) // Mantener solo las últimas 10

      setStats({
        ordenesCompra: ordenesCompraStats,
        ordenesPago: ordenesPagoStats,
        proveedores: proveedoresStats,
        actividadReciente
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
