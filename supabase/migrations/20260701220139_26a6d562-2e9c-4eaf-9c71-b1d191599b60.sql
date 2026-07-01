DO $$
DECLARE
  gris_id uuid;
BEGIN
  SELECT id INTO gris_id
  FROM public.colores
  WHERE lower(trim(nombre)) = 'gris'
  ORDER BY created_at ASC
  LIMIT 1;

  IF gris_id IS NOT NULL THEN
    INSERT INTO public.producto_variantes (id, tipo, color_id, espesor_mm, activo, fabricado_m)
    VALUES (gen_random_uuid(), 'Ondulado'::public.tipo_producto, gris_id, 0.4, true, 0)
    ON CONFLICT (tipo, color_id, espesor_mm) DO UPDATE
      SET activo = true,
          fabricado_m = COALESCE(public.producto_variantes.fabricado_m, 0),
          updated_at = now();
  END IF;
END $$;

INSERT INTO public.producto_variantes (tipo, color_id, espesor_mm, activo, fabricado_m)
SELECT tipo::public.tipo_producto, c.id, 0.4, true, 0
FROM public.colores c
CROSS JOIN (VALUES
  ('Ondulado'),
  ('PV8'),
  ('PV8 Invertido'),
  ('Microondulado'),
  ('6V'),
  ('PV4'),
  ('Lata Lisa')
) AS t(tipo)
WHERE c.activo = true
ON CONFLICT (tipo, color_id, espesor_mm) DO UPDATE
  SET activo = true,
      fabricado_m = COALESCE(public.producto_variantes.fabricado_m, 0),
      updated_at = now();

CREATE OR REPLACE FUNCTION public.fetch_or_create_variant(
  _tipo text,
  _color_id uuid,
  _espesor_mm numeric DEFAULT 0.4
)
RETURNS TABLE (
  id uuid,
  tipo text,
  color_id uuid,
  espesor_mm numeric,
  activo boolean,
  fabricado_m numeric,
  stock_m numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo public.tipo_producto;
  v_variant public.producto_variantes%ROWTYPE;
  v_stock numeric := 0;
BEGIN
  v_tipo := COALESCE(NULLIF(trim(_tipo), ''), 'Ondulado')::public.tipo_producto;

  BEGIN
    INSERT INTO public.producto_variantes (tipo, color_id, espesor_mm, activo, fabricado_m)
    VALUES (v_tipo, _color_id, COALESCE(_espesor_mm, 0.4), true, 0)
    ON CONFLICT (tipo, color_id, espesor_mm) DO UPDATE
      SET activo = true,
          fabricado_m = COALESCE(public.producto_variantes.fabricado_m, 0),
          updated_at = now()
    RETURNING * INTO v_variant;

    SELECT COALESCE(c.stock_m, 0) INTO v_stock
    FROM public.colores c
    WHERE c.id = _color_id;

    RETURN QUERY SELECT
      v_variant.id,
      v_variant.tipo::text,
      v_variant.color_id,
      v_variant.espesor_mm,
      COALESCE(v_variant.activo, true),
      COALESCE(v_variant.fabricado_m, 0),
      COALESCE(v_stock, 0);
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      gen_random_uuid(),
      COALESCE(_tipo, 'Ondulado'),
      _color_id,
      COALESCE(_espesor_mm, 0.4),
      true,
      0::numeric,
      0::numeric;
    RETURN;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_or_create_variant(text, uuid, numeric) TO service_role;