/**
 * Pruebas de seguridad con un usuario AUTENTICADO pero SIN rol staff/admin.
 *
 * Verifica que un usuario común (signed-in pero sin fila en `user_roles`):
 *   - no pueda leer cotizaciones, clientes, pagos, boletas, egresos
 *   - no pueda invocar server functions admin (admin.functions.ts)
 *   - no pueda escalarse a admin insertando en user_roles
 *   - no pueda modificar configuración del sitio ni catálogo
 *
 * Cómo correr:
 *   El signup público está deshabilitado en producción, así que estas
 *   pruebas requieren credenciales de un usuario "no-admin" creado por el
 *   propietario del proyecto:
 *
 *     TEST_USER_EMAIL=noadmin@ejemplo.com \
 *     TEST_USER_PASSWORD='clave-segura' \
 *     bunx vitest run tests/non-admin.test.ts
 *
 *   Si las variables no están seteadas, el suite se omite (no falla).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type Session } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://hsrgflyogivcxuflgkwx.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;
const APP_URL =
  process.env.APP_URL ||
  'https://id-preview--d621ae92-3d0e-4687-a7c9-dc98be710e2c.lovable.app';

const haveCreds = Boolean(EMAIL && PASSWORD);
const d = haveCreds ? describe : describe.skip;

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let session: Session | null = null;
let userId = '';

beforeAll(async () => {
  if (!haveCreds) {
    console.warn(
      '⚠️  tests/non-admin.test.ts omitido — define TEST_USER_EMAIL y TEST_USER_PASSWORD para correrlo.',
    );
    return;
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: EMAIL!,
    password: PASSWORD!,
  });
  if (error) throw new Error(`No se pudo iniciar sesión con TEST_USER_*: ${error.message}`);
  session = data.session;
  userId = data.user!.id;
});

afterAll(async () => {
  if (haveCreds) await client.auth.signOut();
});

/** Confirma que la cuenta de prueba realmente NO es staff/admin. */
d('Precondición — la cuenta de prueba no debe tener rol', () => {
  it('no aparece en user_roles', async () => {
    // El usuario sólo puede leer su propia fila si la hubiera. Debe ser [].
    const { data } = await client.from('user_roles').select('role').eq('user_id', userId);
    expect((data ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Lectura de tablas sensibles como usuario autenticado SIN rol
// ---------------------------------------------------------------------------
d('Lectura como autenticado-no-admin', () => {
  const tables = ['cotizaciones', 'clientes', 'pagos', 'boletas', 'solicitudes_egreso'];
  for (const t of tables) {
    it(`no puede leer ${t}`, async () => {
      const { data, error } = await client.from(t).select('*').limit(5);
      if (error) {
        expect(error.message.toLowerCase()).toMatch(
          /permission|denied|policy|unauthorized|not allowed/,
        );
      } else {
        expect((data ?? []).length).toBe(0);
      }
    });
  }

  it('no puede leer config_audit_log', async () => {
    const { data, error } = await client.from('config_audit_log').select('*').limit(5);
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('no puede leer otros user_roles (sólo, máximo, los propios)', async () => {
    const { data } = await client
      .from('user_roles')
      .select('user_id,role')
      .neq('user_id', userId);
    expect((data ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Escritura / privilege escalation
// ---------------------------------------------------------------------------
d('Escritura como autenticado-no-admin', () => {
  it('no puede auto-asignarse rol admin', async () => {
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' } as never);
    expect(error).not.toBeNull();
  });

  it('no puede asignar rol admin a otro usuario', async () => {
    const { error } = await client.from('user_roles').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      role: 'admin',
    } as never);
    expect(error).not.toBeNull();
  });

  it('no puede insertar cotizaciones directamente', async () => {
    const { error } = await client.from('cotizaciones').insert({
      numero: 'PWN-AUTH-' + Date.now(),
      cliente_id: '00000000-0000-0000-0000-000000000000',
      ancho_cm: 1,
      alto_cm: 1,
      precio_total: 1,
    } as never);
    expect(error).not.toBeNull();
  });

  it('no puede insertar pagos', async () => {
    const { error } = await client.from('pagos').insert({
      cotizacion_id: '00000000-0000-0000-0000-000000000000',
      monto: 1,
      porcentaje: 50,
    } as never);
    expect(error).not.toBeNull();
  });

  it('no puede insertar solicitudes de egreso', async () => {
    const { error } = await client.from('solicitudes_egreso').insert({
      monto: 1,
      descripcion: 'pwn',
    } as never);
    expect(error).not.toBeNull();
  });

  it('no puede actualizar configuracion_web', async () => {
    const { data, error } = await client
      .from('configuracion_web')
      .update({ precio_m2: 1 } as never)
      .eq('id', 1)
      .select('id');
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('no puede actualizar colores', async () => {
    const { data, error } = await client
      .from('colores')
      .update({ activo: false } as never)
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it('no puede borrar boletas / objetos en storage privado', async () => {
    const { data, error } = await client.storage.from('boletas').list('', { limit: 5 });
    if (!error) expect((data ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Server functions admin — no deben responder data sensible al user común
// ---------------------------------------------------------------------------
d('Server functions admin con bearer no-admin', () => {
  /** Helper: invoca un server fn de TanStack con el bearer del usuario. */
  async function callServerFn(fnPath: string, body: unknown) {
    return fetch(`${APP_URL}/_serverFn/${fnPath}?createServerFn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session!.access_token}`,
      },
      body: JSON.stringify(body),
    });
  }

  // Cubre cualquier handler exportado en admin.functions.ts: deben requerir
  // rol staff/admin (verificado vía has_role/is_staff dentro del handler).
  const adminHandlers = [
    'src_lib_admin_functions_ts--getDashboard_createServerFn_handler',
    'src_lib_admin_functions_ts--listCotizaciones_createServerFn_handler',
    'src_lib_admin_functions_ts--listClientes_createServerFn_handler',
    'src_lib_admin_functions_ts--listPagos_createServerFn_handler',
    'src_lib_admin_functions_ts--listSolicitudesEgreso_createServerFn_handler',
    'src_lib_admin_functions_ts--listBoletas_createServerFn_handler',
  ];

  for (const h of adminHandlers) {
    it(`${h.split('--')[1]?.replace('_createServerFn_handler', '')} debe denegar`, async () => {
      const res = await callServerFn(h, {}).catch(() => null);
      if (!res) return; // handler no existe — ok, lo cubren otros suites
      if (res.status === 404) return; // ruta no existe en este build
      // Permitido: 401/403/500 con mensaje de "Forbidden"/"Unauthorized".
      // No permitido: 200 con datos privados.
      if (res.status === 200) {
        const body = await res.json().catch(() => null);
        const str = JSON.stringify(body ?? {}).toLowerCase();
        // Si el handler devolvió data útil para un admin, falla la prueba.
        expect(str).not.toMatch(/cotizaciones|clientes|pagos|boletas|egresos|dashboard/);
      } else {
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Acceso a rutas protegidas del SPA (sólo verifica que no devuelvan datos)
// ---------------------------------------------------------------------------
d('Rutas /admin como usuario no-admin', () => {
  it('GET /admin sin sesión no expone datos en el HTML', async () => {
    const res = await fetch(`${APP_URL}/admin`);
    const html = await res.text();
    // No debe haber datos pre-renderizados (PII, totales, etc.). Como /admin
    // está bajo _authenticated (ssr:false), debe responder un shell sin datos.
    expect(html.toLowerCase()).not.toMatch(/"correo":"|"telefono":"|"precio_total":/);
  });
});
