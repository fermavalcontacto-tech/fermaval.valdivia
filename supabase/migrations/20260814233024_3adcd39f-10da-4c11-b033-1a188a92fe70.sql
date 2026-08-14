-- ============ BOBINAS ============
CREATE TABLE public.bobinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor text NOT NULL,
  color_id uuid REFERENCES public.colores(id),
  color_nombre text,
  metros_comprados numeric NOT NULL CHECK (metros_comprados > 0),
  metros_utiles numeric NOT NULL DEFAULT 0,
  metros_perdida numeric NOT NULL DEFAULT 0,
  saldo_m numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  costo_m2 numeric NOT NULL DEFAULT 0,
  fecha_ingreso date NOT NULL DEFAULT CURRENT_DATE,
  egreso_id uuid REFERENCES public.solicitudes_egreso(id) ON DELETE SET NULL,
  nota text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bobinas TO authenticated;
GRANT ALL ON public.bobinas TO service_role;
ALTER TABLE public.bobinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_bobinas" ON public.bobinas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff_insert_bobinas" ON public.bobinas FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff_update_bobinas" ON public.bobinas FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "admin_delete_bobinas" ON public.bobinas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX bobinas_color_fifo_idx ON public.bobinas (color_id, fecha_ingreso, created_at);

CREATE TRIGGER bobinas_touch BEFORE UPDATE ON public.bobinas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_bobinas AFTER INSERT OR UPDATE OR DELETE ON public.bobinas
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row();

-- ============ CONSUMOS ============
CREATE TABLE public.bobina_consumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bobina_id uuid NOT NULL REFERENCES public.bobinas(id) ON DELETE CASCADE,
  cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  cotizacion_item_id uuid REFERENCES public.cotizacion_items(id) ON DELETE SET NULL,
  metros numeric NOT NULL,
  costo_m2_snapshot numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT 'Consumo por cotización',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bobina_consumos TO authenticated;
GRANT ALL ON public.bobina_consumos TO service_role;
ALTER TABLE public.bobina_consumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_consumos" ON public.bobina_consumos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff_insert_consumos" ON public.bobina_consumos FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX bobina_consumos_bobina_idx ON public.bobina_consumos (bobina_id);
CREATE INDEX bobina_consumos_cot_idx ON public.bobina_consumos (cotizacion_id);

-- ============ EGRESOS: proveedor / valor / bobina ============
ALTER TABLE public.solicitudes_egreso
  ADD COLUMN IF NOT EXISTS proveedor text,
  ADD COLUMN IF NOT EXISTS valor numeric,
  ADD COLUMN IF NOT EXISTS bobina_color_id uuid REFERENCES public.colores(id),
  ADD COLUMN IF NOT EXISTS bobina_metros numeric;

-- ============ ITEMS: bobina asignada ============
ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS bobina_id uuid REFERENCES public.bobinas(id) ON DELETE SET NULL;

-- ============ CREAR BOBINA (99% util / 1% merma) ============
CREATE OR REPLACE FUNCTION public.crear_bobina(
  _proveedor text,
  _color_id uuid,
  _metros numeric,
  _valor numeric,
  _fecha date DEFAULT CURRENT_DATE,
  _egreso_id uuid DEFAULT NULL,
  _nota text DEFAULT NULL,
  _created_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_utiles numeric := round(_metros * 0.99, 2);
  v_perdida numeric := round(_metros * 0.01, 2);
  v_costo numeric := CASE WHEN v_utiles > 0 THEN round(COALESCE(_valor,0) / v_utiles, 2) ELSE 0 END;
  v_color text;
  v_id uuid;
BEGIN
  SELECT nombre INTO v_color FROM public.colores WHERE id = _color_id;

  INSERT INTO public.bobinas (
    proveedor, color_id, color_nombre, metros_comprados, metros_utiles, metros_perdida,
    saldo_m, valor_total, costo_m2, fecha_ingreso, egreso_id, nota, created_by
  ) VALUES (
    _proveedor, _color_id, v_color, _metros, v_utiles, v_perdida,
    v_utiles, COALESCE(_valor,0), v_costo, COALESCE(_fecha, CURRENT_DATE), _egreso_id, _nota, _created_by
  ) RETURNING id INTO v_id;

  IF _color_id IS NOT NULL THEN
    UPDATE public.colores SET stock_m = COALESCE(stock_m,0) + v_utiles WHERE id = _color_id;

    INSERT INTO public.stock_movimientos (color_id, color_nombre, metros, motivo, user_id)
    VALUES (_color_id, v_color, v_utiles,
      format('Ingreso bobina %s (%s m comprados, 1%% merma = %s m)', _proveedor, _metros, v_perdida),
      _created_by);
  END IF;

  RETURN v_id;
END;
$$;

-- ============ TRIGGER: egreso aprobado -> bobina ============
CREATE OR REPLACE FUNCTION public.trg_egreso_aprobado_bobina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estado = 'aprobado' AND COALESCE(OLD.estado::text,'') <> 'aprobado'
     AND NEW.bobina_metros IS NOT NULL AND NEW.bobina_metros > 0
     AND NEW.bobina_color_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bobinas WHERE egreso_id = NEW.id) THEN
    PERFORM public.crear_bobina(
      COALESCE(NEW.proveedor, 'Proveedor sin nombre'),
      NEW.bobina_color_id,
      NEW.bobina_metros,
      COALESCE(NEW.valor, NEW.monto),
      NEW.fecha,
      NEW.id,
      NEW.descripcion,
      NEW.decidido_por
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER egreso_aprobado_bobina AFTER UPDATE ON public.solicitudes_egreso
  FOR EACH ROW EXECUTE FUNCTION public.trg_egreso_aprobado_bobina();

-- ============ CONSUMO FIFO ============
CREATE OR REPLACE FUNCTION public.consumir_stock_fifo(
  _color_id uuid,
  _metros numeric,
  _cotizacion_id uuid DEFAULT NULL,
  _item_id uuid DEFAULT NULL,
  _bobina_preferida uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_restante numeric := _metros;
  v_costo_total numeric := 0;
  v_consumido numeric := 0;
  r RECORD;
  v_take numeric;
BEGIN
  IF _color_id IS NULL OR COALESCE(_metros,0) <= 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT id, saldo_m, costo_m2
    FROM public.bobinas
    WHERE color_id = _color_id AND saldo_m > 0
    ORDER BY (id = _bobina_preferida) DESC, fecha_ingreso ASC, created_at ASC
  LOOP
    EXIT WHEN v_restante <= 0;
    v_take := LEAST(r.saldo_m, v_restante);
    UPDATE public.bobinas SET saldo_m = saldo_m - v_take WHERE id = r.id;
    INSERT INTO public.bobina_consumos (bobina_id, cotizacion_id, cotizacion_item_id, metros, costo_m2_snapshot)
    VALUES (r.id, _cotizacion_id, _item_id, v_take, r.costo_m2);
    v_costo_total := v_costo_total + (v_take * r.costo_m2);
    v_consumido := v_consumido + v_take;
    v_restante := v_restante - v_take;
  END LOOP;

  IF v_consumido > 0 THEN
    RETURN round(v_costo_total / v_consumido, 2);
  END IF;
  RETURN 0;
END;
$$;

-- ============ VISTA DE PERDIDAS ============
CREATE OR REPLACE VIEW public.v_perdidas_m2
WITH (security_invoker = true)
AS
SELECT
  date_trunc('month', b.fecha_ingreso)::date AS periodo,
  b.color_nombre,
  b.proveedor,
  SUM(b.metros_perdida) AS metros_perdida,
  SUM(b.metros_perdida) AS m2_perdida,
  SUM(b.metros_perdida * b.costo_m2) AS costo_perdida
FROM public.bobinas b
GROUP BY 1, 2, 3;

GRANT SELECT ON public.v_perdidas_m2 TO authenticated;
GRANT SELECT ON public.v_perdidas_m2 TO service_role;
