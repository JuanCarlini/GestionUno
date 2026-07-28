-- Rediseño del circuito: rearmar sus tablas. Se conservan auth/roles/usuarios,
-- auditoría (gu_auditoria, gu_audit_log), proyectos y proveedores.
DROP TABLE IF EXISTS
  public.gu_lineasdeordenesdepagocaja,
  public.gu_lineasdeordenesdepago,
  public.gu_ordenesdepago,
  public.gu_facturas_certificaciones,
  public.gu_lineasdefactura,
  public.gu_facturas,
  public.gu_lineasdecertificacion,
  public.gu_certificaciones,
  public.gu_lineasdeordenesdecompra,
  public.gu_ordenesdecompra,
  public.gu_items
CASCADE;

-- Enums usados solo por el circuito (se reemplazan por un set uniforme).
DROP TYPE IF EXISTS public.oc_estado, public.linea_estado, public.cert_estado,
  public.factura_estado, public.op_estado, public.forma_pago_enum;

-- La función de la regla del 100% se reescribe más adelante (por unidades).
DROP FUNCTION IF EXISTS public.check_certificacion_max_100() CASCADE;