
-- =========================================================
-- FASE 1: Variantes auto-gestionadas + auditoría
-- Aditiva, no destructiva. Sin DELETE ni UPDATE de negocio.
-- =========================================================

-- 1) ensure_variant: devuelve variante existente o la crea con stock 0
CREATE OR REPLACE FUNCTION public.ensure_variant(
  _tipo text,
  _color_id uuid,
  _espesor_mm numeric DEFAULT 0.4
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo public.tipo_producto;
  v_id uuid;
BEGIN
  IF _color_id IS NULL THEN
    RETURN NULL;
  END IF;
  v_tipo := COALESCE(NULLIF(trim(_tipo), ''), 'Ondulado')::public.tipo_producto;

  SELECT id INTO v_id
    FROM public.producto_variantes
   WHERE tipo = v_tipo
     AND color_id = _color_id
     AND espesor_mm = COALESCE(_espesor_mm, 0.4)
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.producto_variantes (tipo, color_id, espesor_mm, activo, fabricado_m)
  VALUES (v_tipo, _color_id, COALESCE(_espesor_mm, 0.4), true, 0)
  ON CONFLICT (tipo, color_id, espesor_mm) DO UPDATE
    SET activo = true, updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_variant(text, uuid, numeric) TO authenticated, service_role, anon;

-- 2) Trigger BEFORE INSERT en cotizacion_items: autocompleta variante_id
CREATE OR REPLACE FUNCTION public.trg_fill_variante_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.variante_id IS NULL AND NEW.color_id IS NOT NULL THEN
    NEW.variante_id := public.ensure_variant(NEW.tipo::text, NEW.color_id, NEW.espesor_mm);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizacion_item_variant ON public.cotizacion_items;
CREATE TRIGGER trg_cotizacion_item_variant
  BEFORE INSERT OR UPDATE ON public.cotizacion_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_fill_variante_id();

-- 3) Trigger AFTER INSERT en colores: crear variantes para todos los tipos existentes
CREATE OR REPLACE FUNCTION public.trg_autogen_variants_for_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_tipo text;
BEGIN
  FOREACH t_tipo IN ARRAY ARRAY['Ondulado','PV8','PV8 Invertido','Microondulado','6V','PV4','Lata Lisa']
  LOOP
    PERFORM public.ensure_variant(t_tipo, NEW.id, 0.4);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_color_autogen_variants ON public.colores;
CREATE TRIGGER trg_color_autogen_variants
  AFTER INSERT ON public.colores
  FOR EACH ROW EXECUTE FUNCTION public.trg_autogen_variants_for_color();

-- 4) Backfill: crear variantes faltantes para combinaciones ya usadas
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ci.tipo::text AS tipo, ci.color_id, ci.espesor_mm
      FROM public.cotizacion_items ci
     WHERE ci.color_id IS NOT NULL
  LOOP
    PERFORM public.ensure_variant(r.tipo, r.color_id, r.espesor_mm);
  END LOOP;

  -- Backfill para todos los colores activos × todos los tipos con espesor 0.4
  FOR r IN
    SELECT c.id AS color_id, t.tipo
      FROM public.colores c
     CROSS JOIN (VALUES ('Ondulado'),('PV8'),('PV8 Invertido'),('Microondulado'),('6V'),('PV4'),('Lata Lisa')) t(tipo)
     WHERE c.activo = true
  LOOP
    PERFORM public.ensure_variant(r.tipo, r.color_id, 0.4);
  END LOOP;
END;
$$;

-- 5) Rellenar variante_id en cotizacion_items históricos
UPDATE public.cotizacion_items ci
   SET variante_id = pv.id
  FROM public.producto_variantes pv
 WHERE ci.variante_id IS NULL
   AND ci.color_id IS NOT NULL
   AND pv.tipo = ci.tipo
   AND pv.color_id = ci.color_id
   AND pv.espesor_mm = ci.espesor_mm;

-- 6) Tabla de auditoría
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_email text,
  rol text,
  accion text NOT NULL,
  tabla text NOT NULL,
  registro_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log admin read" ON public.audit_log;
CREATE POLICY "audit_log admin read"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON public.audit_log(tabla, registro_id);
