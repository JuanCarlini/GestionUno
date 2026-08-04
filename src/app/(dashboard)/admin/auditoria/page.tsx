"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, ClipboardList, History } from "lucide-react"
import { formatDateTime } from "@/shared/date-utils"

type Fuente = "bitacora" | "cambios"

interface FilaAuditoria {
  id: number
  tabla: string
  registro_id: number
  usuario: string
  accion: string
  detalle?: string
  datos_anteriores?: Record<string, any> | null
  datos_nuevos?: Record<string, any> | null
  fecha: string
}

interface UsuarioOpc { id: number; nombre: string }

const TABLAS = ["sesion", "gu_ordenesdecompra", "gu_certificaciones", "gu_facturas", "gu_ordenesdepago", "gu_proveedores"]
const ACCIONES = ["login", "logout", "crear", "actualizar", "eliminar", "aprobar", "rechazar", "anular", "activar", "desactivar"]
const TODOS = "__todos__"

// Diferencia campo a campo entre datos anteriores y nuevos (control de cambios)
function diffCampos(ant?: Record<string, any> | null, nue?: Record<string, any> | null): string {
  if (!ant) return "creación (sin valores previos)"
  if (!nue) return "eliminación"
  const claves = new Set([...Object.keys(ant), ...Object.keys(nue)])
  const cambios: string[] = []
  for (const k of claves) {
    if (JSON.stringify(ant[k]) !== JSON.stringify(nue[k])) {
      cambios.push(`${k}: ${JSON.stringify(ant[k])} → ${JSON.stringify(nue[k])}`)
    }
  }
  return cambios.length ? cambios.join(" · ") : "sin cambios de valor"
}

export default function AuditoriaPage() {
  const [fuente, setFuente] = useState<Fuente>("bitacora")
  const [filas, setFilas] = useState<FilaAuditoria[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOpc[]>([])
  const [loading, setLoading] = useState(false)

  const [fUsuario, setFUsuario] = useState(TODOS)
  const [fTabla, setFTabla] = useState(TODOS)
  const [fAccion, setFAccion] = useState(TODOS)
  const [fDesde, setFDesde] = useState("")
  const [fHasta, setFHasta] = useState("")

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsuarios((data || []).map((u: any) => ({ id: u.id, nombre: u.nombre || u.email }))))
      .catch(() => setUsuarios([]))
  }, [])

  const buscar = async (f: Fuente = fuente) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ fuente: f })
      if (fUsuario !== TODOS) params.set("usuarioId", fUsuario)
      if (fTabla !== TODOS) params.set("tabla", fTabla)
      if (fAccion !== TODOS) params.set("accion", fAccion)
      if (fDesde) params.set("desde", fDesde)
      if (fHasta) params.set("hasta", fHasta)
      const res = await fetch(`/api/admin/auditoria?${params.toString()}`)
      setFilas(res.ok ? await res.json() : [])
    } catch {
      setFilas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    buscar(fuente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente])

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoría" description="Bitácora de operaciones y control de cambios del sistema" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Búsqueda combinada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>Usuario</Label>
              <Select value={fUsuario} onValueChange={setFUsuario}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entidad / tabla</Label>
              <Select value={fTabla} onValueChange={setFTabla}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {TABLAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Acción</Label>
              <Select value={fAccion} onValueChange={setFAccion}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {ACCIONES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Desde</Label>
              <Input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => buscar()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={fuente} onValueChange={(v) => setFuente(v as Fuente)}>
        <TabsList className="max-w-full justify-start overflow-x-auto scrollbar-none">
          <TabsTrigger value="bitacora"><ClipboardList className="h-4 w-4 mr-2" />Bitácora de operaciones</TabsTrigger>
          <TabsTrigger value="cambios"><History className="h-4 w-4 mr-2" />Control de cambios</TabsTrigger>
        </TabsList>

        <TabsContent value="bitacora">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin registros para los filtros aplicados</TableCell></TableRow>
                  ) : filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(f.fecha)}</TableCell>
                      <TableCell>{f.usuario}</TableCell>
                      <TableCell><Badge variant="outline">{f.accion}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{f.tabla}</TableCell>
                      <TableCell className="text-muted-foreground">#{f.registro_id}</TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate" title={f.detalle ?? undefined}>{f.detalle}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cambios">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Cambios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin registros para los filtros aplicados</TableCell></TableRow>
                  ) : filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(f.fecha)}</TableCell>
                      <TableCell>{f.usuario}</TableCell>
                      <TableCell><Badge variant="outline">{f.accion}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{f.tabla}</TableCell>
                      <TableCell className="text-muted-foreground">#{f.registro_id}</TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-md truncate" title={diffCampos(f.datos_anteriores, f.datos_nuevos)}>
                        {diffCampos(f.datos_anteriores, f.datos_nuevos)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
