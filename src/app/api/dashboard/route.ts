import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { ReporteRepository } from "@/repositories/reporte.repository"

// GET /api/dashboard - Resumen agregado en SQL (rpc_dashboard_resumen). Visible para
// cualquier usuario autenticado, igual que la página que lo consume.
export async function GET() {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const resumen = await ReporteRepository.resumenDashboard()
    return NextResponse.json(resumen)
  } catch (error) {
    return handleRouteError(error, "GET /api/dashboard")
  }
}
