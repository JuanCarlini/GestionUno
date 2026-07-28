"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  Loader2,
  DollarSign,
  Users,
  ShoppingCart
} from "lucide-react"
import { useReportes } from "@/hooks/use-reportes"
import { formatCurrency } from "@/shared/format-utils"

export function ReportesDashboard() {
  const { estadisticas, loading, error } = useReportes()

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando estadísticas...</span>
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

  if (!estadisticas) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.total_ordenes_compra}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes de compra registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{estadisticas.ordenes_este_mes}</div>
            <p className="text-xs text-muted-foreground">
              {estadisticas.total_ordenes_compra > 0 
                ? `${Math.round((estadisticas.ordenes_este_mes / estadisticas.total_ordenes_compra) * 100)}% del total`
                : 'Sin órdenes'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(estadisticas.monto_total_ordenes)}
            </div>
            <p className="text-xs text-muted-foreground">
              En órdenes de compra
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.total_proveedores}</div>
            <p className="text-xs text-muted-foreground">
              {estadisticas.proveedores_activos} activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tipos y formatos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Órdenes por Estado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Órdenes por Estado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estadisticas.ordenes_por_estado.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay datos disponibles</p>
            ) : (
              <div className="space-y-4">
                {estadisticas.ordenes_por_estado.map((item, index) => (
                  <div key={item.estado} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-800">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground capitalize">{item.estado}</p>
                        <p className="text-sm text-muted-foreground">{item.cantidad} órdenes</p>
                      </div>
                    </div>
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ 
                          width: `${(item.cantidad / estadisticas.total_ordenes_compra) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Proveedores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Top Proveedores</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estadisticas.top_proveedores.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay datos disponibles</p>
            ) : (
              <div className="space-y-4">
                {estadisticas.top_proveedores.map((item, index) => {
                  const colorClasses = [
                    "bg-yellow-100 text-yellow-800",
                    "bg-gray-100 text-gray-800", 
                    "bg-orange-100 text-orange-800",
                    "bg-blue-100 text-blue-800",
                    "bg-green-100 text-green-800"
                  ]
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge className={colorClasses[index]}>
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.nombre}</p>
                          <p className="text-sm text-muted-foreground">{item.total_ordenes} órdenes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(item.monto_total)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendencia Mensual */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Órdenes (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {estadisticas.ordenes_por_mes.map((item) => (
              <div key={item.mes} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{item.mes}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium">{item.cantidad} órdenes</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatCurrency(item.monto)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all" 
                      style={{ 
                        width: `${Math.min((item.cantidad / Math.max(...estadisticas.ordenes_por_mes.map(m => m.cantidad))) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
