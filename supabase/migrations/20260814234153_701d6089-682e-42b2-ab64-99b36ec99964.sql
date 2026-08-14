ALTER TABLE public.solicitudes_egreso
  ADD COLUMN IF NOT EXISTS bobina_defectuosos numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.trg_egreso_aprobado_bobina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      NEW.decidido_por,
      COALESCE(NEW.bobina_defectuosos, 0)
    );
  END IF;
  RETURN NEW;
END;
$function$;