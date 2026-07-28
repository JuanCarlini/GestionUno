"use client"

import { useState, useEffect } from "react"

export interface ReporteEstadisticas {
  total_ordenes_compra: number
  ordenes_este_mes: number
  monto_total_ordenes: number
  total_proveedores: number
  proveedores_activos: number
  ordenes_por_estado: Array<{ estado: string; cantidad: number }>
  top_proveedores: Array<{ 
    id: number
    nombre: string
    total_ordenes: number
    monto_total: number 
  }>
  ordenes_por_mes: Array<{
    mes: string
    cantidad: number
    monto: number
  }>
}

export function useReportes() {
  const [estadisticas, setEstadisticas] = useState<ReporteEstadisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEstadisticas = async () => {
    try {
      setLoading(true)

      // Datos vía API routes (el browser no habla con Supabase — RLS niega anon)
      const [ordenesRes, proveedoresRes] = await Promise.all([
        fetch('/api/ordenes-compra'),
        fetch('/api/proveedores'),
      ])

      if (!ordenesRes.ok) throw new Error('Error al consultar órdenes de compra')
      if (!proveedoresRes.ok) throw new Error('Error al consultar proveedores')

      const ordenes: any[] = await ordenesRes.json()
      const proveedores: any[] = await proveedoresRes.json()

      // Calcular estadísticas
      const totalOrdenes = ordenes?.length || 0
      const montoTotal = ordenes?.reduce((sum, o) => sum + (o.total_con_iva || 0), 0) || 0
      
      // Órdenes de este mes
      const ahora = new Date()
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      const ordenesEsteMes = ordenes?.filter(o => 
        new Date(o.created_at) >= inicioMes
      ).length || 0

      // Órdenes por estado
      const ordenesPorEstado = ordenes?.reduce((acc, o) => {
        const estado = o.estado || 'sin_estado'
        const existing = acc.find((item: { estado: string; cantidad: number }) => item.estado === estado)
        if (existing) {
          existing.cantidad++
        } else {
          acc.push({ estado, cantidad: 1 })
        }
        return acc
      }, [] as Array<{ estado: string; cantidad: number }>) || []

      // Top proveedores por monto total
      const proveedoresMapa = new Map<number, {
        id: number
        nombre: string
        total_ordenes: number
        monto_total: number
      }>()

      ordenes?.forEach(orden => {
        const provId = orden.proveedor_id
        const prov = proveedores?.find(p => p.id === provId)
        
        if (prov) {
          if (!proveedoresMapa.has(provId)) {
            proveedoresMapa.set(provId, {
              id: provId,
              nombre: prov.nombre,
              total_ordenes: 0,
              monto_total: 0
            })
          }
          
          const item = proveedoresMapa.get(provId)!
          item.total_ordenes++
          item.monto_total += orden.total_con_iva || 0
        }
      })

      const topProveedores = Array.from(proveedoresMapa.values())
        .sort((a, b) => b.monto_total - a.monto_total)
        .slice(0, 5)

      // Órdenes por mes (últimos 6 meses)
      const ordenesPorMes: Array<{ mes: string; cantidad: number; monto: number }> = []
      for (let i = 5; i >= 0; i--) {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
        const mesNombre = fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
        
        const ordenesDelMes = ordenes?.filter(o => {
          const fechaOrden = new Date(o.created_at)
          return fechaOrden.getMonth() === fecha.getMonth() && 
                 fechaOrden.getFullYear() === fecha.getFullYear()
        }) || []

        ordenesPorMes.push({
          mes: mesNombre,
          cantidad: ordenesDelMes.length,
          monto: ordenesDelMes.reduce((sum, o) => sum + (o.total_con_iva || 0), 0)
        })
      }

      setEstadisticas({
        total_ordenes_compra: totalOrdenes,
        ordenes_este_mes: ordenesEsteMes,
        monto_total_ordenes: montoTotal,
        total_proveedores: proveedores?.length || 0,
        proveedores_activos: proveedores?.filter(p => p.estado === 'activo').length || 0,
        ordenes_por_estado: ordenesPorEstado,
        top_proveedores: topProveedores,
        ordenes_por_mes: ordenesPorMes
      })
      
      setError(null)
    } catch (err) {
      console.error("Error fetching estadísticas:", err)
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEstadisticas()
  }, [])

  return {
    estadisticas,
    loading,
    error,
    refresh: fetchEstadisticas
  }
}
