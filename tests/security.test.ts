/**
 * Pruebas de seguridad extendidas — superficie de ataque contra el sitio
 * publicado y el Data API de Supabase.
 *
 * Se ejecutan sin sesión (rol `anon`) y con sesión sintética
 * (`Authorization: Bearer <jwt-fake>`) para confirmar que ningún recurso
 * sensible queda expuesto.
 *
 *   bunx vitest run tests/security.test.ts
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

/** Helper: PostgREST con la apikey anon y un bearer arbitrario opcional. */
async function rest(
  path: string,
  init: RequestInit = {},
  bearer: string | null = null,
) {
  const headers = new Headers(init.headers);
  headers.set('apikey', SUPABASE_ANON_KEY);
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

// ---------------------------------------------------------------------------
// 1) Tablas sensibles — lectura anónima debe estar vacía o denegada
// ---------------------------------------------------------------------------
describe('RLS / Data API — lectura anónima', () => {
  const sensitive = [
    'cotizaciones',
    'clientes',
    'pagos',
    'boletas',
    'solicitudes_egreso',
    'user_roles',
    'config_audit_log',
  ];
  for (const table of sensitive) {
    it(`anon NO debe poder leer ${table}`, async () => {
      const { data, error } = await anon.from(table).select('*').limit(10);
      if (error) {
        expect(error.message.toLowerCase()).toMatch(
          /permission|denied|policy|unauthorized|not allowed/,
        );
      } else {
        expect(Array.isArray(data)).toBe(true);
        expect(data!.length).toBe(0);
      }
    });
  }

  it('anon NO debe poder hacer join cotizaciones→clientes (PII leak)', async () => {
    const { data, error } = await anon
      .from('cotizaciones')
      .select('id, clientes(correo,telefono,direccion,nombre)')
      .limit(5);
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('anon NO debe poder hacer join cotizaciones→pagos', async () => {
    const { data, error } = await anon
      .from('cotizaciones')
      .select('id, pagos(monto,porcentaje)')
      .limit(5);
    if (!error) expect((data ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2) Escritura anónima — todas las mutaciones deben fallar
// ---------------------------------------------------------------------------
describe('RLS / Data API — escritura anónima', () => {
  it('anon NO puede insertar en cotizaciones', async () => {
    const { error } = await anon.from('cotizaciones').insert({
      numero: 'PWN-' + Date.now(),
      cliente_id: '00000000-0000-0000-0000-000000000000',
      ancho_cm: 1,
      alto_cm: 1,
      precio_total: 1,
    } as never);
    expect(error).not.toBeNull();
  });

  it('anon NO puede auto-asignarse rol admin (privilege escalation)', async () => {
    const { error } = await anon.from('user_roles').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      role: 'admin',
    } as never);
    expect(error).not.toBeNull();
  });

  it('anon NO puede insertar pagos arbitrarios', async () => {
    const { error } = await anon.from('pagos').insert({
      cotizacion_id: '00000000-0000-0000-0000-000000000000',
      monto: 999999,
      porcentaje: 100,
    } as never);
    expect(error).not.toBeNull();
  });

  it('anon NO puede insertar solicitudes de egreso', async () => {
    const { error } = await anon.from('solicitudes_egreso').insert({
      monto: 1,
      descripcion: 'pwn',
    } as never);
    expect(error).not.toBeNull();
  });

  it('anon NO puede borrar clientes en masa', async () => {
    const { data, error } = await anon
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('anon NO puede actualizar configuracion_web (precio_m2, etc.)', async () => {
    const { data, error } = await anon
      .from('configuracion_web')
      .update({ precio_m2: 1 } as never)
      .eq('id', 1)
      .select('id');
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('anon NO puede actualizar colores (catálogo)', async () => {
    const { data, error } = await anon
      .from('colores')
      .update({ activo: false } as never)
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (!error) expect((data ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3) Bearer falsificado — un JWT inválido debe ser rechazado
// ---------------------------------------------------------------------------
describe('Autenticación — tokens forjados', () => {
  it('Bearer JWT con firma inválida es rechazado por GoTrue', async () => {
    const fakeJwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.bad';
    const res = await rest('/auth/v1/user', { method: 'GET' }, fakeJwt);
    expect([401, 403]).toContain(res.status);
  });

  it('Bearer JWT inválido NO permite leer cotizaciones', async () => {
    const fakeJwt = 'not-a-real-token';
    const res = await rest(
      '/rest/v1/cotizaciones?select=id&limit=1',
      { method: 'GET' },
      fakeJwt,
    );
    // PostgREST devuelve 401 o filtra a [] — ambos son seguros.
    if (res.status === 200) {
      const body = await res.json();
      expect(Array.isArray(body) && body.length).toBeFalsy();
    } else {
      expect([401, 403]).toContain(res.status);
    }
  });
});

// ---------------------------------------------------------------------------
// 4) Funciones RPC — no deben filtrar info sensible al rol anon
// ---------------------------------------------------------------------------
describe('RPC / funciones públicas', () => {
  it('has_role con UUID arbitrario nunca retorna true para anon', async () => {
    const { data, error } = await anon.rpc('has_role', {
      _user_id: '00000000-0000-0000-0000-000000000000',
      _role: 'admin',
    });
    if (error) {
      // Acceptable: función no expuesta a anon
      expect(error.message.toLowerCase()).toMatch(/permission|denied|not found|does not exist/);
    } else {
      expect(data).toBe(false);
    }
  });

  it('is_staff con UUID arbitrario nunca retorna true para anon', async () => {
    const { data, error } = await anon.rpc('is_staff', {
      _user_id: '00000000-0000-0000-0000-000000000000',
    });
    if (!error) expect(data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5) Inyección — filtros PostgREST deben tratar input como literal
// ---------------------------------------------------------------------------
describe('Inyección — filtros PostgREST', () => {
  it('payload SQLi en filtro eq no produce error de servidor', async () => {
    const evilNumero = "'; DROP TABLE cotizaciones;--";
    const { data, error } = await anon
      .from('cotizaciones')
      .select('id')
      .eq('numero', evilNumero)
      .limit(1);
    // Debe responder normalmente (vacío o denegado), nunca 500.
    if (error) {
      expect(error.message.toLowerCase()).not.toMatch(/syntax error/);
    } else {
      expect((data ?? []).length).toBe(0);
    }
  });

  it('payload con caracteres de control no rompe el endpoint', async () => {
    const res = await rest(
      `/rest/v1/clientes?correo=eq.${encodeURIComponent("admin' OR '1'='1")}&select=id`,
    );
    expect(res.status).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// 6) Storage — buckets privados no deben listar/descargar para anon
// ---------------------------------------------------------------------------
describe('Storage — buckets privados', () => {
  it('anon NO puede listar el bucket boletas', async () => {
    const { data, error } = await anon.storage.from('boletas').list('', { limit: 5 });
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('anon NO puede descargar un objeto cualquiera de boletas', async () => {
    const res = await rest('/storage/v1/object/boletas/inexistente.pdf');
    // 400/401/403/404 — cualquier denial es válido; nunca 200.
    expect(res.status).not.toBe(200);
  });

  it('anon NO puede listar el bucket web-assets', async () => {
    const { data, error } = await anon.storage.from('web-assets').list('', { limit: 5 });
    if (!error) expect((data ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7) Endpoint público createPublicQuote (server fn) — validación de input
// ---------------------------------------------------------------------------
describe('Server functions públicas — validación', () => {
  const APP_URL =
    process.env.APP_URL ||
    'https://id-preview--d621ae92-3d0e-4687-a7c9-dc98be710e2c.lovable.app';

  it('createPublicQuote rechaza email inválido', async () => {
    const res = await fetch(`${APP_URL}/_serverFn/src_lib_public_functions_ts--createPublicQuote_createServerFn_handler?createServerFn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'x',
          telefono: '123',
          correo: 'no-es-email',
          direccion: 'corta',
        },
        largo_m: -1,
        ancho_m: 9999,
      }),
    }).catch(() => null);
    // Si el server fn responde, debe ser error de validación (no 200 con datos)
    if (res && res.status === 200) {
      const body = await res.json().catch(() => null);
      expect(body?.numero).toBeFalsy();
    } else if (res) {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('acceptQuoteAndPay rechaza correo que no coincide', async () => {
    const res = await fetch(`${APP_URL}/_serverFn/src_lib_public_functions_ts--acceptQuoteAndPay_createServerFn_handler?createServerFn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: 'FAKE-00000',
        porcentaje: 50,
        correo: 'attacker@evil.com',
      }),
    }).catch(() => null);
    if (res && res.status === 200) {
      const body = await res.json().catch(() => null);
      // No debe responder ok con datos de pago.
      expect(body?.ok).not.toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 8) Auth — políticas básicas (no signup anónimo, sin auto-confirm)
// ---------------------------------------------------------------------------
describe('Auth policies', () => {
  it('signInAnonymously debe estar deshabilitado', async () => {
    const { data, error } = await anon.auth.signInAnonymously();
    // Esperado: error o sesión no creada.
    if (!error) {
      expect(data.session).toBeNull();
      if (data.user) await anon.auth.signOut();
    }
  });
});
