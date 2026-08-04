"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ShoppingCart, 
  CreditCard, 
  Building2, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react"
import { useDashboard } from "@/hooks/use-dashboard"
import { formatCurrency } from "@/shared/format-utils"
import { formatDateShort } from "@/shared/date-utils"
import { StatusBadge } from "@/components/status-badge"

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'orden_compra':
      return <ShoppingCart className="h-4 w-4 text-muted-foreground" />
    case 'orden_pago':
      return <CreditCard className="h-4 w-4 text-muted-foreground" />
    case 'proveedor':
      return <Building2 className="h-4 w-4 text-muted-foreground" />
    default:
      return <div className="h-4 w-4" />
  }
}

export function DashboardOverview() {
  const { stats, loading, error, refreshData } = useDashboard()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive mb-4">Error: {error}</p>
          <Button onClick={refreshData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    )
  }

  const statsCards = [
    {
      title: "Órdenes de Compra",
      value: stats.ordenesCompra.total.toString(),
      change: `${stats.ordenesCompra.recientes} nueva${stats.ordenesCompra.recientes !== 1 ? 's' : ''} esta semana`,
      icon: ShoppingCart,
      color: "text-muted-foreground",
      details: `${stats.ordenesCompra.pendientes} pendientes, ${stats.ordenesCompra.aprobadas} aprobadas`
    },
    {
      title: "Órdenes de Pago",
      value: stats.ordenesPago.total.toString(),
      change: `${stats.ordenesPago.porPagar} por pagar`,
      icon: CreditCard,
      color: stats.ordenesPago.porPagar > 0 ? "text-destructive" : "text-muted-foreground",
      details: `${stats.ordenesPago.pendientes} pendientes, ${stats.ordenesPago.aprobadas} aprobadas`
    },
    {
      title: "Proveedores",
      value: stats.proveedores.total.toString(),
      change: `${stats.proveedores.activos} activos`,
      icon: Building2,
      color: "text-muted-foreground",
      details: `${stats.proveedores.nuevos} nuevo${stats.proveedores.nuevos !== 1 ? 's' : ''} este mes`
    },
    {
      title: "Total Pagado",
      value:
        Object.entries(stats.ordenesPago.montoPagadoPorMoneda)
          .map(([moneda, monto]) => formatCurrency(monto, moneda))
          .join(" · ") || formatCurrency(0, "ARS"),
      change: "Órdenes completadas",
      icon: TrendingUp,
      color: "text-muted-foreground",
      details: "Monto total de pagos realizados"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Acción de refresco */}
      <div className="flex justify-end">
        <Button onClick={refreshData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => {
          const IconComponent = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <IconComponent className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground break-words">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.details}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividad Reciente */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.actividadReciente.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay actividad reciente</p>
              ) : (
                stats.actividadReciente.slice(0, 5).map((actividad) => (
                  <div key={`${actividad.tipo}-${actividad.id}`} className="flex items-center space-x-3">
                    {getTipoIcon(actividad.tipo)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{actividad.descripcion}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-muted-foreground">{formatDateShort(actividad.fecha)}</p>
                        {actividad.estado && <StatusBadge estado={actividad.estado} />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Órdenes que Requieren Atención */}
        <Card>
          <CardHeader>
            <CardTitle>Requieren Atención</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Órdenes de pago aprobadas sin pagar */}
              {stats.ordenesPago.porPagar > 0 && (
                <div className="flex items-center justify-between gap-2 p-3 bg-destructive/10 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Pagos pendientes</p>
                      <p className="text-xs text-destructive">{stats.ordenesPago.porPagar} órdenes de pago aprobadas sin pagar</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 shrink-0">
                    Por pagar
                  </Badge>
                </div>
              )}

              {/* Órdenes pendientes */}
              {stats.ordenesCompra.pendientes > 0 && (
                <div className="flex items-center justify-between gap-2 p-3 bg-amber-500/10 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Órdenes Pendientes</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">{stats.ordenesCompra.pendientes} órdenes de compra por aprobar</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shrink-0">
                    Pendiente
                  </Badge>
                </div>
              )}

              {/* Si todo está bien */}
              {stats.ordenesPago.porPagar === 0 && stats.ordenesCompra.pendientes === 0 && (
                <div className="flex items-center space-x-2 p-3 bg-emerald-500/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Todo al día</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">No hay elementos que requieran atención inmediata</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
