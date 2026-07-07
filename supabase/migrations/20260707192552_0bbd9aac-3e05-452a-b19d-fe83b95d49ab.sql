
-- Auto-audit trigger function
CREATE OR REPLACE FUNCTION public.trg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_rol text;
  v_rec_id text;
  v_payload jsonb;
BEGIN
  BEGIN
    v_email := (auth.jwt() ->> 'email');
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    IF public.has_role(v_uid, 'admin'::app_role) THEN
      v_rol := 'admin';
    ELSIF public.is_staff(v_uid) THEN
      v_rol := 'staff';
    ELSE
      v_rol := 'user';
    END IF;
  ELSE
    v_rol := 'system';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_rec_id := COALESCE((to_jsonb(OLD) ->> 'id'), NULL);
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_rec_id := COALESCE((to_jsonb(NEW) ->> 'id'), NULL);
    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_rec_id := COALESCE((to_jsonb(NEW) ->> 'id'), NULL);
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_log (user_id, user_email, rol, accion, tabla, registro_id, payload)
  VALUES (v_uid, v_email, v_rol, TG_OP, TG_TABLE_NAME, v_rec_id, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to key tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cotizaciones','cotizacion_items','pagos','boletas',
    'colores','producto_variantes','stock_movimientos',
    'solicitudes_egreso','configuracion_web','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row()',
      t
    );
  END LOOP;
END $$;
