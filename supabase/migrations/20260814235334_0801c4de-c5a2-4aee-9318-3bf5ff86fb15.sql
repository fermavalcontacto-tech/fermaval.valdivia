-- 1. costos_m2: proveedor + bobina, varios por mes
ALTER TABLE public.costos_m2 ADD COLUMN IF NOT EXISTS proveedor text NOT NULL DEFAULT '';
ALTER TABLE public.costos_m2 ADD COLUMN IF NOT EXISTS bobina_id uuid REFERENCES public.bobinas(id) ON DELETE SET NULL;
ALTER TABLE public.costos_m2 DROP CONSTRAINT IF EXISTS costos_m2_periodo_tipo_key;
CREATE UNIQUE INDEX IF NOT EXISTS costos_m2_periodo_tipo_prov_bob_idx
  ON public.costos_m2 (periodo, tipo, proveedor, COALESCE(bobina_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. boletas: datos de bobina
ALTER TABLE public.boletas ADD COLUMN IF NOT EXISTS proveedor text;
ALTER TABLE public.boletas ADD COLUMN IF NOT EXISTS bobina_id uuid REFERENCES public.bobinas(id) ON DELETE SET NULL;
ALTER TABLE public.boletas ADD COLUMN IF NOT EXISTS bobina_color_id uuid REFERENCES public.colores(id);
ALTER TABLE public.boletas ADD COLUMN IF NOT EXISTS bobina_metros numeric;
ALTER TABLE public.boletas ADD COLUMN IF NOT EXISTS bobina_defectuosos numeric NOT NULL DEFAULT 0;

-- 3. Trigger: boleta con "bobina" crea/actualiza la bobina en inventario
CREATE OR REPLACE FUNCTION public.trg_boleta_bobina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_menciona boolean;
  v_id uuid;
  v_merma numeric;
  v_utiles numeric;
  v_saldo numeric;
  v_consumido numeric;
  b public.bobinas;
BEGIN
  v_menciona := COALESCE(NEW.descripcion, '') ~* 'bobina';

  IF NEW.bobina_id IS NULL THEN
    IF v_menciona
       AND NEW.bobina_color_id IS NOT NULL
       AND COALESCE(NEW.bobina_metros, 0) > 0 THEN
      v_id := public.crear_bobina(
        COALESCE(NULLIF(btrim(NEW.proveedor), ''), 'Proveedor sin nombre'),
        NEW.bobina_color_id,
        NEW.bobina_metros,
        NEW.monto,
        NEW.fecha,
        NULL,
        COALESCE(NEW.descripcion, 'Ingreso por boleta'),
        NEW.subido_por,
        COALESCE(NEW.bobina_defectuosos, 0)
      );
      NEW.bobina_id := v_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Bobina ya existente ligada a esta boleta: recalcular
  SELECT * INTO b FROM public.bobinas WHERE id = NEW.bobina_id;
  IF b.id IS NULL THEN RETURN NEW; END IF;

  IF COALESCE(NEW.bobina_metros, 0) > 0 THEN
    v_consumido := GREATEST(round(b.metros_utiles - b.saldo_m, 2), 0);
    v_merma := round(NEW.bobina_metros * 0.01, 2);
    v_utiles := GREATEST(round(NEW.bobina_metros - v_merma - COALESCE(NEW.bobina_defectuosos, 0), 2), 0);
    v_saldo := GREATEST(round(v_utiles - v_consumido, 2), 0);

    IF b.color_id IS NOT NULL AND round(v_utiles - b.metros_utiles, 2) <> 0 THEN
      UPDATE public.colores
        SET stock_m = GREATEST(COALESCE(stock_m, 0) + round(v_utiles - b.metros_utiles, 2), 0)
      WHERE id = b.color_id;
      INSERT INTO public.stock_movimientos (color_id, color_nombre, metros, motivo, user_id)
      VALUES (b.color_id, b.color_nombre, round(v_utiles - b.metros_utiles, 2),
        format('Ajuste por edición de boleta (bobina %s)', b.proveedor), NEW.subido_por);
    END IF;

    UPDATE public.bobinas SET
      proveedor = COALESCE(NULLIF(btrim(NEW.proveedor), ''), proveedor),
      metros_comprados = NEW.bobina_metros,
      metros_defectuosos = COALESCE(NEW.bobina_defectuosos, 0),
      metros_utiles = v_utiles,
      metros_perdida = round(v_merma + COALESCE(NEW.bobina_defectuosos, 0), 2),
      saldo_m = v_saldo,
      valor_total = NEW.monto,
      costo_m2 = CASE WHEN v_utiles > 0 THEN round(NEW.monto / v_utiles, 2) ELSE 0 END,
      fecha_ingreso = NEW.fecha,
      updated_at = now()
    WHERE id = NEW.bobina_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boleta_bobina ON public.boletas;
CREATE TRIGGER boleta_bobina
BEFORE INSERT OR UPDATE ON public.boletas
FOR EACH ROW EXECUTE FUNCTION public.trg_boleta_bobina();