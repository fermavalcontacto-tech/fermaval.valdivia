
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
CREATE TYPE public.quote_status AS ENUM ('cotizacion_creada','esperando_pago','pago_parcial','pedido_confirmado','pedido_terminado','rechazada');
CREATE TYPE public.expense_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE public.expense_type AS ENUM ('materiales', 'transporte', 'herramientas', 'servicios', 'otros');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "View own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.configuracion_web (
  id INT PRIMARY KEY DEFAULT 1,
  precio_m2 NUMERIC(10,2) NOT NULL DEFAULT 7990,
  logo_url TEXT,
  hero_url TEXT,
  hero_titulo TEXT NOT NULL DEFAULT 'Cubiertas y Revestimientos',
  hero_subtitulo TEXT NOT NULL DEFAULT 'Calidad industrial fabricada en Valdivia',
  info_comercial TEXT NOT NULL DEFAULT 'Tu pedido estará listo en un plazo máximo de 72 horas una vez recibida la confirmación y pago correspondiente.',
  linktree_url TEXT NOT NULL DEFAULT 'https://linktr.ee/fermaval.valdivia',
  mapa_url TEXT NOT NULL DEFAULT 'https://maps.app.goo.gl/3ucmNxorotuaexNg7',
  mapa_embed TEXT NOT NULL DEFAULT 'https://www.google.com/maps?q=Valdivia,Chile&output=embed',
  telefono TEXT NOT NULL DEFAULT '+56 9 3012 6744',
  direccion TEXT NOT NULL DEFAULT 'Valdivia, Chile',
  instagram TEXT NOT NULL DEFAULT '@fermaval.valdivia',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.configuracion_web TO anon, authenticated;
GRANT UPDATE ON public.configuracion_web TO authenticated;
GRANT ALL ON public.configuracion_web TO service_role;
ALTER TABLE public.configuracion_web ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read config" ON public.configuracion_web FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin update config" ON public.configuracion_web FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.configuracion_web (id) VALUES (1);

CREATE TABLE public.colores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  hex TEXT NOT NULL DEFAULT '#888888',
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.colores TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.colores TO authenticated;
GRANT ALL ON public.colores TO service_role;
ALTER TABLE public.colores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read colors" ON public.colores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage colors" ON public.colores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.colores (nombre, hex, orden) VALUES ('Terracota', '#c0532a', 1), ('Gris', '#6b6f73', 2), ('Negro', '#1f2024', 3);

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL, telefono TEXT NOT NULL, correo TEXT NOT NULL, direccion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage clients" ON public.clientes FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE SEQUENCE public.cotizacion_numero_seq START 1000;

CREATE TABLE public.cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  largo_m NUMERIC(10,2) NOT NULL, ancho_m NUMERIC(10,2) NOT NULL, metros2 NUMERIC(10,2) NOT NULL,
  color_id UUID REFERENCES public.colores(id) ON DELETE SET NULL,
  color_nombre TEXT,
  precio_m2 NUMERIC(10,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  pago_recibido NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado quote_status NOT NULL DEFAULT 'cotizacion_creada',
  plazo_horas INT NOT NULL DEFAULT 72,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizaciones TO authenticated;
GRANT SELECT ON public.cotizaciones TO anon;
GRANT ALL ON public.cotizaciones TO service_role;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read quotes" ON public.cotizaciones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff write quotes" ON public.cotizaciones FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update quotes" ON public.cotizaciones FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete quotes" ON public.cotizaciones FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  porcentaje INT,
  monto NUMERIC(12,2) NOT NULL,
  metodo TEXT NOT NULL DEFAULT 'pendiente',
  estado TEXT NOT NULL DEFAULT 'registrado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos TO authenticated;
GRANT ALL ON public.pagos TO service_role;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage payments" ON public.pagos FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.solicitudes_egreso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo expense_type NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  solicitante_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  estado expense_status NOT NULL DEFAULT 'pendiente',
  decidido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_egreso TO authenticated;
GRANT ALL ON public.solicitudes_egreso TO service_role;
ALTER TABLE public.solicitudes_egreso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view expenses" ON public.solicitudes_egreso FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert own" ON public.solicitudes_egreso FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND solicitante_id = auth.uid());
CREATE POLICY "Owner update pending" ON public.solicitudes_egreso FOR UPDATE TO authenticated USING (solicitante_id = auth.uid() AND estado = 'pendiente') WITH CHECK (solicitante_id = auth.uid());
CREATE POLICY "Admin update any" ON public.solicitudes_egreso FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete" ON public.solicitudes_egreso FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.boletas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID REFERENCES public.solicitudes_egreso(id) ON DELETE SET NULL,
  tipo_gasto expense_type NOT NULL,
  descripcion TEXT,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  archivo_path TEXT NOT NULL,
  archivo_nombre TEXT,
  subido_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boletas TO authenticated;
GRANT ALL ON public.boletas TO service_role;
ALTER TABLE public.boletas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage receipts" ON public.boletas FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER cotizaciones_touch BEFORE UPDATE ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
