import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const SUPERADMIN_EMAIL = "fermaval.contacto@gmail.com";

function assertSuperadmin(email: string | undefined) {
  if ((email ?? "").toLowerCase() !== SUPERADMIN_EMAIL) {
    throw new Error("No tienes permisos para modificar la configuración del sitio.");
  }
}

function isSuperadminEmail(email: string | undefined) {
  return (email ?? "").toLowerCase() === SUPERADMIN_EMAIL;
}

/** Forces today's date for non-superadmin users. Superadmin may backdate. */
function enforceFecha(email: string | undefined, fecha: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!isSuperadminEmail(email)) return today;
  return fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : today;
}


export const listCotizaciones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cotizaciones")
      .select("*, cliente:clientes(nombre, correo, telefono)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

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
    largo_m: z.number().positive(),
    cantidad_planchas: z.number().int().positive().default(1),
    color_nombre: z.string().nullable().optional(),
    precio_m2: z.number().positive(),
    fecha_solicitud: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cliente, error: cErr } = await context.supabase.from("clientes").insert({ ...data.cliente }).select("id").single();
    if (cErr) throw new Error(cErr.message);
    const metros2 = Number((data.largo_m * 1 * data.cantidad_planchas).toFixed(2));
    const total = Math.round(metros2 * data.precio_m2);
    // Get next sequence via service role helper - operator can't call. Fallback to timestamp:
    const numero = "FV-" + Date.now().toString().slice(-7);
    const fechaSolicitud = enforceFecha(context.claims?.email, data.fecha_solicitud);
    const access_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const { error } = await context.supabase.from("cotizaciones").insert({
      numero, cliente_id: cliente.id, largo_m: data.largo_m, ancho_m: 1, cantidad_planchas: data.cantidad_planchas,
      metros2, precio_m2: data.precio_m2, total, saldo: total,
      color_nombre: data.color_nombre ?? null, created_by: context.userId,
      estado: "cotizacion_creada", plazo_horas: 72,
      fecha_solicitud: fechaSolicitud,
      access_token,
    });
    if (error) throw new Error(error.message);
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

    // Notify admin inbox (Flow 1) — best-effort.
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
        "",
        `ID: ${shortId}`,
        `Solicitado por: ${data.solicitado_por}`,
        `Responsable boleta: ${data.boleta_subida_por ?? "—"}`,
        `Tipo: ${data.tipo}`,
        `Monto: ${monto}`,
        `Fecha: ${fecha}`,
        `Motivo / Detalle: ${data.descripcion}`,
        "",
        base ? `Revisar / autorizar: ${base}/admin/egresos` : "Revisar en el panel /admin/egresos",
      ].join("\r\n");
      await sendGmail({
        to: ADMIN_INBOX,
        subject: `Nueva Solicitud de Dinero Pendiente - ${shortId}`,
        text,
      });
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
    if (email !== "fermaval.contacto@gmail.com") {
      throw new Error("Solo el Administrador General (fermaval.contacto@gmail.com) puede aprobar o rechazar.");
    }
    const { error } = await context.supabase.from("solicitudes_egreso").update({
      estado: data.estado, decidido_por: context.userId, decidido_at: new Date().toISOString(),
    }).eq("id", data.id);
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const fecha = enforceFecha(context.claims?.email, data.fecha);
    const { error } = await context.supabase.from("boletas").insert({
      tipo_gasto: data.tipo_gasto, descripcion: data.descripcion ?? null,
      monto: data.monto, fecha,
      archivo_path: data.archivo_path, archivo_nombre: data.archivo_nombre ?? null,
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

    const ventas = (cotMes ?? []).reduce((s, c) => s + Number(c.pago_recibido), 0);
    const totalCotizado = (cotMes ?? []).reduce((s, c) => s + Number(c.total), 0);
    const gastos = (gastosMes ?? []).reduce((s, g) => s + Number(g.monto), 0);
    const utilidades = ventas - gastos;
    const iva = Math.round(ventas * 0.19 / 1.19);

    // Series by month (last 6 months)
    const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1); since.setHours(0,0,0,0);
    const { data: all } = await context.supabase.from("cotizaciones").select("total, pago_recibido, created_at, estado").gte("created_at", since.toISOString());
    const { data: allGastos } = await context.supabase.from("solicitudes_egreso").select("monto, fecha, estado").eq("estado","aprobado").gte("fecha", since.toISOString().slice(0,10));

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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    if (data.id) {
      const { data: prev } = await context.supabase.from("colores").select("*").eq("id", data.id).single();
      const { error } = await context.supabase.from("colores").update({
        nombre: data.nombre, hex: data.hex, imagen_url: data.imagen_url ?? null, activo: data.activo, orden: data.orden,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      await context.supabase.from("config_audit_log").insert({
        user_id: context.userId, user_email: email, entidad: "colores", accion: "update",
        cambio: `Color "${data.nombre}" actualizado`,
        valor_antes: prev ? `${prev.nombre} ${prev.hex} activo=${prev.activo}` : null,
        valor_despues: `${data.nombre} ${data.hex} activo=${data.activo}`,
      });
    } else {
      const { error } = await context.supabase.from("colores").insert({
        nombre: data.nombre, hex: data.hex, imagen_url: data.imagen_url ?? null, activo: data.activo, orden: data.orden,
      });
      if (error) throw new Error(error.message);
      await context.supabase.from("config_audit_log").insert({
        user_id: context.userId, user_email: email, entidad: "colores", accion: "create",
        cambio: `Color "${data.nombre}" creado`, valor_antes: null,
        valor_despues: `${data.nombre} ${data.hex}`,
      });
    }
    return { ok: true };
  });

export const deleteColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
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
    info_comercial: z.string().min(1).max(500),
    linktree_url: z.string().url(),
    mapa_url: z.string().url(),
    mapa_embed: z.string().url(),
    telefono: z.string().min(1).max(40),
    direccion: z.string().min(1).max(200),
    instagram: z.string().max(80),
    logo_url: z.string().url().nullable().optional(),
    hero_url: z.string().url().nullable().optional(),
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
    // log per-field diffs
    const fields: Array<keyof typeof data> = [
      "precio_m2","hero_titulo","hero_subtitulo","info_comercial","linktree_url",
      "mapa_url","mapa_embed","telefono","direccion","instagram","logo_url","hero_url",
    ];
    const rows: Array<{ user_id: string; user_email: string; entidad: string; accion: string; cambio: string; valor_antes: string | null; valor_despues: string | null }> = [];
    for (const k of fields) {
      const before = prev ? (prev as Record<string, unknown>)[k] : null;
      const after = (data as Record<string, unknown>)[k] ?? null;
      if (String(before ?? "") !== String(after ?? "")) {
        rows.push({
          user_id: context.userId, user_email: email, entidad: "configuracion_web", accion: "update",
          cambio: `${k} actualizado`,
          valor_antes: before == null ? null : String(before),
          valor_despues: after == null ? null : String(after),
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
      .from("cotizaciones").select("numero, total, pago_recibido, saldo, estado, fecha_solicitud, created_at, cliente:clientes(nombre)")
      .gte("fecha_solicitud", start.toISOString().slice(0,10)).lt("fecha_solicitud", end.toISOString().slice(0,10));
    const { data: gastos } = await context.supabase
      .from("solicitudes_egreso").select("tipo, descripcion, monto, fecha, estado, solicitado_por, boleta_subida_por")
      .eq("estado","aprobado").gte("fecha", start.toISOString().slice(0,10)).lt("fecha", end.toISOString().slice(0,10));

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const ventasRows = (cots ?? []).map((c) => ({
      Numero: c.numero,
      Cliente: (c.cliente as { nombre: string } | null)?.nombre ?? "",
      Total: Number(c.total),
      Pagado: Number(c.pago_recibido),
      Saldo: Number(c.saldo),
      Estado: c.estado,
      Fecha: (c.fecha_solicitud as string) ?? new Date(c.created_at as string).toLocaleDateString("es-CL"),
    }));
    const wsVentas = wb.addWorksheet("Ventas");
    wsVentas.columns = [
      { header: "Numero", key: "Numero" },
      { header: "Cliente", key: "Cliente" },
      { header: "Total", key: "Total" },
      { header: "Pagado", key: "Pagado" },
      { header: "Saldo", key: "Saldo" },
      { header: "Estado", key: "Estado" },
      { header: "Fecha", key: "Fecha" },
    ];
    wsVentas.addRows(ventasRows);

    const gastosRows = (gastos ?? []).map((g) => ({
      Tipo: g.tipo, Descripcion: g.descripcion, Monto: Number(g.monto), Fecha: g.fecha,
      "Solicitado Por": g.solicitado_por ?? "",
      "Boleta Subida Por": g.boleta_subida_por ?? "",
    }));
    const wsGastos = wb.addWorksheet("Gastos");
    wsGastos.columns = [
      { header: "Tipo", key: "Tipo" },
      { header: "Descripcion", key: "Descripcion" },
      { header: "Monto", key: "Monto" },
      { header: "Fecha", key: "Fecha" },
      { header: "Solicitado Por", key: "Solicitado Por" },
      { header: "Boleta Subida Por", key: "Boleta Subida Por" },
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
    wsResumen.columns = [
      { header: "Concepto", key: "Concepto" },
      { header: "Valor", key: "Valor" },
    ];
    wsResumen.addRows(resumen);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(arrayBuffer as ArrayBuffer).toString("base64");
    return { filename: `fermaval-${data.year}-${String(data.month).padStart(2,"0")}.xlsx`, base64: buf };
  });

// ============= Superadmin-only edit/delete: cotizaciones & boletas =============

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
    largo_m: z.number().positive(),
    cantidad_planchas: z.number().int().positive().default(1),
    color_nombre: z.string().nullable().optional(),
    precio_m2: z.number().positive(),
    descuento: z.number().min(0).default(0),
    pago_recibido: z.number().min(0),
    estado: z.enum(["cotizacion_creada","esperando_pago","pago_parcial","pedido_confirmado","pedido_terminado","rechazada"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const metros2 = Number((data.largo_m * data.ancho_m).toFixed(2));
    const total = Math.max(0, Math.round(metros2 * data.precio_m2 - data.descuento));
    const saldo = Math.max(0, total - data.pago_recibido);
    const { data: prev } = await context.supabase.from("cotizaciones").select("numero, total, estado").eq("id", data.id).single();
    const { error: cErr } = await context.supabase.from("clientes").update({
      nombre: data.cliente.nombre, telefono: data.cliente.telefono,
      correo: data.cliente.correo, direccion: data.cliente.direccion,
    }).eq("id", data.cliente.id);
    if (cErr) throw new Error(cErr.message);
    const { error } = await context.supabase.from("cotizaciones").update({
      largo_m: data.largo_m, ancho_m: data.ancho_m, metros2,
      precio_m2: data.precio_m2, descuento: data.descuento,
      total, pago_recibido: data.pago_recibido, saldo,
      color_nombre: data.color_nombre ?? null, estado: data.estado,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "cotizaciones", accion: "update",
      cambio: `Cotización ${prev?.numero ?? data.id} editada`,
      valor_antes: prev ? `total=${prev.total} estado=${prev.estado}` : null,
      valor_despues: `total=${total} estado=${data.estado}`,
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email ?? "").toLowerCase();
    assertSuperadmin(email);
    const { data: prev } = await context.supabase.from("boletas").select("monto, tipo_gasto, fecha").eq("id", data.id).single();
    const { error } = await context.supabase.from("boletas").update({
      tipo_gasto: data.tipo_gasto, descripcion: data.descripcion ?? null,
      monto: data.monto, fecha: data.fecha,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "boletas", accion: "update",
      cambio: `Boleta editada`,
      valor_antes: prev ? `${prev.tipo_gasto} ${prev.monto} ${prev.fecha}` : null,
      valor_despues: `${data.tipo_gasto} ${data.monto} ${data.fecha}`,
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

// ============= Buscar Cotizaciones (seguimiento de pagos y pedidos) =============

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
      .select("*, cliente:clientes(nombre, correo, telefono, direccion)")
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
      .from("cotizaciones").select("numero, total, pago_recibido, estado")
      .eq("id", data.id).single();
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
    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId, user_email: email, entidad: "cotizaciones", accion: "pago",
      cambio: `Pago de ${prev.numero} establecido en ${data.tier}`,
      valor_antes: `pagado=${prev.pago_recibido}`,
      valor_despues: `pagado=${pago} saldo=${saldo}`,
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
      .from("cotizaciones").select("numero, total, pago_recibido, estado_pedido")
      .eq("id", data.id).single();
    if (!prev) throw new Error("Cotización no encontrada");

    // Si marca FINALIZADO requiere entregado + pago total
    if (data.estado_pedido === "finalizado") {
      const total = Number(prev.total) || 0;
      const pagado = Number(prev.pago_recibido) || 0;
      if (pagado < total) {
        throw new Error("No se puede finalizar: el pago total aún no se ha recibido.");
      }
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

