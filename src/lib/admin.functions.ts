import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const SUPERADMIN_EMAIL = "fermaval.contacto@gmail.com";

export const TIPOS_PRODUCTO = [
  "Ondulado", "PV8", "PV8 Invertido", "Microondulado", "6V", "PV4", "Lata Lisa",
] as const;
export const ESPESOR_FIJO_MM = 0.4;

function assertSuperadmin(email: string | undefined) {
  if ((email ?? "").toLowerCase() !== SUPERADMIN_EMAIL) {
    throw new Error("No tienes permisos para modificar la configuración del sitio.");
  }
}

function isSuperadminEmail(email: string | undefined) {
  return (email ?? "").toLowerCase() === SUPERADMIN_EMAIL;
}

function enforceFecha(email: string | undefined, fecha: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!isSuperadminEmail(email)) return today;
  return fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : today;
}

const TipoEnum = z.enum(TIPOS_PRODUCTO);

const ItemSchema = z.object({
  largo_m: z.number().positive().max(1000),
  cantidad_planchas: z.number().int().positive().max(10000),
  color_id: z.string().uuid().nullable().optional(),
  tipo: TipoEnum.optional().default("Ondulado"),
  espesor_mm: z.number().optional().default(ESPESOR_FIJO_MM),
});

type Variante = { id: string; tipo: string; color_id: string; espesor_mm: number; stock_m: number };

async function resolveVariantes(
  supabase: { from: (t: string) => { select: (s: string) => { in: (col: string, vals: string[]) => Promise<{ data: Variante[] | null }> } } },
  items: Array<{ color_id?: string | null; tipo?: string; espesor_mm?: number }>,
): Promise<Map<string, Variante>> {
  const colorIds = Array.from(new Set(items.map((i) => i.color_id).filter((x): x is string => !!x)));
  if (!colorIds.length) return new Map();
  const { data: vars } = await supabase.from("producto_variantes").select("id, tipo, color_id, espesor_mm, stock_m").in("color_id", colorIds);
  const map = new Map<string, Variante>();
  for (const v of (vars ?? [])) {
    map.set(`${v.tipo}|${v.color_id}|${Number(v.espesor_mm).toFixed(2)}`, v);
  }
  return map;
}

function variantKey(tipo: string, colorId: string, espesor: number) {
  return `${tipo}|${colorId}|${Number(espesor).toFixed(2)}`;
}

async function buildItemsCalc(
  supabase: { from: (t: string) => { select: (s: string) => { in: (col: string, vals: string[]) => Promise<{ data: Array<{ id: string; nombre: string }> | null }> } } } & Parameters<typeof resolveVariantes>[0],
  items: Array<{ largo_m: number; cantidad_planchas: number; color_id?: string | null; tipo?: string; espesor_mm?: number }>,
) {
  const colorIds = Array.from(new Set(items.map((i) => i.color_id).filter((x): x is string => !!x)));
  const colorNames = new Map<string, string>();
  if (colorIds.length) {
    const { data: cols } = await supabase.from("colores").select("id, nombre").in("id", colorIds);
    for (const c of (cols ?? [])) colorNames.set(c.id, c.nombre);
  }
  const variantes = await resolveVariantes(supabase, items);

  const itemsCalc = items.map((it) => {
    const tipo = (it.tipo ?? "Ondulado") as typeof TIPOS_PRODUCTO[number];
    const espesor = Number(it.espesor_mm ?? ESPESOR_FIJO_MM);
    const variante = it.color_id ? variantes.get(variantKey(tipo, it.color_id, espesor)) : undefined;
    return {
      largo_m: it.largo_m,
      ancho_m: 1,
      cantidad_planchas: it.cantidad_planchas,
      metros2: Number((it.largo_m * 1 * it.cantidad_planchas).toFixed(2)),
      color_id: it.color_id ?? null,
      color_nombre: it.color_id ? (colorNames.get(it.color_id) ?? null) : null,
      tipo,
      espesor_mm: espesor,
      variante_id: variante?.id ?? null,
    };
  });

  // Validación de stock por variante (tipo+color+espesor)
  const byVariant = new Map<string, { variante: Variante; metros: number; nombre: string }>();
  for (const it of itemsCalc) {
    if (!it.color_id) continue;
    const v = variantes.get(variantKey(it.tipo, it.color_id, it.espesor_mm));
    if (!v) {
      throw new Error(`No existe variante de stock para ${it.tipo} · ${it.color_nombre ?? "color"} · ${it.espesor_mm} mm. Créala en Administración.`);
    }
    const prev = byVariant.get(v.id);
    byVariant.set(v.id, {
      variante: v,
      metros: (prev?.metros ?? 0) + it.metros2,
      nombre: `${it.tipo} ${it.color_nombre ?? ""} ${it.espesor_mm}mm`.trim(),
    });
  }
  for (const [, info] of byVariant) {
    if (Number(info.variante.stock_m) < info.metros) {
      throw new Error(`Stock insuficiente para "${info.nombre}" (disponible: ${info.variante.stock_m} m, solicitado: ${info.metros.toFixed(2)} m).`);
    }
  }
  return itemsCalc;
}

export const listCotizaciones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cotizaciones")
      .select("*, cliente:clientes(nombre, correo, telefono), items:cotizacion_items(id, position, largo_m, ancho_m, cantidad_planchas, metros2, color_id, color_nombre, tipo, espesor_mm, variante_id)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCotizacionItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cotizacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("cotizacion_items")
      .select("id, position, largo_m, ancho_m, cantidad_planchas, metros2, color_id, color_nombre, tipo, espesor_mm, variante_id")
      .eq("cotizacion_id", data.cotizacion_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return items ?? [];
  });

type SupabaseLike = typeof import("@supabase/supabase-js").SupabaseClient.prototype;

async function discountStockForCotizacion(
  supabase: SupabaseLike, cotId: string, userId: string, userEmail: string,
) {
  const { data: cot } = await supabase
    .from("cotizaciones").select("id, numero, stock_descontado_at").eq("id", cotId).single();
  if (!cot || cot.stock_descontado_at) return;
  const { data: items } = await supabase
    .from("cotizacion_items")
    .select("color_id, color_nombre, tipo, espesor_mm, variante_id, metros2")
    .eq("cotizacion_id", cotId);
  const byVariant = new Map<string, { variante_id: string; tipo: string | null; espesor: number; color_id: string | null; color_nombre: string | null; metros: number }>();
  for (const it of items ?? []) {
    if (!it.variante_id) continue;
    const prev = byVariant.get(it.variante_id);
    byVariant.set(it.variante_id, {
      variante_id: it.variante_id,
      tipo: it.tipo ?? prev?.tipo ?? null,
      espesor: Number(it.espesor_mm ?? prev?.espesor ?? 0.4),
      color_id: it.color_id ?? prev?.color_id ?? null,
      color_nombre: it.color_nombre ?? prev?.color_nombre ?? null,
      metros: (prev?.metros ?? 0) + Number(it.metros2),
    });
  }
  if (!byVariant.size) {
    await supabase.from("cotizaciones").update({ stock_descontado_at: new Date().toISOString() }).eq("id", cotId);
    return;
  }
  const ids = Array.from(byVariant.keys());
  const { data: vars } = await supabase.from("producto_variantes").select("id, stock_m, tipo, color_id, espesor_mm").in("id", ids);
  for (const v of vars ?? []) {
    const need = byVariant.get(v.id)!;
    if (Number(v.stock_m) < need.metros) {
      throw new Error(`Stock insuficiente para ${need.tipo ?? ""} ${need.color_nombre ?? ""} ${need.espesor}mm (disponible: ${v.stock_m} m).`);
    }
  }
  for (const v of vars ?? []) {
    const need = byVariant.get(v.id)!;
    const nuevo = Number(v.stock_m) - need.metros;
    await supabase.from("producto_variantes").update({ stock_m: nuevo }).eq("id", v.id);
    await supabase.from("stock_movimientos").insert({
      color_id: need.color_id, color_nombre: need.color_nombre,
      variante_id: v.id, tipo: need.tipo, espesor_mm: need.espesor,
      cotizacion_id: cotId, cotizacion_numero: cot.numero,
      metros: -need.metros, motivo: `Descuento por pago (parcial/total) de ${cot.numero}`,
      user_id: userId, user_email: userEmail,
    });
  }
  await supabase.from("cotizaciones").update({ stock_descontado_at: new Date().toISOString() }).eq("id", cotId);
}

async function restoreStockForCotizacion(
  supabase: SupabaseLike, cotId: string, userId: string, userEmail: string, motivo: string,
) {
  const { data: cot } = await supabase
    .from("cotizaciones").select("id, numero, stock_descontado_at").eq("id", cotId).single();
  if (!cot || !cot.stock_descontado_at) return;
  const { data: items } = await supabase
    .from("cotizacion_items")
    .select("color_id, color_nombre, tipo, espesor_mm, variante_id, metros2")
    .eq("cotizacion_id", cotId);
  const byVariant = new Map<string, { tipo: string | null; espesor: number; color_id: string | null; color_nombre: string | null; metros: number }>();
  for (const it of items ?? []) {
    if (!it.variante_id) continue;
    const prev = byVariant.get(it.variante_id);
    byVariant.set(it.variante_id, {
      tipo: it.tipo ?? prev?.tipo ?? null,
      espesor: Number(it.espesor_mm ?? prev?.espesor ?? 0.4),
      color_id: it.color_id ?? prev?.color_id ?? null,
      color_nombre: it.color_nombre ?? prev?.color_nombre ?? null,
      metros: (prev?.metros ?? 0) + Number(it.metros2),
    });
  }
  if (byVariant.size) {
    const ids = Array.from(byVariant.keys());
    const { data: vars } = await supabase.from("producto_variantes").select("id, stock_m").in("id", ids);
    for (const v of vars ?? []) {
      const need = byVariant.get(v.id)!;
      const nuevo = Number(v.stock_m) + need.metros;
      await supabase.from("producto_variantes").update({ stock_m: nuevo }).eq("id", v.id);
      await supabase.from("stock_movimientos").insert({
        color_id: need.color_id, color_nombre: need.color_nombre,
        variante_id: v.id, tipo: need.tipo, espesor_mm: need.espesor,
        cotizacion_id: cotId, cotizacion_numero: cot.numero,
        metros: need.metros, motivo: `${motivo} (${cot.numero})`,
        user_id: userId, user_email: userEmail,
      });
    }
  }
  await supabase.from("cotizaciones").update({ stock_descontado_at: null }).eq("id", cotId);
}

const ESTADOS_CON_PAGO = new Set(["pago_parcial", "pedido_confirmado", "pedido_terminado"]);

export const updateCotizacionEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      estado: z.enum(["cotizacion_creada","esperando_pago","pago_parcial","pedido_confirmado","pedido_terminado","rechazada"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cotizaciones").update({ estado: data.estado }).eq("id", data.id);
    if (error) throw new Error(error.message);
    const email = (context.claims?.email ?? "").toLowerCase();
    if (ESTADOS_CON_PAGO.has(data.estado)) {
      await discountStockForCotizacion(context.supabase as never, data.id, context.userId, email);
    } else {
      await restoreStockForCotizacion(
        context.supabase as never, data.id, context.userId, email,
        data.estado === "rechazada" ? "Reposición por cotización rechazada" : "Reposición por cambio de estado",
      );
    }
    return { ok: true };
  });

export const createCotizacionManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    cliente: z.object({
      nombre: z.string().trim().min(2),
      telefono: z.string().trim().min(3),
      correo: z.string().trim().email(),
      direccion: z.string().trim().min(3),
    }),
    items: z.array(ItemSchema).min(1).max(50),
    color_nombre: z.string().nullable().optional(),
    precio_m2: z.number().positive(),
    fecha_solicitud: z.string().optional(),
    responsable_nombre: z.string().trim().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const itemsCalc = await buildItemsCalc(context.supabase as never, data.items);
    const { data: cliente, error: cErr } = await context.supabase.from("clientes").insert({ ...data.cliente }).select("id").single();
    if (cErr) throw new Error(cErr.message);
    const metros2 = Number(itemsCalc.reduce((s, x) => s + x.metros2, 0).toFixed(2));
    const total = Math.round(metros2 * data.precio_m2);
    const first = itemsCalc[0];
    const numero = "FV-" + Date.now().toString().slice(-7);
    const fechaSolicitud = enforceFecha(context.claims?.email, data.fecha_solicitud);
    const access_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const colorNombreCot = data.color_nombre ?? first.color_nombre ?? null;
    const responsable = (data.responsable_nombre ?? context.claims?.email ?? "Equipo FERMAVAL").toString().slice(0, 80);
    const { data: cot, error } = await context.supabase.from("cotizaciones").insert({
      numero, cliente_id: cliente.id,
      largo_m: first.largo_m, ancho_m: 1, cantidad_planchas: first.cantidad_planchas,
      metros2, precio_m2: data.precio_m2, total, saldo: total,
      color_id: first.color_id, color_nombre: colorNombreCot, created_by: context.userId,
      estado: "cotizacion_creada", plazo_horas: 72,
      fecha_solicitud: fechaSolicitud,
      access_token,
      origen: "interno",
      responsable_nombre: responsable,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: itErr } = await context.supabase
      .from("cotizacion_items")
      .insert(itemsCalc.map((it, idx) => ({ ...it, cotizacion_id: cot.id, position: idx })));
    if (itErr) throw new Error(itErr.message);
    return { numero };
  });


export const listEgresos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("solicitudes_egreso").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const PERSONAS_INTERNAS = ["Freddy", "Bayron", "Oscar"] as const;
const personaSchema = z.enum(PERSONAS_INTERNAS);

export const createEgreso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tipo: z.enum(["materiales", "transporte", "herramientas", "servicios", "otros"]),
    descripcion: z.string().trim().min(2).max(500),
    monto: z.number().positive(),
    fecha: z.string(),
    solicitado_por: personaSchema,
    boleta_subida_por: personaSchema.nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const fecha = enforceFecha(context.claims?.email, data.fecha);
    const { data: inserted, error } = await context.supabase.from("solicitudes_egreso").insert({
      tipo: data.tipo, descripcion: data.descripcion, monto: data.monto, fecha,
      solicitante_id: context.userId, estado: "pendiente",
      solicitado_por: data.solicitado_por,
      boleta_subida_por: data.boleta_subida_por ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);

    try {
      const { sendGmail, ADMIN_INBOX } = await import("@/lib/gmail.server");
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const host = getRequestHeader("host") ?? "";
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      const base = host ? `${proto}://${host}` : "";
      const id = inserted?.id ?? "";
      const shortId = id ? `SE-${id.slice(0, 8).toUpperCase()}` : "SE-NUEVA";
      const monto = data.monto.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
      const text = [
        "Nueva Solicitud de Dinero pendiente de revisión.",
        "", `ID: ${shortId}`, `Solicitado por: ${data.solicitado_por}`,
        `Responsable boleta: ${data.boleta_subida_por ?? "—"}`,
        `Tipo: ${data.tipo}`, `Monto: ${monto}`, `Fecha: ${fecha}`,
        `Motivo / Detalle: ${data.descripcion}`,
        "", base ? `Revisar / autorizar: ${base}/admin/egresos` : "Revisar en el panel /admin/egresos",
      ].join("\r\n");
      await sendGmail({ to: ADMIN_INBOX, subject: `Nueva Solicitud de Dinero Pendiente - ${shortId}`, text });
    } catch (e) {
      console.error("notifyNewEgreso failed:", (e as Error).message);
    }
    return { ok: true };
  });


export const deleteEgreso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase
      .from("solicitudes_egreso").select("tipo, monto, descripcion").eq("id", data.id).single();
    const { error } = await context.supabase.from("solicitudes_egreso").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "solicitudes_egreso", accion: "delete",
      cambio: `Solicitud de egreso eliminada (${prev?.tipo ?? "?"})`,
      valor_antes: prev ? `${prev.tipo} ${prev.monto} ${prev.descripcion ?? ""}` : null,
      valor_despues: null,
    });
    return { ok: true };
  });


export const decideEgreso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    estado: z.enum(["aprobado", "rechazado"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    if (email !== SUPERADMIN_EMAIL) {
      throw new Error("Solo el Administrador General (fermaval.contacto@gmail.com) puede aprobar o rechazar.");
    }
    const { error } = await context.supabase.from("solicitudes_egreso").update({
      estado: data.estado, decidido_por: context.userId, decidido_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= LATAS =============
export const COLORES_LATA = [
  "Rojo","Azul","Verde","Amarillo","Blanco","Negro","Gris","Naranja","Café","Celeste",
] as const;

const LataSchema = z.object({
  descripcion: z.string().trim().min(1).max(120),
  cantidad: z.number().int().positive().max(10000),
  color: z.enum(COLORES_LATA),
  tipo: TipoEnum.optional().default("Ondulado"),
  espesor_mm: z.number().optional().default(ESPESOR_FIJO_MM),
});

export const updateEgresoLatas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    latas: z.array(LataSchema).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Solo los perfiles administradores pueden modificar el color por lata.");

    const { error } = await context.supabase
      .from("solicitudes_egreso").update({ latas: data.latas }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBoletas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("boletas").select("*").order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBoleta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tipo_gasto: z.enum(["materiales", "transporte", "herramientas", "servicios", "otros"]),
    descripcion: z.string().trim().max(300).optional().nullable(),
    monto: z.number().positive(),
    fecha: z.string(),
    archivo_path: z.string(),
    archivo_nombre: z.string().optional().nullable(),
    responsable: personaSchema,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const fecha = enforceFecha(context.claims?.email, data.fecha);
    const { error } = await context.supabase.from("boletas").insert({
      tipo_gasto: data.tipo_gasto, descripcion: data.descripcion ?? null,
      monto: data.monto, fecha,
      archivo_path: data.archivo_path, archivo_nombre: data.archivo_nombre ?? null,
      responsable: data.responsable,
      subido_por: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const inicioMesISO = inicioMes.toISOString();

    const { data: cotMes } = await context.supabase.from("cotizaciones").select("total, estado, pago_recibido, created_at").gte("created_at", inicioMesISO);
    const { data: cotPendientes } = await context.supabase.from("cotizaciones").select("id", { count: "exact" }).in("estado", ["cotizacion_creada","esperando_pago"]);
    const { data: pedidosConf } = await context.supabase.from("cotizaciones").select("id", { count: "exact" }).eq("estado", "pedido_confirmado");
    const { data: gastosMes } = await context.supabase.from("solicitudes_egreso").select("monto, estado").eq("estado", "aprobado").gte("fecha", inicioMesISO.slice(0, 10));
    const { count: egresosPendientesCount } = await context.supabase.from("solicitudes_egreso").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
    // Boletas standalone (sin solicitud_id) — comprobantes que se cargan sueltos y deben sumar al balance
    const { data: boletasMesStandalone } = await context.supabase.from("boletas").select("monto, fecha, solicitud_id").is("solicitud_id", null).gte("fecha", inicioMesISO.slice(0, 10));

    const ventas = (cotMes ?? []).reduce((s, c) => s + Number(c.pago_recibido), 0);
    const totalCotizado = (cotMes ?? []).reduce((s, c) => s + Number(c.total), 0);
    const gastosSolicitudes = (gastosMes ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const gastosBoletasStandalone = (boletasMesStandalone ?? []).reduce((s, b) => s + Number(b.monto), 0);
    const gastos = gastosSolicitudes + gastosBoletasStandalone;
    const utilidades = ventas - gastos;
    const iva = Math.round(ventas * 0.19 / 1.19);

    const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1); since.setHours(0,0,0,0);
    const { data: all } = await context.supabase.from("cotizaciones").select("total, pago_recibido, created_at, estado").gte("created_at", since.toISOString());
    const { data: allGastos } = await context.supabase.from("solicitudes_egreso").select("monto, fecha, estado").eq("estado","aprobado").gte("fecha", since.toISOString().slice(0,10));
    const { data: allBoletasStandalone } = await context.supabase.from("boletas").select("monto, fecha").is("solicitud_id", null).gte("fecha", since.toISOString().slice(0,10));

    const months: Array<{ key: string; label: string; ventas: number; gastos: number; aceptadas: number; rechazadas: number }> = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(since); d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      months.push({ key, label: d.toLocaleDateString("es-CL", { month: "short" }), ventas: 0, gastos: 0, aceptadas: 0, rechazadas: 0 });
    }
    for (const c of all ?? []) {
      const d = new Date(c.created_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const m = months.find(x => x.key === key); if (!m) continue;
      m.ventas += Number(c.pago_recibido);
      if (["pago_parcial","pedido_confirmado","pedido_terminado"].includes(c.estado as string)) m.aceptadas++;
      if (c.estado === "rechazada") m.rechazadas++;
    }
    for (const g of allGastos ?? []) {
      const d = new Date(g.fecha as string);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const m = months.find(x => x.key === key); if (!m) continue;
      m.gastos += Number(g.monto);
    }
    for (const b of allBoletasStandalone ?? []) {
      const d = new Date(b.fecha as string);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const m = months.find(x => x.key === key); if (!m) continue;
      m.gastos += Number(b.monto);
    }

    return {
      ventas, totalCotizado, gastos, utilidades, iva,
      cotPendientes: cotPendientes?.length ?? 0,
      pedidosConfirmados: pedidosConf?.length ?? 0,
      egresosPendientes: egresosPendientesCount ?? 0,
      months,
    };
  });

export const getColores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("colores").select("*").order("orden");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().nullable().optional(),
    nombre: z.string().trim().min(1).max(60),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    imagen_url: z.string().url().nullable().optional(),
    activo: z.boolean(),
    orden: z.number().int().min(0).max(999),
    stock_m: z.number().min(0).max(1_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    if (data.id) {
      const { data: prev } = await context.supabase.from("colores").select("*").eq("id", data.id).single();
      const { error } = await context.supabase.from("colores").update({
        nombre: data.nombre, hex: data.hex, imagen_url: data.imagen_url ?? null,
        activo: data.activo, orden: data.orden, stock_m: data.stock_m,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (prev && Number(prev.stock_m) !== data.stock_m) {
        await context.supabase.from("stock_movimientos").insert({
          color_id: data.id, color_nombre: data.nombre,
          metros: data.stock_m - Number(prev.stock_m),
          motivo: `Ajuste manual de stock (${prev.stock_m} → ${data.stock_m})`,
          user_id: context.userId, user_email: email,
        });
      }
      await context.supabase.from("config_audit_log").insert({
        user_id: context.userId, user_email: email, entidad: "colores", accion: "update",
        cambio: `Color "${data.nombre}" actualizado`,
        valor_antes: prev ? `${prev.nombre} ${prev.hex} activo=${prev.activo} stock=${prev.stock_m}` : null,
        valor_despues: `${data.nombre} ${data.hex} activo=${data.activo} stock=${data.stock_m}`,
      });
    } else {
      const { data: nuevo, error } = await context.supabase.from("colores").insert({
        nombre: data.nombre, hex: data.hex, imagen_url: data.imagen_url ?? null,
        activo: data.activo, orden: data.orden, stock_m: data.stock_m,
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (nuevo) {
        // Crear automáticamente las variantes (todos los tipos × espesor 0.4) con stock 0
        await context.supabase.from("producto_variantes").insert(
          TIPOS_PRODUCTO.map((tipo) => ({ tipo, color_id: nuevo.id, espesor_mm: ESPESOR_FIJO_MM, stock_m: 0 })),
        );
      }
      if (data.stock_m > 0 && nuevo) {
        await context.supabase.from("stock_movimientos").insert({
          color_id: nuevo.id, color_nombre: data.nombre,
          metros: data.stock_m, motivo: "Stock inicial",
          user_id: context.userId, user_email: email,
        });
      }
      await context.supabase.from("config_audit_log").insert({
        user_id: context.userId, user_email: email, entidad: "colores", accion: "create",
        cambio: `Color "${data.nombre}" creado`, valor_antes: null,
        valor_despues: `${data.nombre} ${data.hex} stock=${data.stock_m}`,
      });
    }
    return { ok: true };
  });

export const adjustColorStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    color_id: z.string().uuid(),
    delta_m: z.number().refine((v) => v !== 0, "Ingresa un valor distinto de 0"),
    motivo: z.string().trim().min(2).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    const { data: prev, error: pe } = await context.supabase
      .from("colores").select("nombre, stock_m").eq("id", data.color_id).single();
    if (pe || !prev) throw new Error("Color no encontrado");
    const nuevo = Number(prev.stock_m) + data.delta_m;
    if (nuevo < 0) throw new Error("El ajuste deja stock negativo.");
    const { error } = await context.supabase.from("colores").update({ stock_m: nuevo }).eq("id", data.color_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("stock_movimientos").insert({
      color_id: data.color_id, color_nombre: prev.nombre,
      metros: data.delta_m, motivo: data.motivo,
      user_id: context.userId, user_email: email,
    });
    return { ok: true, stock_m: nuevo };
  });

// ============= PRODUCTO_VARIANTES (stock por tipo+color+espesor) =============

export const listProductoVariantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("producto_variantes")
      .select("id, tipo, color_id, espesor_mm, stock_m, activo, color:colores(nombre, hex)")
      .order("tipo", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adjustVarianteStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    variante_id: z.string().uuid(),
    delta_m: z.number().refine((v) => v !== 0, "Ingresa un valor distinto de 0"),
    motivo: z.string().trim().min(2).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Solo administradores pueden ajustar stock.");
    const { data: prev } = await context.supabase
      .from("producto_variantes")
      .select("id, tipo, color_id, espesor_mm, stock_m, color:colores(nombre)").eq("id", data.variante_id).single();
    if (!prev) throw new Error("Variante no encontrada");
    const nuevo = Number(prev.stock_m) + data.delta_m;
    if (nuevo < 0) throw new Error("El ajuste deja stock negativo.");
    const { error } = await context.supabase.from("producto_variantes").update({ stock_m: nuevo }).eq("id", data.variante_id);
    if (error) throw new Error(error.message);
    const colName = (prev.color as { nombre?: string } | null)?.nombre ?? null;
    await context.supabase.from("stock_movimientos").insert({
      color_id: prev.color_id, color_nombre: colName,
      variante_id: data.variante_id, tipo: prev.tipo, espesor_mm: prev.espesor_mm,
      metros: data.delta_m, motivo: data.motivo,
      user_id: context.userId, user_email: email,
    });
    return { ok: true, stock_m: nuevo };
  });

export const listStockMovimientos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stock_movimientos").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    const { count } = await context.supabase
      .from("cotizacion_items").select("id", { count: "exact", head: true }).eq("color_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`No se puede eliminar: el color está usado en ${count} líneas de cotización. Desactívalo en su lugar.`);
    }
    const { data: prev } = await context.supabase.from("colores").select("nombre, hex").eq("id", data.id).single();
    const { error } = await context.supabase.from("colores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "colores", accion: "delete",
      cambio: `Color "${prev?.nombre ?? data.id}" eliminado`,
      valor_antes: prev ? `${prev.nombre} ${prev.hex}` : null, valor_despues: null,
    });
    return { ok: true };
  });

export const getConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("configuracion_web").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    precio_m2: z.number().positive(),
    hero_titulo: z.string().min(1).max(120),
    hero_subtitulo: z.string().min(1).max(200),
    hero_h1_linea1: z.string().min(1).max(60),
    hero_h1_linea2: z.string().min(1).max(60),
    hero_h1_linea3: z.string().min(1).max(80),
    marca_texto: z.string().min(1).max(400),
    productos_titulo: z.string().min(1).max(80),
    cotizador_titulo: z.string().min(1).max(80),
    info_comercial: z.string().min(1).max(500),
    linktree_url: z.string().url(),
    mapa_url: z.string().url(),
    mapa_embed: z.string().url(),
    telefono: z.string().min(1).max(40),
    direccion: z.string().min(1).max(200),
    instagram: z.string().max(80),
    logo_url: z.string().url().nullable().optional(),
    hero_url: z.string().url().nullable().optional(),
    form_fields: z.record(z.string(), z.object({
      label: z.string().trim().min(1).max(40),
      visible: z.boolean(),
      required: z.boolean(),
    })).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase.from("configuracion_web").select("*").eq("id", 1).single();
    const { error } = await context.supabase.from("configuracion_web").update({
      ...data,
      logo_url: data.logo_url ?? null,
      hero_url: data.hero_url ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw new Error(error.message);
    const fields: Array<keyof typeof data> = [
      "precio_m2","hero_titulo","hero_subtitulo","hero_h1_linea1","hero_h1_linea2","hero_h1_linea3",
      "marca_texto","productos_titulo","cotizador_titulo",
      "info_comercial","linktree_url","mapa_url","mapa_embed","telefono","direccion","instagram","logo_url","hero_url","form_fields",
    ];


    const rows: Array<{ user_id: string; user_email: string; entidad: string; accion: string; cambio: string; valor_antes: string | null; valor_despues: string | null }> = [];
    const norm = (v: unknown) => v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v));
    for (const k of fields) {
      const before = prev ? (prev as Record<string, unknown>)[k] : null;
      const after = (data as Record<string, unknown>)[k] ?? null;
      const b = norm(before), a = norm(after);
      if (b !== a) {
        rows.push({
          user_id: context.userId, user_email: email, entidad: "configuracion_web", accion: "update",
          cambio: `${k} actualizado`,
          valor_antes: before == null ? null : b,
          valor_despues: after == null ? null : a,
        });
      }
    }

    if (rows.length) await context.supabase.from("config_audit_log").insert(rows);
    return { ok: true };
  });

export const listConfigAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data, error } = await context.supabase
      .from("config_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });


export const generateMonthlyExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const start = new Date(data.year, data.month - 1, 1);
    const end = new Date(data.year, data.month, 1);
    const { data: cots } = await context.supabase
      .from("cotizaciones").select("numero, total, pago_recibido, saldo, estado, fecha_solicitud, created_at, responsable_nombre, cliente:clientes(nombre)")
      .gte("fecha_solicitud", start.toISOString().slice(0,10)).lt("fecha_solicitud", end.toISOString().slice(0,10));
    const { data: gastos } = await context.supabase
      .from("solicitudes_egreso").select("tipo, descripcion, monto, fecha, estado, solicitado_por, boleta_subida_por, latas")
      .eq("estado","aprobado").gte("fecha", start.toISOString().slice(0,10)).lt("fecha", end.toISOString().slice(0,10));

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const ventasRows = (cots ?? []).map((c) => ({
      Numero: c.numero,
      Cliente: (c.cliente as { nombre: string } | null)?.nombre ?? "",
      Responsable: (c as { responsable_nombre?: string | null }).responsable_nombre ?? "",
      Total: Number(c.total), Pagado: Number(c.pago_recibido), Saldo: Number(c.saldo),
      Estado: c.estado,
      Fecha: (c.fecha_solicitud as string) ?? new Date(c.created_at as string).toLocaleDateString("es-CL"),
    }));
    const wsVentas = wb.addWorksheet("Ventas");
    wsVentas.columns = [
      { header: "Numero", key: "Numero" }, { header: "Cliente", key: "Cliente" },
      { header: "Responsable", key: "Responsable" },
      { header: "Total", key: "Total" }, { header: "Pagado", key: "Pagado" },
      { header: "Saldo", key: "Saldo" }, { header: "Estado", key: "Estado" }, { header: "Fecha", key: "Fecha" },
    ];
    wsVentas.addRows(ventasRows);

    type Lata = { descripcion: string; cantidad: number; color: string; tipo?: string; espesor_mm?: number };
    const fmtLatas = (latas: unknown): string => {
      const arr = Array.isArray(latas) ? (latas as Lata[]) : [];
      return arr.map((l) => `${l.cantidad}× ${l.descripcion} [${l.tipo ?? "Ondulado"} · ${l.color} · ${l.espesor_mm ?? 0.4}mm]`).join(" | ");
    };
    const gastosRows = (gastos ?? []).map((g) => ({
      Tipo: g.tipo, Descripcion: g.descripcion, Monto: Number(g.monto), Fecha: g.fecha,
      "Solicitado Por": g.solicitado_por ?? "",
      "Boleta Subida Por": g.boleta_subida_por ?? "",
      "Latas (tipo · color · espesor)": fmtLatas(g.latas),
    }));
    const wsGastos = wb.addWorksheet("Gastos");
    wsGastos.columns = [
      { header: "Tipo", key: "Tipo" }, { header: "Descripcion", key: "Descripcion" },
      { header: "Monto", key: "Monto" }, { header: "Fecha", key: "Fecha" },
      { header: "Solicitado Por", key: "Solicitado Por" },
      { header: "Boleta Subida Por", key: "Boleta Subida Por" },
      { header: "Latas (tipo · color · espesor)", key: "Latas (tipo · color · espesor)" },
    ];
    wsGastos.addRows(gastosRows);

    const totalVendido = ventasRows.reduce((s, r) => s + r.Pagado, 0);
    const totalGastos = gastosRows.reduce((s, r) => s + r.Monto, 0);
    const utilidades = totalVendido - totalGastos;
    const iva = Math.round((totalVendido * 0.19) / 1.19);
    const resumen = [
      { Concepto: "Mes", Valor: `${data.month}/${data.year}` },
      { Concepto: "Ganancias totales (pagado)", Valor: totalVendido },
      { Concepto: "Gastos aprobados", Valor: totalGastos },
      { Concepto: "Utilidades", Valor: utilidades },
      { Concepto: "IVA (19%)", Valor: iva },
      { Concepto: "Resultado final", Valor: utilidades - iva },
    ];
    const wsResumen = wb.addWorksheet("Resumen");
    wsResumen.columns = [{ header: "Concepto", key: "Concepto" }, { header: "Valor", key: "Valor" }];
    wsResumen.addRows(resumen);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(arrayBuffer as ArrayBuffer).toString("base64");
    return { filename: `fermaval-${data.year}-${String(data.month).padStart(2,"0")}.xlsx`, base64: buf };
  });

// ============= Superadmin-only edit/delete =============

export const updateCotizacionFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    cliente: z.object({
      id: z.string().uuid(),
      nombre: z.string().trim().min(2),
      telefono: z.string().trim().min(3),
      correo: z.string().trim().email(),
      direccion: z.string().trim().min(3),
    }),
    items: z.array(ItemSchema).min(1).max(50),
    color_nombre: z.string().nullable().optional(),
    precio_m2: z.number().positive(),
    descuento: z.number().min(0).default(0),
    pago_recibido: z.number().min(0),
    estado: z.enum(["cotizacion_creada","esperando_pago","pago_parcial","pedido_confirmado","pedido_terminado","rechazada"]),
    responsable_nombre: z.string().trim().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const itemsCalc = await buildItemsCalc(context.supabase as never, data.items);
    const metros2 = Number(itemsCalc.reduce((s, x) => s + x.metros2, 0).toFixed(2));
    const total = Math.max(0, Math.round(metros2 * data.precio_m2 - data.descuento));
    const saldo = Math.max(0, total - data.pago_recibido);
    const first = itemsCalc[0];
    const { data: prev } = await context.supabase.from("cotizaciones").select("numero, total, estado").eq("id", data.id).single();
    const { error: cErr } = await context.supabase.from("clientes").update({
      nombre: data.cliente.nombre, telefono: data.cliente.telefono,
      correo: data.cliente.correo, direccion: data.cliente.direccion,
    }).eq("id", data.cliente.id);
    if (cErr) throw new Error(cErr.message);
    const colorNombreCot = data.color_nombre ?? first.color_nombre ?? null;
    const { error } = await context.supabase.from("cotizaciones").update({
      largo_m: first.largo_m, ancho_m: 1, cantidad_planchas: first.cantidad_planchas, metros2,
      precio_m2: data.precio_m2, descuento: data.descuento,
      total, pago_recibido: data.pago_recibido, saldo,
      color_id: first.color_id, color_nombre: colorNombreCot, estado: data.estado,
      responsable_nombre: data.responsable_nombre ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("cotizacion_items").delete().eq("cotizacion_id", data.id);
    const { error: itErr } = await context.supabase
      .from("cotizacion_items")
      .insert(itemsCalc.map((it, idx) => ({ ...it, cotizacion_id: data.id, position: idx })));
    if (itErr) throw new Error(itErr.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "cotizaciones", accion: "update",
      cambio: `Cotización ${prev?.numero ?? data.id} editada`,
      valor_antes: prev ? `total=${prev.total} estado=${prev.estado}` : null,
      valor_despues: `total=${total} estado=${data.estado} items=${itemsCalc.length}`,
    });
    return { ok: true };
  });


export const deleteCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase.from("cotizaciones").select("numero, total").eq("id", data.id).single();
    await restoreStockForCotizacion(
      context.supabase as never, data.id, context.userId, email,
      "Reposición por eliminación de cotización",
    );
    const { error } = await context.supabase.from("cotizaciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "cotizaciones", accion: "delete",
      cambio: `Cotización ${prev?.numero ?? data.id} eliminada`,
      valor_antes: prev ? `total=${prev.total}` : null, valor_despues: null,
    });
    return { ok: true };
  });

export const updateBoleta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    tipo_gasto: z.enum(["materiales", "transporte", "herramientas", "servicios", "otros"]),
    descripcion: z.string().trim().max(300).nullable().optional(),
    monto: z.number().positive(),
    fecha: z.string(),
    responsable: personaSchema.nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase.from("boletas").select("monto, tipo_gasto, fecha, responsable").eq("id", data.id).single();
    const { error } = await context.supabase.from("boletas").update({
      tipo_gasto: data.tipo_gasto, descripcion: data.descripcion ?? null,
      monto: data.monto, fecha: data.fecha,
      responsable: data.responsable ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "boletas", accion: "update",
      cambio: `Boleta editada`,
      valor_antes: prev ? `${prev.tipo_gasto} ${prev.monto} ${prev.fecha} resp=${(prev as { responsable?: string | null }).responsable ?? "—"}` : null,
      valor_despues: `${data.tipo_gasto} ${data.monto} ${data.fecha} resp=${data.responsable ?? "—"}`,
    });
    return { ok: true };
  });

export const deleteBoleta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase.from("boletas").select("archivo_path, archivo_nombre, monto").eq("id", data.id).single();
    if (prev?.archivo_path) {
      await context.supabase.storage.from("boletas").remove([prev.archivo_path]);
    }
    const { error } = await context.supabase.from("boletas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "boletas", accion: "delete",
      cambio: `Boleta eliminada (${prev?.archivo_nombre ?? "sin nombre"})`,
      valor_antes: prev ? `monto=${prev.monto}` : null, valor_despues: null,
    });
    return { ok: true };
  });

export const limpiarDatosPrueba = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    confirmacion: z.literal("CONFIRMAR"),
    cotizaciones: z.boolean(),
    boletas: z.boolean(),
    egresos: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const out: Record<string, number> = {};
    if (data.cotizaciones) {
      const { data: rows } = await context.supabase.from("cotizaciones").select("id");
      const ids = (rows ?? []).map((r) => r.id);
      if (ids.length) {
        await context.supabase.from("pagos").delete().in("cotizacion_id", ids);
        const { error, count } = await context.supabase.from("cotizaciones").delete({ count: "exact" }).in("id", ids);
        if (error) throw new Error(error.message);
        out.cotizaciones = count ?? ids.length;
      } else out.cotizaciones = 0;
    }
    if (data.boletas) {
      const { data: rows } = await context.supabase.from("boletas").select("id, archivo_path");
      const paths = (rows ?? []).map((r) => r.archivo_path).filter(Boolean);
      if (paths.length) await context.supabase.storage.from("boletas").remove(paths);
      const { error, count } = await context.supabase.from("boletas").delete({ count: "exact" }).gt("monto", -1);
      if (error) throw new Error(error.message);
      out.boletas = count ?? 0;
    }
    if (data.egresos) {
      const { error, count } = await context.supabase.from("solicitudes_egreso").delete({ count: "exact" }).gt("monto", -1);
      if (error) throw new Error(error.message);
      out.egresos = count ?? 0;
    }
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "sistema", accion: "purge",
      cambio: `Limpieza de datos de prueba: ${JSON.stringify(out)}`,
      valor_antes: null, valor_despues: JSON.stringify(out),
    });
    return out;
  });

// ============= Buscar Cotizaciones =============

export const searchCotizaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    q: z.string().trim().max(120).optional().default(""),
    pago: z.enum(["all","sin_pago","pago_20","pago_50","pago_total"]).default("all"),
    pedido: z.enum(["all","en_preparacion","en_produccion","pedido_entregado","finalizado"]).default("all"),
    desde: z.string().optional().nullable(),
    hasta: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("cotizaciones")
      .select("*, cliente:clientes(nombre, correo, telefono, direccion), items:cotizacion_items(id, position, largo_m, ancho_m, cantidad_planchas, metros2, color_id, color_nombre, tipo, espesor_mm)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.pedido !== "all") query = query.eq("estado_pedido", data.pedido);
    if (data.desde) query = query.gte("created_at", new Date(data.desde).toISOString());
    if (data.hasta) {
      const h = new Date(data.hasta); h.setHours(23,59,59,999);
      query = query.lte("created_at", h.toISOString());
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    let list = rows ?? [];
    const q = data.q.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const c = r.cliente as { nombre?: string; correo?: string; telefono?: string } | null;
        return (
          r.numero?.toLowerCase().includes(q) ||
          (c?.nombre ?? "").toLowerCase().includes(q) ||
          (c?.correo ?? "").toLowerCase().includes(q) ||
          (c?.telefono ?? "").toLowerCase().includes(q)
        );
      });
    }
    if (data.pago !== "all") {
      list = list.filter((r) => {
        const total = Number(r.total) || 0;
        const pago = Number(r.pago_recibido) || 0;
        const pct = total > 0 ? pago / total : 0;
        if (data.pago === "sin_pago") return pago === 0;
        if (data.pago === "pago_20") return pct >= 0.15 && pct < 0.40;
        if (data.pago === "pago_50") return pct >= 0.40 && pct < 0.95;
        if (data.pago === "pago_total") return pct >= 0.95;
        return true;
      });
    }
    return list;
  });

export const setPagoCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    tier: z.enum(["sin_pago","pago_20","pago_50","pago_total"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase
      .from("cotizaciones").select("numero, total, pago_recibido, estado").eq("id", data.id).single();
    if (!prev) throw new Error("Cotización no encontrada");
    const total = Number(prev.total) || 0;
    const factor = data.tier === "sin_pago" ? 0
      : data.tier === "pago_20" ? 0.20
      : data.tier === "pago_50" ? 0.50 : 1;
    const pago = Math.round(total * factor);
    const saldo = Math.max(0, total - pago);
    const nuevoEstado =
      pago === 0 ? "esperando_pago" :
      pago >= total ? "pedido_confirmado" : "pago_parcial";
    const { error } = await context.supabase.from("cotizaciones").update({
      pago_recibido: pago, saldo, estado: nuevoEstado,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (nuevoEstado === "pago_parcial" || nuevoEstado === "pedido_confirmado") {
      await discountStockForCotizacion(context.supabase as never, data.id, context.userId, email);
    } else {
      await restoreStockForCotizacion(
        context.supabase as never, data.id, context.userId, email,
        "Reposición por pago revertido a sin pago",
      );
    }
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "cotizaciones", accion: "pago",
      cambio: `Pago de ${prev.numero} establecido en ${data.tier}`,
      valor_antes: `pagado=${prev.pago_recibido}`, valor_despues: `pagado=${pago} saldo=${saldo}`,
    });
    return { ok: true };
  });

export const setEstadoPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    estado_pedido: z.enum(["en_preparacion","en_produccion","pedido_entregado","finalizado"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase
      .from("cotizaciones").select("numero, total, pago_recibido, estado_pedido").eq("id", data.id).single();
    if (!prev) throw new Error("Cotización no encontrada");

    if (data.estado_pedido === "finalizado") {
      const total = Number(prev.total) || 0;
      const pagado = Number(prev.pago_recibido) || 0;
      if (pagado < total) throw new Error("No se puede finalizar: el pago total aún no se ha recibido.");
    }

    const patch: { estado_pedido: typeof data.estado_pedido; estado?: "pedido_terminado" } = {
      estado_pedido: data.estado_pedido,
    };
    if (data.estado_pedido === "finalizado") patch.estado = "pedido_terminado";

    const { error } = await context.supabase.from("cotizaciones").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "cotizaciones", accion: "estado_pedido",
      cambio: `${prev.numero}: estado pedido ${prev.estado_pedido} → ${data.estado_pedido}`,
      valor_antes: String(prev.estado_pedido), valor_despues: data.estado_pedido,
    });
    return { ok: true };
  });

export const getResumenSeguimiento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cotizaciones").select("total, pago_recibido, estado_pedido");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    let sin_pago = 0, p20 = 0, p50 = 0, total_pagos = 0, entregados = 0;
    for (const r of rows) {
      const t = Number(r.total) || 0;
      const p = Number(r.pago_recibido) || 0;
      const pct = t > 0 ? p / t : 0;
      if (p === 0) sin_pago++;
      else if (pct >= 0.95) total_pagos++;
      else if (pct >= 0.40) p50++;
      else if (pct >= 0.15) p20++;
      if (r.estado_pedido === "pedido_entregado" || r.estado_pedido === "finalizado") entregados++;
    }
    return { sin_pago, p20, p50, total_pagos, entregados, totalCot: rows.length };
  });

export const getCotizacionAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ numero: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("config_audit_log").select("*")
      .eq("entidad", "cotizaciones")
      .ilike("cambio", `%${data.numero}%`)
      .order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ====== Gestión de empleados (solo superadmin) ======
export const listEmpleados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertSuperadmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const ids = usersData.users.map((u) => u.id);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }
    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
      roles: byUser.get(u.id) ?? [],
      is_superadmin: (u.email ?? "").toLowerCase() === SUPERADMIN_EMAIL,
    }));
  });

export const crearEmpleado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    nombre: z.string().trim().max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    assertSuperadmin(context.claims.email as string | undefined);
    if (data.email.toLowerCase() === SUPERADMIN_EMAIL) {
      throw new Error("Ese correo está reservado para el Administrador General.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre ?? "" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
    // Asignar rol estándar 'admin' (mismos permisos que los 3 perfiles del equipo)
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    if (rErr) throw new Error(rErr.message);
    await context.supabase.from("config_audit_log").insert({
      user_email: (context.claims.email as string) ?? "", entidad: "user_roles", accion: "insert",
      cambio: `Alta empleado ${data.email}`, valor_antes: null, valor_despues: "admin",
    });
    return { id: created.user.id };
  });

export const eliminarEmpleado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    assertSuperadmin(context.claims.email as string | undefined);
    if (data.email.toLowerCase() === SUPERADMIN_EMAIL) {
      throw new Error("No puedes eliminar al Administrador General.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_email: (context.claims.email as string) ?? "", entidad: "user_roles", accion: "delete",
      cambio: `Eliminación empleado ${data.email}`, valor_antes: "admin", valor_despues: null,
    });
    return { ok: true };
  });

export const resetPasswordEmpleado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    assertSuperadmin(context.claims.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_email: (context.claims.email as string) ?? "", entidad: "user_roles", accion: "update",
      cambio: `Reset password empleado ${data.user_id}`, valor_antes: null, valor_despues: "***",
    });
    return { ok: true };
  });
