ALTER TABLE public.bobinas
  ADD COLUMN IF NOT EXISTS metros_defectuosos numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.crear_bobina(
  _proveedor text,
  _color_id uuid,
  _metros numeric,
  _valor numeric,
  _fecha date DEFAULT CURRENT_DATE,
  _egreso_id uuid DEFAULT NULL::uuid,
  _nota text DEFAULT NULL::text,
  _created_by uuid DEFAULT NULL::uuid,
  _defectuosos numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_def numeric := LEAST(GREATEST(COALESCE(_defectuosos, 0), 0), _metros);
  v_merma numeric := round(_metros * 0.01, 2);
  v_utiles numeric := GREATEST(round(_metros - v_merma - v_def, 2), 0);
  v_perdida numeric := round(v_merma + v_def, 2);
  v_costo numeric := CASE WHEN v_utiles > 0 THEN round(COALESCE(_valor,0) / v_utiles, 2) ELSE 0 END;
  v_color text;
  v_id uuid;
BEGIN
  SELECT nombre INTO v_color FROM public.colores WHERE id = _color_id;

  INSERT INTO public.bobinas (
    proveedor, color_id, color_nombre, metros_comprados, metros_utiles, metros_perdida,
    metros_defectuosos, saldo_m, valor_total, costo_m2, fecha_ingreso, egreso_id, nota, created_by
  ) VALUES (
    _proveedor, _color_id, v_color, _metros, v_utiles, v_perdida,
    v_def, v_utiles, COALESCE(_valor,0), v_costo, COALESCE(_fecha, CURRENT_DATE), _egreso_id, _nota, _created_by
  ) RETURNING id INTO v_id;

  IF _color_id IS NOT NULL THEN
    UPDATE public.colores SET stock_m = COALESCE(stock_m,0) + v_utiles WHERE id = _color_id;

    INSERT INTO public.stock_movimientos (color_id, color_nombre, metros, motivo, user_id)
    VALUES (_color_id, v_color, v_utiles,
      format('Ingreso bobina %s (%s m comprados, 1%% merma = %s m, defectuosos = %s m)', _proveedor, _metros, v_merma, v_def),
      _created_by);
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_bobina(text, uuid, numeric, numeric, date, uuid, text, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_bobina(text, uuid, numeric, numeric, date, uuid, text, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.ajustar_defectuosos_bobina(
  _bobina_id uuid,
  _defectuosos numeric,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b public.bobinas;
  v_def numeric;
  v_merma numeric;
  v_utiles_new numeric;
  v_consumido numeric;
  v_saldo_new numeric;
  v_costo numeric;
  v_delta numeric;
BEGIN
  SELECT * INTO b FROM public.bobinas WHERE id = _bobina_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Bobina no encontrada'; END IF;

  v_merma := round(b.metros_comprados * 0.01, 2);
  v_consumido := GREATEST(round(b.metros_utiles - b.saldo_m, 2), 0);
  v_def := LEAST(GREATEST(COALESCE(_defectuosos, 0), 0), GREATEST(b.metros_comprados - v_merma - v_consumido, 0));
  v_utiles_new := GREATEST(round(b.metros_comprados - v_merma - v_def, 2), 0);
  v_saldo_new := GREATEST(round(v_utiles_new - v_consumido, 2), 0);
  v_costo := CASE WHEN v_utiles_new > 0 THEN round(COALESCE(b.valor_total,0) / v_utiles_new, 2) ELSE 0 END;
  v_delta := round(v_utiles_new - b.metros_utiles, 2);

  UPDATE public.bobinas SET
    metros_defectuosos = v_def,
    metros_utiles = v_utiles_new,
    metros_perdida = round(v_merma + v_def, 2),
    saldo_m = v_saldo_new,
    costo_m2 = v_costo,
    updated_at = now()
  WHERE id = _bobina_id;

  IF b.color_id IS NOT NULL AND v_delta <> 0 THEN
    UPDATE public.colores SET stock_m = GREATEST(COALESCE(stock_m,0) + v_delta, 0) WHERE id = b.color_id;

    INSERT INTO public.stock_movimientos (color_id, color_nombre, metros, motivo, user_id)
    VALUES (b.color_id, b.color_nombre, v_delta,
      format('Ajuste metros defectuosos bobina %s (defectuosos = %s m)', b.proveedor, v_def),
      _user_id);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.ajustar_defectuosos_bobina(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_defectuosos_bobina(uuid, numeric, uuid) TO service_role;