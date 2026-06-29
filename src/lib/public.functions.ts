import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ANCHO_FIJO_M = 1;
const ESPESOR_FIJO_MM = 0.4;
const TIPOS_PRODUCTO = ["Ondulado","PV8","PV8 Invertido","Microondulado","6V","PV4","Lata Lisa"] as const;
const TipoEnum = z.enum(TIPOS_PRODUCTO);

const ItemSchema = z.object({
  largo_m: z.number().positive().max(1000),
  cantidad_planchas: z.number().int().positive().max(10000),
  color_id: z.string().uuid().nullable().optional(),
  tipo: TipoEnum.optional().default("Ondulado"),
  espesor_mm: z.number().optional().default(ESPESOR_FIJO_MM),
});

const CreateQuoteSchema = z.object({
  cliente: z.object({
    nombre: z.string().trim().min(2).max(120),
    telefono: z.string().trim().max(40).optional().default(""),
    correo: z.string().trim().max(160).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo inválido").optional().default(""),
    direccion: z.string().trim().max(300).optional().default(""),
  }),
  items: z.array(ItemSchema).min(1).max(50),
  color_id: z.string().uuid().nullable().optional(),
});


const AcceptSchema = z.object({
  numero: z.string().min(1).max(40),
  porcentaje: z.union([z.literal(20), z.literal(50)]),
  correo: z.string().trim().email().max(160),
  token: z.string().min(16).max(80),
});

export const createPublicQuote = createServerFn({ method: "POST" })
  .inputValidator((data) => CreateQuoteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("configuracion_web").select("precio_m2").eq("id", 1).single();
    if (cfgErr) throw new Error("No se pudo cargar la configuración");

    const precio = Number(cfg.precio_m2);
    const colorIds = Array.from(new Set([
      ...(data.color_id ? [data.color_id] : []),
      ...data.items.map((i) => i.color_id).filter((x): x is string => !!x),
    ]));
    const colorNames = new Map<string, string>();
    if (colorIds.length) {
      const { data: cols } = await supabaseAdmin.from("colores").select("id, nombre").in("id", colorIds);
      for (const c of (cols ?? [])) colorNames.set(c.id, c.nombre);
    }

    // Variantes (tipo+color+espesor)
    const { data: variantes } = colorIds.length
      ? await supabaseAdmin.from("producto_variantes")
          .select("id, tipo, color_id, espesor_mm, stock_m").in("color_id", colorIds)
      : { data: [] as Array<{ id: string; tipo: string; color_id: string; espesor_mm: number; stock_m: number }> };
    const varMap = new Map<string, { id: string; stock_m: number }>();
    for (const v of variantes ?? []) {
      varMap.set(`${v.tipo}|${v.color_id}|${Number(v.espesor_mm).toFixed(2)}`, { id: v.id, stock_m: Number(v.stock_m) });
    }

    const itemsCalc = data.items.map((it) => {
      const cid = it.color_id ?? data.color_id ?? null;
      const tipo = it.tipo ?? "Ondulado";
      const espesor = it.espesor_mm ?? ESPESOR_FIJO_MM;
      const key = cid ? `${tipo}|${cid}|${espesor.toFixed(2)}` : null;
      const variante = key ? varMap.get(key) : undefined;
      return {
        largo_m: it.largo_m,
        ancho_m: ANCHO_FIJO_M,
        cantidad_planchas: it.cantidad_planchas,
        metros2: Number((it.largo_m * ANCHO_FIJO_M * it.cantidad_planchas).toFixed(2)),
        color_id: cid,
        color_nombre: cid ? (colorNames.get(cid) ?? null) : null,
        tipo, espesor_mm: espesor,
        variante_id: variante?.id ?? null,
      };
    });

    // Validación de stock por variante
    const byVar = new Map<string, { stock: number; need: number; nombre: string }>();
    for (const it of itemsCalc) {
      if (!it.variante_id) {
        if (it.color_id) throw new Error(`No existe variante de stock para ${it.tipo} · ${it.color_nombre ?? "color"} · ${it.espesor_mm}mm.`);
        continue;
      }
      const v = varMap.get(`${it.tipo}|${it.color_id}|${(it.espesor_mm).toFixed(2)}`)!;
      const prev = byVar.get(it.variante_id);
      byVar.set(it.variante_id, {
        stock: v.stock_m,
        need: (prev?.need ?? 0) + it.metros2,
        nombre: `${it.tipo} ${it.color_nombre ?? ""} ${it.espesor_mm}mm`.trim(),
      });
    }
    for (const [, info] of byVar) {
      if (info.stock < info.need) {
        throw new Error(`Stock insuficiente para "${info.nombre}" (disponible: ${info.stock} m, solicitado: ${info.need.toFixed(2)} m).`);
      }
    }

    const metros2Total = Number(itemsCalc.reduce((s, x) => s + x.metros2, 0).toFixed(2));
    const total = Math.round(metros2Total * precio);
    const first = itemsCalc[0];
    const color_nombre = first.color_nombre ?? (data.color_id ? colorNames.get(data.color_id) ?? null : null);
    const color_id_cot = first.color_id ?? data.color_id ?? null;

    const { data: cliente, error: ceErr } = await supabaseAdmin
      .from("clientes").insert({ ...data.cliente }).select("id").single();
    if (ceErr) throw new Error("No se pudo registrar el cliente");

    const { data: seqVal, error: seqErr } = await supabaseAdmin.rpc("nextval_quote");
    const numero = seqErr || seqVal == null
      ? "FV-" + Date.now().toString().slice(-7)
      : "FV-" + String(seqVal as unknown as number).padStart(5, "0");

    const access_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    const { data: cot, error: cotErr } = await supabaseAdmin
      .from("cotizaciones")
      .insert({
        numero, cliente_id: cliente.id,
        largo_m: first.largo_m, ancho_m: ANCHO_FIJO_M,
        cantidad_planchas: first.cantidad_planchas,
        metros2: metros2Total, color_id: color_id_cot, color_nombre,
        precio_m2: precio, total, saldo: total,
        estado: "cotizacion_creada", plazo_horas: 72,
        access_token, origen: "cliente",
        responsable_nombre: null,
      })
      .select("id, numero, access_token").single();
    if (cotErr) {
      console.error("[createPublicQuote] cotizaciones insert failed:", cotErr);
      throw new Error("No se pudo crear la cotización. Por favor intenta de nuevo.");
    }

    const { error: itErr } = await supabaseAdmin
      .from("cotizacion_items")
      .insert(itemsCalc.map((it, idx) => ({ ...it, cotizacion_id: cot.id, position: idx })));
    if (itErr) {
      console.error("[createPublicQuote] cotizacion_items insert failed:", itErr);
      throw new Error("No se pudo guardar el detalle de la cotización. Por favor intenta de nuevo.");
    }

    return { numero: cot.numero, access_token: cot.access_token };
  });

export const acceptQuoteAndPay = createServerFn({ method: "POST" })
  .inputValidator((data) => AcceptSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cot, error } = await supabaseAdmin
      .from("cotizaciones")
      .select("id, total, pago_recibido, estado, numero, access_token, cliente:clientes(nombre, correo, telefono)")
      .eq("numero", data.numero).single();
    if (error || !cot) throw new Error("Cotización no encontrada");
    const expected = String(cot.access_token ?? "");
    const provided = String(data.token ?? "");
    if (!expected || provided.length !== expected.length) throw new Error("Cotización no encontrada");
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    if (diff !== 0) throw new Error("Cotización no encontrada");
    if (cot.estado === "pedido_terminado" || cot.estado === "rechazada") {
      throw new Error("Esta cotización ya no puede ser aceptada");
    }
    if (cot.estado === "pedido_confirmado") throw new Error("Esta cotización ya fue confirmada como pedido.");
    const clienteCorreo = (cot.cliente as { correo?: string } | null)?.correo ?? "";
    if (clienteCorreo.trim().toLowerCase() !== data.correo.trim().toLowerCase()) {
      throw new Error("El correo no coincide con el registrado en esta cotización.");
    }
    const { data: existingPago } = await supabaseAdmin
      .from("pagos").select("id").eq("cotizacion_id", cot.id).eq("porcentaje", data.porcentaje).maybeSingle();
    if (existingPago) throw new Error("Esta cotización ya tiene un pago registrado con ese porcentaje.");

    const total = Number(cot.total);
    const monto = Math.round((total * data.porcentaje) / 100);
    const nuevoPagado = Number(cot.pago_recibido) + monto;
    const saldo = Math.max(0, total - nuevoPagado);

    await supabaseAdmin.from("pagos").insert({
      cotizacion_id: cot.id, porcentaje: data.porcentaje, monto,
      metodo: "pendiente_confirmacion", estado: "registrado",
    });

    await supabaseAdmin
      .from("cotizaciones")
      .update({
        pago_recibido: nuevoPagado, saldo,
        estado: saldo === 0 ? "pedido_confirmado" : "pago_parcial",
      })
      .eq("id", cot.id);

    try {
      const { sendGmail, INTERNAL_BCC } = await import("@/lib/gmail.server");
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const host = getRequestHeader("host") ?? "";
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      const base = host ? `${proto}://${host}` : "";
      const cliente = cot.cliente as { nombre?: string; correo?: string; telefono?: string } | null;
      const fmt = (n: number) => n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
      const totalFmt = fmt(total);
      const montoFmt = fmt(monto);
      const saldoFmt = fmt(saldo);
      const tokenQs = `?t=${encodeURIComponent(String(cot.access_token ?? ""))}`;
      const linkCot = base ? `${base}/cotizacion/${cot.numero}${tokenQs}` : `/cotizacion/${cot.numero}${tokenQs}`;

      const clientText = [
        `Hola ${cliente?.nombre ?? ""},`, "",
        `¡Gracias por aceptar tu cotización ${cot.numero}!`, "",
        `Total: ${totalFmt}`,
        `Pago comprometido (${data.porcentaje}%): ${montoFmt}`,
        `Saldo por pagar: ${saldoFmt}`, "",
        `Puedes revisar tu cotización aquí: ${linkCot}`, "",
        "Un ejecutivo se pondrá en contacto contigo para coordinar el pago y la confirmación final del pedido.",
        "", "Saludos,", "Equipo FERMAVAL", "fermaval.contacto@gmail.com",
      ].join("\r\n");
      await sendGmail({
        to: data.correo, bcc: INTERNAL_BCC,
        subject: `Hemos recibido tu aceptación de la cotización ${cot.numero}`,
        text: clientText,
      });

      const internalText = [
        `El cliente ha APROBADO la cotización ${cot.numero}.`, "",
        `Cliente: ${cliente?.nombre ?? "—"}`,
        `Correo: ${cliente?.correo ?? "—"}`,
        `Teléfono: ${cliente?.telefono ?? "—"}`,
        `Total cotización: ${totalFmt}`,
        `Pago comprometido: ${montoFmt} (${data.porcentaje}%)`,
        `Saldo: ${saldoFmt}`, "",
        `Ver cotización: ${linkCot}`,
        base ? `Panel admin: ${base}/admin/cotizaciones` : "",
      ].filter(Boolean).join("\r\n");
      await sendGmail({
        to: INTERNAL_BCC,
        subject: `cotizacion nro ${cot.numero} - APROBADA POR CLIENTE`,
        text: internalText,
      });
    } catch (e) {
      console.error("notifyClientAccepted failed:", (e as Error).message);
    }

    return { ok: true, monto, saldo };
  });


export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin.from("configuracion_web").select("*").eq("id", 1).single();
  const { data: colores } = await supabaseAdmin
    .from("colores")
    .select("id, nombre, hex, imagen_url, activo, orden")
    .eq("activo", true)
    .order("orden", { ascending: true });
  return { cfg, colores: colores ?? [] };
});
