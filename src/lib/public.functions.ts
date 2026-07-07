import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ANCHO_FIJO_M,
  ESPESOR_FIJO_MM,
  ItemInputSchema as ItemSchema,
  buildItemsCalc,
  sumMetros2,
  calcTotal,
  publicQuoteErrorMessage,
} from "@/lib/domain/quotes.core";


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
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cfg, error: cfgErr } = await supabaseAdmin
        .from("configuracion_web").select("precio_m2").eq("id", 1).single();
      if (cfgErr) throw new Error("No se pudo cargar la configuración");

      const precio = Number(cfg.precio_m2);

      // Propagar color_id global a cada item si no lo trae, para que buildItemsCalc
      // (fuente única de cálculo) lo resuelva junto al resto.
      const itemsInput = data.items.map((it) => ({
        ...it,
        color_id: it.color_id ?? data.color_id ?? null,
      }));
      const itemsCalc = await buildItemsCalc(supabaseAdmin as never, itemsInput);

      const metros2Total = sumMetros2(itemsCalc);
      const total = calcTotal(metros2Total, precio);
      const first = itemsCalc[0];
      const color_nombre = first.color_nombre;
      const color_id_cot = first.color_id;


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

      const itemRows = itemsCalc.map((it, idx) => ({
        cotizacion_id: cot.id,
        position: idx,
        largo_m: it.largo_m,
        ancho_m: it.ancho_m,
        cantidad_planchas: it.cantidad_planchas,
        metros2: it.metros2,
        color_id: it.color_id,
        color_nombre: it.color_nombre,
        tipo: it.tipo,
        espesor_mm: it.espesor_mm,
      }));

      const { error: itErr } = await supabaseAdmin
        .from("cotizacion_items")
        .insert(itemRows);
      if (itErr) {
        console.error("[createPublicQuote] cotizacion_items insert failed:", itErr);
        throw new Error("No se pudo guardar el detalle de la cotización. Por favor intenta de nuevo.");
      }

      return { numero: cot.numero, access_token: cot.access_token };
    } catch (error) {
      const message = publicQuoteErrorMessage(error);
      console.error("[createPublicQuote] failed:", error);
      throw new Error(message);
    }
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

// Historial público del cliente: dos pasos.
// 1) `requestQuoteHistoryCode` genera un código de 6 dígitos y lo envía al correo
//    indicado; sólo llegará si el correo corresponde a un cliente real.
// 2) `listMyQuotesByEmail` requiere correo + código válido; sin proof of ownership
//    no se devuelven datos.
async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const requestQuoteHistoryCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    correo: z.string().trim().toLowerCase().email().max(160),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que existe al menos un cliente con ese correo.
    const { data: cli } = await supabaseAdmin
      .from("clientes").select("id").eq("correo", data.correo).limit(1).maybeSingle();

    // Respuesta genérica siempre (evita enumeración de correos).
    if (cli) {
      const raw = String(Math.floor(100000 + Math.random() * 900000));
      const code_hash = await sha256Hex(`${data.correo}:${raw}`);
      const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabaseAdmin.from("email_verify_codes" as never).insert({
        correo: data.correo,
        code_hash,
        purpose: "quote_history",
        expires_at,
      } as never);

      try {
        const { sendGmail } = await import("@/lib/gmail.server");
        await sendGmail({
          to: data.correo,
          subject: "Tu código para ver tus cotizaciones FERMAVAL",
          text:
            `Hola,\r\n\r\nTu código de verificación es: ${raw}\r\n` +
            `Vence en 15 minutos.\r\n\r\nSi no lo solicitaste puedes ignorar este correo.\r\n\r\nEquipo FERMAVAL`,
        });
      } catch (e) {
        console.error("requestQuoteHistoryCode email failed:", (e as Error).message);
      }
    }
    return { ok: true };
  });

export const listMyQuotesByEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    correo: z.string().trim().toLowerCase().email().max(160),
    codigo: z.string().trim().regex(/^\d{6}$/, "Código inválido"),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar el código vigente más reciente para ese correo.
    const { data: rows } = await supabaseAdmin
      .from("email_verify_codes" as never)
      .select("id, code_hash, expires_at, consumed_at, attempts")
      .eq("correo", data.correo)
      .eq("purpose", "quote_history")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0] as unknown as
      | { id: string; code_hash: string; expires_at: string; consumed_at: string | null; attempts: number }
      | undefined;

    if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5) {
      throw new Error("Código inválido o expirado. Solicita uno nuevo.");
    }

    const expectedHash = await sha256Hex(`${data.correo}:${data.codigo}`);
    // Comparación en tiempo constante.
    const a = Buffer.from(expectedHash);
    const b = Buffer.from(row.code_hash);
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
    if (diff !== 0) {
      await supabaseAdmin.from("email_verify_codes" as never)
        .update({ attempts: row.attempts + 1 } as never).eq("id", row.id);
      throw new Error("Código inválido o expirado. Solicita uno nuevo.");
    }

    await supabaseAdmin.from("email_verify_codes" as never)
      .update({ consumed_at: new Date().toISOString() } as never).eq("id", row.id);

    const { data: cots, error } = await supabaseAdmin
      .from("cotizaciones")
      .select(
        "numero, created_at, estado, metros2, color_nombre, total, pago_recibido, saldo, cliente:clientes!inner(correo)",
      )
      .eq("cliente.correo", data.correo)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (cots ?? []).map((c) => ({
      numero: c.numero,
      created_at: c.created_at,
      estado: c.estado,
      metros2: Number(c.metros2),
      color_nombre: c.color_nombre,
      total: Number(c.total),
      pago_recibido: Number(c.pago_recibido),
      saldo: Number(c.saldo),
    }));
  });


