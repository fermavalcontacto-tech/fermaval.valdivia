ALTER TABLE public.apu_m2 ADD COLUMN material_desde_bobina boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_apu_desde_bobinas(_periodo date, _color_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_costo numeric; t public.tipo_producto;
BEGIN
  IF _color_id IS NULL THEN RETURN; END IF;
  SELECT CASE WHEN SUM(metros_utiles) > 0 THEN round(SUM(valor_total)/SUM(metros_utiles), 2) END INTO v_costo
  FROM public.bobinas WHERE color_id = _color_id AND date_trunc('month', fecha_ingreso) = date_trunc('month', _periodo);
  IF v_costo IS NULL THEN RETURN; END IF;
  FOREACH t IN ARRAY enum_range(NULL::public.tipo_producto) LOOP
    INSERT INTO public.apu_m2 (periodo, tipo, color_id, costo_material, material_desde_bobina)
    VALUES (date_trunc('month', _periodo)::date, t, _color_id, v_costo, true)
    ON CONFLICT (periodo, tipo, color_id) DO UPDATE
      SET costo_material = EXCLUDED.costo_material, material_desde_bobina = true
      WHERE public.apu_m2.material_desde_bobina OR public.apu_m2.costo_material = 0;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.sync_apu_desde_bobinas(date, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_bobina_sync_apu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.sync_apu_desde_bobinas(NEW.fecha_ingreso, NEW.color_id);
  IF TG_OP = 'UPDATE' AND (OLD.color_id IS DISTINCT FROM NEW.color_id OR date_trunc('month',OLD.fecha_ingreso) <> date_trunc('month',NEW.fecha_ingreso)) THEN
    PERFORM public.sync_apu_desde_bobinas(OLD.fecha_ingreso, OLD.color_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER bobina_sync_apu AFTER INSERT OR UPDATE OF color_id, valor_total, metros_utiles, fecha_ingreso ON public.bobinas
FOR EACH ROW EXECUTE FUNCTION public.trg_bobina_sync_apu();