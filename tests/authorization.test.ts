/**
 * Pruebas de autorización (RLS + Data API) contra Supabase.
 *
 * Estas pruebas usan la clave publishable/anon (rol `anon`) para verificar
 * que un visitante NO autenticado no puede leer ni modificar datos
 * sensibles. Cubre los hallazgos previos del scanner:
 *   - cotizaciones_public_read / cotizaciones_clientes_join_leak
 *   - user_roles_any_authenticated_insert
 *   - quote_page_pii_leak (clientes, pagos, boletas, egresos)
 *
 * Ejecutar con: `bunx vitest run tests/authorization.test.ts`
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://hsrgflyogivcxuflgkwx.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * RLS en PostgREST normalmente NO devuelve error: simplemente filtra y
 * devuelve `[]`. Por eso para "no leer" exigimos que el resultado sea
 * un array vacío (o un error de permiso explícito).
 */
function expectDenied<T>(
  data: T[] | null,
  error: { code?: string; message?: string } | null,
) {
  if (error) {
    // Errores aceptables: permission denied (42501) o policy violation.
    expect(error.message.toLowerCase()).toMatch(/permission|denied|policy|not allowed|unauthorized/);
    return;
  }
  expect(Array.isArray(data)).toBe(true);
  expect(data!.length).toBe(0);
}

describe('Autorización — lectura como anónimo', () => {
  it('no puede listar cotizaciones', async () => {
    const { data, error } = await anon.from('cotizaciones').select('id').limit(5);
    expectDenied(data, error);
  });

  it('no puede listar clientes (PII)', async () => {
    const { data, error } = await anon.from('clientes').select('id,correo,telefono').limit(5);
    expectDenied(data, error);
  });

  it('no puede listar pagos', async () => {
    const { data, error } = await anon.from('pagos').select('id,monto').limit(5);
    expectDenied(data, error);
  });

  it('no puede listar boletas', async () => {
    const { data, error } = await anon.from('boletas').select('id').limit(5);
    expectDenied(data, error);
  });

  it('no puede listar solicitudes de egreso', async () => {
    const { data, error } = await anon.from('solicitudes_egreso').select('id,monto').limit(5);
    expectDenied(data, error);
  });

  it('no puede listar user_roles', async () => {
    const { data, error } = await anon.from('user_roles').select('id,role').limit(5);
    expectDenied(data, error);
  });

  it('no puede leer config_audit_log', async () => {
    const { data, error } = await anon.from('config_audit_log').select('id').limit(5);
    expectDenied(data, error);
  });

  it('no puede joinear cotizaciones con clientes para sacar PII', async () => {
    const { data, error } = await anon
      .from('cotizaciones')
      .select('id, clientes(correo,telefono,nombre)')
      .limit(5);
    expectDenied(data as unknown as unknown[] | null, error);
  });
});

describe('Autorización — escritura como anónimo', () => {
  it('no puede INSERT en cotizaciones directamente', async () => {
    const { error } = await anon.from('cotizaciones').insert({
      numero: 'TEST-AUTH-' + Date.now(),
      cliente_id: '00000000-0000-0000-0000-000000000000',
      ancho_cm: 10,
      alto_cm: 10,
      precio_total: 1,
    } as never);
    expect(error).not.toBeNull();
  });

  it('no puede INSERT en user_roles (privilege escalation)', async () => {
    const { error } = await anon.from('user_roles').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      role: 'admin',
    } as never);
    expect(error).not.toBeNull();
  });

  it('no puede UPDATE cotizaciones', async () => {
    const { error, data } = await anon
      .from('cotizaciones')
      .update({ estado: 'pagado' } as never)
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    // O bien retorna error, o bien data vacío (0 filas afectadas por RLS)
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('no puede DELETE clientes', async () => {
    const { error, data } = await anon
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('no puede INSERT en pagos', async () => {
    const { error } = await anon.from('pagos').insert({
      cotizacion_id: '00000000-0000-0000-0000-000000000000',
      monto: 1,
      porcentaje: 50,
    } as never);
    expect(error).not.toBeNull();
  });
});

describe('Autorización — endpoints públicos legítimos', () => {
  it('puede leer configuracion_web (datos públicos del sitio)', async () => {
    const { error } = await anon.from('configuracion_web').select('*').limit(1);
    // No debe devolver permission denied; puede estar vacío y eso es OK.
    if (error) {
      expect(error.message.toLowerCase()).not.toMatch(/permission|denied/);
    }
  });

  it('puede leer colores activos (catálogo público)', async () => {
    const { error } = await anon.from('colores').select('id,nombre,activo').eq('activo', true);
    if (error) {
      expect(error.message.toLowerCase()).not.toMatch(/permission|denied/);
    }
  });
});
