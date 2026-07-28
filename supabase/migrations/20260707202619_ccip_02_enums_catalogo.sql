-- Enums uniformes del rediseño
CREATE TYPE public.estado_aprobacion AS ENUM ('borrador','en_aprobacion','aprobado','rechazado','anulado');
CREATE TYPE public.estado_factura AS ENUM ('borrador','finalizado','anulado');
CREATE TYPE public.estado_op AS ENUM ('borrador','en_aprobacion','aprobado','pagado','rechazado','anulado');
CREATE TYPE public.estado_rollup AS ENUM ('sin','parcial','total');
CREATE TYPE public.caja_tipo AS ENUM ('banco','efectivo','cheque','transferencia');

-- helper updated_at
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Proveedor: dato fiscal opcional
ALTER TABLE public.gu_proveedores ADD COLUMN IF NOT EXISTS condicion_iva varchar(50);

-- Catálogo de items (agnóstico al proveedor; el precio vive en la puente)
CREATE TABLE public.gu_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(30) NOT NULL UNIQUE,
  nombre varchar(200) NOT NULL,
  descripcion text,
  unidad_medida varchar(50),
  categoria varchar(100),
  is_active boolean DEFAULT true,
  created_by bigint REFERENCES public.gu_usuario(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON public.gu_items FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Lista de precios por proveedor (item x proveedor -> precio); se arma al vuelo desde la línea de OC
CREATE TABLE public.gu_item_proveedor_precio (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES public.gu_items(id) ON DELETE CASCADE,
  proveedor_id bigint NOT NULL REFERENCES public.gu_proveedores(id),
  precio numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (item_id, proveedor_id)
);
CREATE INDEX idx_ipp_proveedor ON public.gu_item_proveedor_precio (proveedor_id);
CREATE INDEX idx_ipp_item ON public.gu_item_proveedor_precio (item_id);
CREATE TRIGGER trg_ipp_updated BEFORE UPDATE ON public.gu_item_proveedor_precio FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Catálogo de cajas (medios de pago) — lo carga el admin
CREATE TABLE public.gu_cajas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  tipo public.caja_tipo NOT NULL,
  entidad varchar(100),
  moneda public.moneda_enum NOT NULL DEFAULT 'ARS',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);