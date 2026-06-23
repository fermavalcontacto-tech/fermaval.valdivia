import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const SUPERADMIN_EMAIL = "fermaval.contacto@gmail.com";

function assertSuperadmin(email: string | undefined) {
  if ((email ?? "").toLowerCase() !== SUPERADMIN_EMAIL) {
    throw new Error("No tienes permisos para modificar la configuración del sitio.");
  }
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
    ancho_m: z.number().positive(),
    color_nombre: z.string().nullable().optional(),
    precio_m2: z.number().positive(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cliente, error: cErr } = await context.supabase.from("clientes").insert({ ...data.cliente }).select("id").single();
    if (cErr) throw new Error(cErr.message);
    const metros2 = Number((data.largo_m * data.ancho_m).toFixed(2));
    const total = Math.round(metros2 * data.precio_m2);
    // Get next sequence via service role helper - operator can't call. Fallback to timestamp:
    const numero = "FV-" + Date.now().toString().slice(-7);
    const { error } = await context.supabase.from("cotizaciones").insert({
      numero, cliente_id: cliente.id, largo_m: data.largo_m, ancho_m: data.ancho_m,
      metros2, precio_m2: data.precio_m2, total, saldo: total,
      color_nombre: data.color_nombre ?? null, created_by: context.userId,
      estado: "cotizacion_creada", plazo_horas: 72,
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

export const createEgreso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tipo: z.enum(["materiales", "transporte", "herramientas", "servicios", "otros"]),
    descripcion: z.string().trim().min(2).max(500),
    monto: z.number().positive(),
    fecha: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("solicitudes_egreso").insert({
      tipo: data.tipo, descripcion: data.descripcion, monto: data.monto, fecha: data.fecha,
      solicitante_id: context.userId, estado: "pendiente",
    });
    if (error) throw new Error(error.message);
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
    const { error } = await context.supabase.from("boletas").insert({
      tipo_gasto: data.tipo_gasto, descripcion: data.descripcion ?? null,
      monto: data.monto, fecha: data.fecha,
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
    if (data.id) {
      const { error } = await context.supabase.from("colores").update({
        nombre: data.nombre, hex: data.hex, imagen_url: data.imagen_url ?? null, activo: data.activo, orden: data.orden,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("colores").insert({
        nombre: data.nombre, hex: data.hex, imagen_url: data.imagen_url ?? null, activo: data.activo, orden: data.orden,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("colores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
    const { error } = await context.supabase.from("configuracion_web").update({
      ...data,
      logo_url: data.logo_url ?? null,
      hero_url: data.hero_url ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateMonthlyExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const start = new Date(data.year, data.month - 1, 1);
    const end = new Date(data.year, data.month, 1);
    const { data: cots } = await context.supabase
      .from("cotizaciones").select("numero, total, pago_recibido, saldo, estado, created_at, cliente:clientes(nombre)")
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    const { data: gastos } = await context.supabase
      .from("solicitudes_egreso").select("tipo, descripcion, monto, fecha, estado")
      .eq("estado","aprobado").gte("fecha", start.toISOString().slice(0,10)).lt("fecha", end.toISOString().slice(0,10));

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const ventasRows = (cots ?? []).map((c) => ({
      Numero: c.numero,
      Cliente: (c.cliente as { nombre: string } | null)?.nombre ?? "",
      Total: Number(c.total),
      Pagado: Number(c.pago_recibido),
      Saldo: Number(c.saldo),
      Estado: c.estado,
      Fecha: new Date(c.created_at as string).toLocaleDateString("es-CL"),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventasRows), "Ventas");

    const gastosRows = (gastos ?? []).map((g) => ({
      Tipo: g.tipo, Descripcion: g.descripcion, Monto: Number(g.monto), Fecha: g.fecha,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastosRows), "Gastos");

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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");

    const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    return { filename: `fermaval-${data.year}-${String(data.month).padStart(2,"0")}.xlsx`, base64: buf };
  });
