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
  RefreshCw
} from "lucide-react"
import { DashboardSkeleton } from "@/components/skeletons"
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

  // El mismo skeleton que dashboard/loading.tsx: la transición entre los dos no salta.
  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive-ink mb-4">Error: {error}</p>
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

  // Un renglón por moneda. Antes se juntaban con " · " en un solo string, y dos montos en
  // una tarjeta de 290px no entran de ninguna manera.
  const pagado = Object.entries(stats.ordenesPago.montoPagadoPorMoneda).map(([moneda, monto]) =>
    formatCurrency(monto, moneda)
  )
  const pagadoPorMoneda = pagado.length > 0 ? pagado : [formatCurrency(0, "ARS")]

  // `valores` es una lista y no un string, por lo mismo.
  const statsCards = [
    {
      title: "Órdenes de Compra",
      valores: [stats.ordenesCompra.total.toString()],
      change: `${stats.ordenesCompra.recientes} nueva${stats.ordenesCompra.recientes !== 1 ? 's' : ''} esta semana`,
      icon: ShoppingCart,
      color: "text-muted-foreground",
      details: `${stats.ordenesCompra.pendientes} pendientes, ${stats.ordenesCompra.aprobadas} aprobadas`
    },
    {
      title: "Órdenes de Pago",
      valores: [stats.ordenesPago.total.toString()],
      change: `${stats.ordenesPago.porPagar} por pagar`,
      icon: CreditCard,
      color: stats.ordenesPago.porPagar > 0 ? "text-destructive-ink" : "text-muted-foreground",
      details: `${stats.ordenesPago.pendientes} pendientes, ${stats.ordenesPago.aprobadas} aprobadas`
    },
    {
      title: "Proveedores",
      valores: [stats.proveedores.total.toString()],
      change: `${stats.proveedores.activos} activos`,
      icon: Building2,
      color: "text-muted-foreground",
      details: `${stats.proveedores.nuevos} nuevo${stats.proveedores.nuevos !== 1 ? 's' : ''} este mes`
    },
    {
      title: "Total Pagado",
      valores: pagadoPorMoneda,
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
                {/* whitespace-nowrap en vez de break-words: con break-words, "$ 13.242.784,50"
                    se partía entre el "5" y el "0" y quedaba un número cortado al medio, que
                    es la peor forma posible de mostrar plata. Un importe no se parte nunca;
                    si no entra, se achica. tabular-nums para que las cuatro tarjetas
                    alineen sus cifras. */}
                <div className="space-y-0.5">
                  {stat.valores.map((valor) => (
                    <div
                      key={valor}
                      className={`font-bold tabular-nums whitespace-nowrap text-foreground ${
                        valor.length > 12 ? "text-xl" : "text-2xl"
                      }`}
                    >
                      {valor}
                    </div>
                  ))}
                </div>
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
              {/* Órdenes de pago aprobadas sin pagar.

                  Las tres filas de acá abajo dicen su estado con la barra de la izquierda,
                  el ícono y el chip. El texto es texto. Antes el color estaba cinco veces
                  en la misma fila —fondo, ícono, título, cuerpo y chip—: con tanta
                  repetición la fila dejaba de leerse como información y pasaba a ser un
                  rectángulo de color. Y encima el texto pintado se leía peor que el neutro
                  sobre ese mismo fondo: 6,8:1 contra 13,5:1 del título en foreground. */}
              {stats.ordenesPago.porPagar > 0 && (
                <div className="flex items-center justify-between gap-2 border-l-2 border-destructive-ink py-1 pl-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive-ink" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Pagos pendientes</p>
                      <p className="text-xs text-muted-foreground">{stats.ordenesPago.porPagar} órdenes de pago aprobadas sin pagar</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-destructive-tint/10 text-destructive-ink border-destructive-tint/20 shrink-0">
                    Por pagar
                  </Badge>
                </div>
              )}

              {/* Órdenes pendientes */}
              {stats.ordenesCompra.pendientes > 0 && (
                <div className="flex items-center justify-between gap-2 border-l-2 border-warning-ink py-1 pl-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 shrink-0 text-warning-ink" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Órdenes pendientes</p>
                      <p className="text-xs text-muted-foreground">{stats.ordenesCompra.pendientes} órdenes de compra por aprobar</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-warning-tint/10 text-warning-ink border-warning-tint/20 shrink-0">
                    Pendiente
                  </Badge>
                </div>
              )}

              {/* Si todo está bien */}
              {stats.ordenesPago.porPagar === 0 && stats.ordenesCompra.pendientes === 0 && (
                <div className="flex items-center space-x-2 border-l-2 border-success-ink py-1 pl-3">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success-ink" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Todo al día</p>
                    <p className="text-xs text-muted-foreground">No hay elementos que requieran atención inmediata</p>
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
