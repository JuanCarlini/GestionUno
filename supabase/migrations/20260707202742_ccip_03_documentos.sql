-- ORDEN DE COMPRA
CREATE TABLE public.gu_ordenesdecompra (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_oc varchar(30) UNIQUE,
  proveedor_id bigint NOT NULL REFERENCES public.gu_proveedores(id),
  proyecto_id bigint REFERENCES public.gu_proyectos(id),
  moneda public.moneda_enum NOT NULL DEFAULT 'ARS',
  tarea text,
  fecha_oc date NOT NULL DEFAULT current_date,
  total_neto numeric(14,2) NOT NULL DEFAULT 0,
  total_iva numeric(14,2) NOT NULL DEFAULT 0,
  total_con_iva numeric(14,2) NOT NULL DEFAULT 0,
  estado public.estado_aprobacion NOT NULL DEFAULT 'borrador',
  observaciones text,
  created_by bigint REFERENCES public.gu_usuario(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_oc_proveedor ON public.gu_ordenesdecompra (proveedor_id);
CREATE INDEX idx_oc_estado ON public.gu_ordenesdecompra (estado);
CREATE TRIGGER trg_oc_updated BEFORE UPDATE ON public.gu_ordenesdecompra FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- LÍNEAS DE OC (LOC): cada línea elige un item del catálogo
CREATE TABLE public.gu_lineasdeordenesdecompra (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_compra_id bigint NOT NULL REFERENCES public.gu_ordenesdecompra(id) ON DELETE CASCADE,
  numero_loc varchar(40),
  item_id bigint NOT NULL REFERENCES public.gu_items(id),
  descripcion text NOT NULL,
  cantidad numeric(14,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  unidad_medida varchar(50),
  precio_unitario_neto numeric(14,2) NOT NULL DEFAULT 0,
  iva_porcentaje numeric(5,2) NOT NULL DEFAULT 21,
  total_neto numeric(14,2) NOT NULL DEFAULT 0,
  total_con_iva numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_loc_oc ON public.gu_lineasdeordenesdecompra (orden_compra_id);
CREATE INDEX idx_loc_item ON public.gu_lineasdeordenesdecompra (item_id);

-- CERTIFICACIÓN (CE): cuelga de UNA OC
CREATE TABLE public.gu_certificaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_cert varchar(40) UNIQUE,
  orden_compra_id bigint NOT NULL REFERENCES public.gu_ordenesdecompra(id),
  proveedor_id bigint NOT NULL REFERENCES public.gu_proveedores(id),
  fecha_cert date NOT NULL DEFAULT current_date,
  fecha_devengado date,
  total_neto numeric(14,2) NOT NULL DEFAULT 0,
  total_con_iva numeric(14,2) NOT NULL DEFAULT 0,
  estado public.estado_aprobacion NOT NULL DEFAULT 'borrador',
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_cert_oc ON public.gu_certificaciones (orden_compra_id);
CREATE INDEX idx_cert_estado ON public.gu_certificaciones (estado);
CREATE TRIGGER trg_cert_updated BEFORE UPDATE ON public.gu_certificaciones FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- LÍNEAS DE CERTIFICACIÓN (LCE): referencian una LOC; avance en unidades (deriva $ y %)
CREATE TABLE public.gu_lineasdecertificacion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certificacion_id bigint NOT NULL REFERENCES public.gu_certificaciones(id) ON DELETE CASCADE,
  numero_lce varchar(50),
  linea_oc_id bigint NOT NULL REFERENCES public.gu_lineasdeordenesdecompra(id),
  avance_unidades numeric(14,2) NOT NULL DEFAULT 0 CHECK (avance_unidades > 0),
  avance_monto numeric(14,2) NOT NULL DEFAULT 0,
  avance_porcentaje numeric(7,4) NOT NULL DEFAULT 0,
  iva_porcentaje numeric(5,2) NOT NULL DEFAULT 21
);
CREATE INDEX idx_lce_cert ON public.gu_lineasdecertificacion (certificacion_id);
CREATE INDEX idx_lce_loc ON public.gu_lineasdecertificacion (linea_oc_id);

-- FACTURA (FACT)
CREATE TABLE public.gu_facturas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_factura varchar(30) UNIQUE,
  numero_comprobante varchar(50),
  punto_venta varchar(10),
  proveedor_id bigint NOT NULL REFERENCES public.gu_proveedores(id),
  moneda public.moneda_enum NOT NULL DEFAULT 'ARS',
  fecha_emision date NOT NULL DEFAULT current_date,
  fecha_pago date,
  total_neto numeric(14,2) NOT NULL DEFAULT 0,
  total_iva numeric(14,2) NOT NULL DEFAULT 0,
  total_con_iva numeric(14,2) NOT NULL DEFAULT 0,
  total_facturado numeric(14,2) NOT NULL DEFAULT 0,
  estado public.estado_factura NOT NULL DEFAULT 'borrador',
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_fact_proveedor ON public.gu_facturas (proveedor_id);
CREATE INDEX idx_fact_estado ON public.gu_facturas (estado);
CREATE TRIGGER trg_fact_updated BEFORE UPDATE ON public.gu_facturas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- LÍNEAS DE FACTURA (LFACT): detalle del comprobante del proveedor
CREATE TABLE public.gu_lineasdefactura (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  factura_id bigint NOT NULL REFERENCES public.gu_facturas(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  cantidad numeric(14,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  iva_porcentaje numeric(5,2) NOT NULL DEFAULT 21,
  total_neto numeric(14,2) NOT NULL DEFAULT 0,
  total_con_iva numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_lfact_fact ON public.gu_lineasdefactura (factura_id);

-- IMPUTACIÓN FACTURA -> CERTIFICACIÓN (N:M con monto asignado)
CREATE TABLE public.gu_facturas_certificaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  factura_id bigint NOT NULL REFERENCES public.gu_facturas(id) ON DELETE CASCADE,
  certificacion_id bigint NOT NULL REFERENCES public.gu_certificaciones(id),
  monto_asignado numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (factura_id, certificacion_id)
);
CREATE INDEX idx_factcert_fact ON public.gu_facturas_certificaciones (factura_id);
CREATE INDEX idx_factcert_cert ON public.gu_facturas_certificaciones (certificacion_id);

-- ORDEN DE PAGO (OP)
CREATE TABLE public.gu_ordenesdepago (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_op varchar(30) UNIQUE,
  proveedor_id bigint NOT NULL REFERENCES public.gu_proveedores(id),
  moneda public.moneda_enum NOT NULL DEFAULT 'ARS',
  fecha_op date NOT NULL DEFAULT current_date,
  total_a_pagar numeric(14,2) NOT NULL DEFAULT 0,
  estado public.estado_op NOT NULL DEFAULT 'borrador',
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_op_proveedor ON public.gu_ordenesdepago (proveedor_id);
CREATE INDEX idx_op_estado ON public.gu_ordenesdepago (estado);
CREATE TRIGGER trg_op_updated BEFORE UPDATE ON public.gu_ordenesdepago FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- LÍNEAS DE OP (LOP): facturas que paga (solo finalizadas)
CREATE TABLE public.gu_lineasdeordenesdepago (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_pago_id bigint NOT NULL REFERENCES public.gu_ordenesdepago(id) ON DELETE CASCADE,
  factura_id bigint NOT NULL REFERENCES public.gu_facturas(id),
  monto numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE (orden_pago_id, factura_id)
);
CREATE INDEX idx_lop_op ON public.gu_lineasdeordenesdepago (orden_pago_id);

-- LÍNEAS DE CAJA DE LA OP (LOPcaja): reparto del pago entre cajas del catálogo
CREATE TABLE public.gu_lineasdeordenesdepagocaja (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_pago_id bigint NOT NULL REFERENCES public.gu_ordenesdepago(id) ON DELETE CASCADE,
  caja_id bigint NOT NULL REFERENCES public.gu_cajas(id),
  monto numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_lopcaja_op ON public.gu_lineasdeordenesdepagocaja (orden_pago_id);