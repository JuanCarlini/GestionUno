// Tipos generados desde Supabase (proyecto "Gestion Uno v2" = ahhpzfoausrpfkumtzzx).
// Fuente de verdad del schema del circuito CCIP (2026-07-07). NO editar a mano:
// regenerar con `supabase gen types typescript` o el MCP `generate_typescript_types`.
// Cablear en el cliente: createClient<Database>(url, serviceRoleKey) en lib/supabase/service.ts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      gu_audit_log: {
        Row: {
          accion: Database["public"]["Enums"]["audit_accion"]
          created_at: string | null
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: number
          ip_address: string | null
          registro_id: number
          tabla_afectada: string
          usuario_id: number | null
        }
        Insert: {
          accion: Database["public"]["Enums"]["audit_accion"]
          created_at?: string | null
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: never
          ip_address?: string | null
          registro_id: number
          tabla_afectada: string
          usuario_id?: number | null
        }
        Update: {
          accion?: Database["public"]["Enums"]["audit_accion"]
          created_at?: string | null
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: never
          ip_address?: string | null
          registro_id?: number
          tabla_afectada?: string
          usuario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_auditlog_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "gu_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_auditoria: {
        Row: {
          accion: string
          created_at: string | null
          fecha_cambio: string | null
          id: number
          motivo_cambio: string | null
          registro_id: number
          tabla_origen: string
          usuario_id: number
        }
        Insert: {
          accion: string
          created_at?: string | null
          fecha_cambio?: string | null
          id?: never
          motivo_cambio?: string | null
          registro_id: number
          tabla_origen: string
          usuario_id: number
        }
        Update: {
          accion?: string
          created_at?: string | null
          fecha_cambio?: string | null
          id?: never
          motivo_cambio?: string | null
          registro_id?: number
          tabla_origen?: string
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_aud_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "gu_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_cajas: {
        Row: {
          created_at: string | null
          entidad: string | null
          id: number
          is_active: boolean | null
          moneda: Database["public"]["Enums"]["moneda_enum"]
          nombre: string
          tipo: Database["public"]["Enums"]["caja_tipo"]
        }
        Insert: {
          created_at?: string | null
          entidad?: string | null
          id?: never
          is_active?: boolean | null
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          nombre: string
          tipo: Database["public"]["Enums"]["caja_tipo"]
        }
        Update: {
          created_at?: string | null
          entidad?: string | null
          id?: never
          is_active?: boolean | null
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          nombre?: string
          tipo?: Database["public"]["Enums"]["caja_tipo"]
        }
        Relationships: []
      }
      gu_certificaciones: {
        Row: {
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_cert: string
          fecha_devengado: string | null
          id: number
          numero_cert: string | null
          observaciones: string | null
          orden_compra_id: number
          proveedor_id: number
          total_con_iva: number
          total_neto: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_cert?: string
          fecha_devengado?: string | null
          id?: never
          numero_cert?: string | null
          observaciones?: string | null
          orden_compra_id: number
          proveedor_id: number
          total_con_iva?: number
          total_neto?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_cert?: string
          fecha_devengado?: string | null
          id?: never
          numero_cert?: string | null
          observaciones?: string | null
          orden_compra_id?: number
          proveedor_id?: number
          total_con_iva?: number
          total_neto?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_certificaciones_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "gu_ordenesdecompra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_certificaciones_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "v_oc_rollup"
            referencedColumns: ["orden_compra_id"]
          },
          {
            foreignKeyName: "gu_certificaciones_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "gu_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_facturas: {
        Row: {
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_factura"]
          fecha_emision: string
          fecha_pago: string | null
          id: number
          moneda: Database["public"]["Enums"]["moneda_enum"]
          numero_comprobante: string | null
          numero_factura: string | null
          observaciones: string | null
          proveedor_id: number
          punto_venta: string | null
          total_con_iva: number
          total_facturado: number
          total_iva: number
          total_neto: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"]
          fecha_emision?: string
          fecha_pago?: string | null
          id?: never
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          numero_comprobante?: string | null
          numero_factura?: string | null
          observaciones?: string | null
          proveedor_id: number
          punto_venta?: string | null
          total_con_iva?: number
          total_facturado?: number
          total_iva?: number
          total_neto?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"]
          fecha_emision?: string
          fecha_pago?: string | null
          id?: never
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          numero_comprobante?: string | null
          numero_factura?: string | null
          observaciones?: string | null
          proveedor_id?: number
          punto_venta?: string | null
          total_con_iva?: number
          total_facturado?: number
          total_iva?: number
          total_neto?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_facturas_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "gu_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_facturas_certificaciones: {
        Row: {
          certificacion_id: number
          created_at: string | null
          factura_id: number
          id: number
          monto_asignado: number
        }
        Insert: {
          certificacion_id: number
          created_at?: string | null
          factura_id: number
          id?: never
          monto_asignado?: number
        }
        Update: {
          certificacion_id?: number
          created_at?: string | null
          factura_id?: number
          id?: never
          monto_asignado?: number
        }
        Relationships: [
          {
            foreignKeyName: "gu_facturas_certificaciones_certificacion_id_fkey"
            columns: ["certificacion_id"]
            isOneToOne: false
            referencedRelation: "gu_certificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_facturas_certificaciones_certificacion_id_fkey"
            columns: ["certificacion_id"]
            isOneToOne: false
            referencedRelation: "v_cert_rollup"
            referencedColumns: ["certificacion_id"]
          },
          {
            foreignKeyName: "gu_facturas_certificaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "gu_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_facturas_certificaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_rollup"
            referencedColumns: ["factura_id"]
          },
        ]
      }
      gu_item_proveedor_precio: {
        Row: {
          created_at: string | null
          id: number
          item_id: number
          precio: number
          proveedor_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          item_id: number
          precio?: number
          proveedor_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          item_id?: number
          precio?: number
          proveedor_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_item_proveedor_precio_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "gu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_item_proveedor_precio_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "gu_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_items: {
        Row: {
          categoria: string | null
          codigo: string
          created_at: string | null
          created_by: number | null
          descripcion: string | null
          id: number
          is_active: boolean | null
          nombre: string
          unidad_medida: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          codigo: string
          created_at?: string | null
          created_by?: number | null
          descripcion?: string | null
          id?: never
          is_active?: boolean | null
          nombre: string
          unidad_medida?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          codigo?: string
          created_at?: string | null
          created_by?: number | null
          descripcion?: string | null
          id?: never
          is_active?: boolean | null
          nombre?: string
          unidad_medida?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "gu_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_lineasdecertificacion: {
        Row: {
          avance_monto: number
          avance_porcentaje: number
          avance_unidades: number
          certificacion_id: number
          id: number
          iva_porcentaje: number
          linea_oc_id: number
          numero_lce: string | null
        }
        Insert: {
          avance_monto?: number
          avance_porcentaje?: number
          avance_unidades?: number
          certificacion_id: number
          id?: never
          iva_porcentaje?: number
          linea_oc_id: number
          numero_lce?: string | null
        }
        Update: {
          avance_monto?: number
          avance_porcentaje?: number
          avance_unidades?: number
          certificacion_id?: number
          id?: never
          iva_porcentaje?: number
          linea_oc_id?: number
          numero_lce?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_lineasdecertificacion_certificacion_id_fkey"
            columns: ["certificacion_id"]
            isOneToOne: false
            referencedRelation: "gu_certificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdecertificacion_certificacion_id_fkey"
            columns: ["certificacion_id"]
            isOneToOne: false
            referencedRelation: "v_cert_rollup"
            referencedColumns: ["certificacion_id"]
          },
          {
            foreignKeyName: "gu_lineasdecertificacion_linea_oc_id_fkey"
            columns: ["linea_oc_id"]
            isOneToOne: false
            referencedRelation: "gu_lineasdeordenesdecompra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdecertificacion_linea_oc_id_fkey"
            columns: ["linea_oc_id"]
            isOneToOne: false
            referencedRelation: "v_loc_rollup"
            referencedColumns: ["linea_oc_id"]
          },
        ]
      }
      gu_lineasdefactura: {
        Row: {
          cantidad: number
          descripcion: string
          factura_id: number
          id: number
          iva_porcentaje: number
          precio_unitario: number
          total_con_iva: number
          total_neto: number
        }
        Insert: {
          cantidad?: number
          descripcion: string
          factura_id: number
          id?: never
          iva_porcentaje?: number
          precio_unitario?: number
          total_con_iva?: number
          total_neto?: number
        }
        Update: {
          cantidad?: number
          descripcion?: string
          factura_id?: number
          id?: never
          iva_porcentaje?: number
          precio_unitario?: number
          total_con_iva?: number
          total_neto?: number
        }
        Relationships: [
          {
            foreignKeyName: "gu_lineasdefactura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "gu_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdefactura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_rollup"
            referencedColumns: ["factura_id"]
          },
        ]
      }
      gu_lineasdeordenesdecompra: {
        Row: {
          cantidad: number
          descripcion: string
          id: number
          item_id: number
          iva_porcentaje: number
          numero_loc: string | null
          orden_compra_id: number
          precio_unitario_neto: number
          total_con_iva: number
          total_neto: number
          unidad_medida: string | null
        }
        Insert: {
          cantidad?: number
          descripcion: string
          id?: never
          item_id: number
          iva_porcentaje?: number
          numero_loc?: string | null
          orden_compra_id: number
          precio_unitario_neto?: number
          total_con_iva?: number
          total_neto?: number
          unidad_medida?: string | null
        }
        Update: {
          cantidad?: number
          descripcion?: string
          id?: never
          item_id?: number
          iva_porcentaje?: number
          numero_loc?: string | null
          orden_compra_id?: number
          precio_unitario_neto?: number
          total_con_iva?: number
          total_neto?: number
          unidad_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_lineasdeordenesdecompra_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "gu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdeordenesdecompra_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "gu_ordenesdecompra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdeordenesdecompra_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "v_oc_rollup"
            referencedColumns: ["orden_compra_id"]
          },
        ]
      }
      gu_lineasdeordenesdepago: {
        Row: {
          factura_id: number
          id: number
          monto: number
          orden_pago_id: number
        }
        Insert: {
          factura_id: number
          id?: never
          monto?: number
          orden_pago_id: number
        }
        Update: {
          factura_id?: number
          id?: never
          monto?: number
          orden_pago_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gu_lineasdeordenesdepago_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "gu_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdeordenesdepago_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_rollup"
            referencedColumns: ["factura_id"]
          },
          {
            foreignKeyName: "gu_lineasdeordenesdepago_orden_pago_id_fkey"
            columns: ["orden_pago_id"]
            isOneToOne: false
            referencedRelation: "gu_ordenesdepago"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_lineasdeordenesdepagocaja: {
        Row: {
          caja_id: number
          id: number
          monto: number
          orden_pago_id: number
        }
        Insert: {
          caja_id: number
          id?: never
          monto?: number
          orden_pago_id: number
        }
        Update: {
          caja_id?: number
          id?: never
          monto?: number
          orden_pago_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gu_lineasdeordenesdepagocaja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "gu_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdeordenesdepagocaja_orden_pago_id_fkey"
            columns: ["orden_pago_id"]
            isOneToOne: false
            referencedRelation: "gu_ordenesdepago"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_ordenesdecompra: {
        Row: {
          created_at: string | null
          created_by: number | null
          estado: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_oc: string
          id: number
          moneda: Database["public"]["Enums"]["moneda_enum"]
          numero_oc: string | null
          observaciones: string | null
          proveedor_id: number
          proyecto_id: number | null
          tarea: string | null
          total_con_iva: number
          total_iva: number
          total_neto: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: number | null
          estado?: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_oc?: string
          id?: never
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          numero_oc?: string | null
          observaciones?: string | null
          proveedor_id: number
          proyecto_id?: number | null
          tarea?: string | null
          total_con_iva?: number
          total_iva?: number
          total_neto?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: number | null
          estado?: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_oc?: string
          id?: never
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          numero_oc?: string | null
          observaciones?: string | null
          proveedor_id?: number
          proyecto_id?: number | null
          tarea?: string | null
          total_con_iva?: number
          total_iva?: number
          total_neto?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_ordenesdecompra_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "gu_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_ordenesdecompra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "gu_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_ordenesdecompra_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "gu_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_ordenesdepago: {
        Row: {
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_op"]
          fecha_op: string
          id: number
          moneda: Database["public"]["Enums"]["moneda_enum"]
          numero_op: string | null
          observaciones: string | null
          proveedor_id: number
          total_a_pagar: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_op"]
          fecha_op?: string
          id?: never
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          numero_op?: string | null
          observaciones?: string | null
          proveedor_id: number
          total_a_pagar?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_op"]
          fecha_op?: string
          id?: never
          moneda?: Database["public"]["Enums"]["moneda_enum"]
          numero_op?: string | null
          observaciones?: string | null
          proveedor_id?: number
          total_a_pagar?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_ordenesdepago_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "gu_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      gu_proveedores: {
        Row: {
          condicion_iva: string | null
          created_at: string | null
          cuit: string | null
          direccion: string | null
          email: string | null
          estado: Database["public"]["Enums"]["estado_activo_inactivo"] | null
          id: number
          nombre: string
          telefono: string | null
        }
        Insert: {
          condicion_iva?: string | null
          created_at?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          estado?: Database["public"]["Enums"]["estado_activo_inactivo"] | null
          id?: never
          nombre: string
          telefono?: string | null
        }
        Update: {
          condicion_iva?: string | null
          created_at?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          estado?: Database["public"]["Enums"]["estado_activo_inactivo"] | null
          id?: never
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      gu_proyectos: {
        Row: {
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["proyecto_estado"] | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          nombre: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["proyecto_estado"] | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: never
          nombre: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["proyecto_estado"] | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      gu_roles: {
        Row: {
          creado_en: string | null
          descripcion: string | null
          id: number
          nombre: string
          permisos: string[]
        }
        Insert: {
          creado_en?: string | null
          descripcion?: string | null
          id?: never
          nombre: string
          permisos?: string[]
        }
        Update: {
          creado_en?: string | null
          descripcion?: string | null
          id?: never
          nombre?: string
          permisos?: string[]
        }
        Relationships: []
      }
      gu_usuario: {
        Row: {
          created_at: string | null
          email: string
          estado: Database["public"]["Enums"]["estado_activo_inactivo"] | null
          id: number
          nombre: string
          password_hash: string
          rol_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          estado?: Database["public"]["Enums"]["estado_activo_inactivo"] | null
          id?: never
          nombre: string
          password_hash: string
          rol_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          estado?: Database["public"]["Enums"]["estado_activo_inactivo"] | null
          id?: never
          nombre?: string
          password_hash?: string
          rol_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_gu_usuario_rol"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "gu_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cert_rollup: {
        Row: {
          certificacion_id: number | null
          estado_facturacion:
            | Database["public"]["Enums"]["estado_rollup"]
            | null
          monto_facturado: number | null
          total_con_iva: number | null
        }
        Relationships: []
      }
      v_factura_rollup: {
        Row: {
          estado_pago: Database["public"]["Enums"]["estado_rollup"] | null
          factura_id: number | null
          monto_pagado: number | null
          total_facturado: number | null
        }
        Relationships: []
      }
      v_loc_rollup: {
        Row: {
          cantidad: number | null
          estado_certificacion:
            | Database["public"]["Enums"]["estado_rollup"]
            | null
          linea_oc_id: number | null
          monto_pendiente: number | null
          orden_compra_id: number | null
          unidades_certificadas: number | null
          unidades_pendientes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gu_lineasdeordenesdecompra_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "gu_ordenesdecompra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gu_lineasdeordenesdecompra_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "v_oc_rollup"
            referencedColumns: ["orden_compra_id"]
          },
        ]
      }
      v_oc_rollup: {
        Row: {
          estado_certificacion:
            | Database["public"]["Enums"]["estado_rollup"]
            | null
          monto_pendiente_certificar: number | null
          orden_compra_id: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_accion: "crear" | "actualizar" | "eliminar"
      caja_tipo: "banco" | "efectivo" | "cheque" | "transferencia"
      estado_activo_inactivo: "activo" | "inactivo"
      estado_aprobacion:
        | "borrador"
        | "en_aprobacion"
        | "aprobado"
        | "rechazado"
        | "anulado"
      estado_factura: "borrador" | "finalizado" | "anulado"
      estado_op:
        | "borrador"
        | "en_aprobacion"
        | "aprobado"
        | "pagado"
        | "rechazado"
        | "anulado"
      estado_rollup: "sin" | "parcial" | "total"
      moneda_enum: "ARS" | "USD" | "EUR"
      proyecto_estado:
        | "planificado"
        | "en_ejecucion"
        | "finalizado"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_accion: ["crear", "actualizar", "eliminar"],
      caja_tipo: ["banco", "efectivo", "cheque", "transferencia"],
      estado_activo_inactivo: ["activo", "inactivo"],
      estado_aprobacion: [
        "borrador",
        "en_aprobacion",
        "aprobado",
        "rechazado",
        "anulado",
      ],
      estado_factura: ["borrador", "finalizado", "anulado"],
      estado_op: [
        "borrador",
        "en_aprobacion",
        "aprobado",
        "pagado",
        "rechazado",
        "anulado",
      ],
      estado_rollup: ["sin", "parcial", "total"],
      moneda_enum: ["ARS", "USD", "EUR"],
      proyecto_estado: [
        "planificado",
        "en_ejecucion",
        "finalizado",
        "cancelado",
      ],
    },
  },
} as const
