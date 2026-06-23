import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CreateQuoteSchema = z.object({
  cliente: z.object({
    nombre: z.string().trim().min(2).max(120),
    telefono: z.string().trim().min(6).max(40),
    correo: z.string().trim().email().max(160),
    direccion: z.string().trim().min(4).max(300),
  }),
  largo_m: z.number().positive().max(1000),
  ancho_m: z.number().positive().max(1000),
  color_id: z.string().uuid().nullable().optional(),
});

const AcceptSchema = z.object({
  numero: z.string().min(1).max(40),
  porcentaje: z.union([z.literal(20), z.literal(50)]),
  correo: z.string().trim().email().max(160),
});

export const createPublicQuote = createServerFn({ method: "POST" })
  .inputValidator((data) => CreateQuoteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("configuracion_web")
      .select("precio_m2")
      .eq("id", 1)
      .single();
    if (cfgErr) throw new Error("No se pudo cargar la configuración");

    const precio = Number(cfg.precio_m2);
    const metros2 = Number((data.largo_m * data.ancho_m).toFixed(2));
    const total = Math.round(metros2 * precio);

    let color_nombre: string | null = null;
    if (data.color_id) {
      const { data: c } = await supabaseAdmin.from("colores").select("nombre").eq("id", data.color_id).maybeSingle();
      color_nombre = c?.nombre ?? null;
    }

    const { data: cliente, error: ceErr } = await supabaseAdmin
      .from("clientes")
      .insert({ ...data.cliente })
      .select("id")
      .single();
    if (ceErr) throw new Error("No se pudo registrar el cliente");

    // generate quote number via sequence
    const { data: seqVal, error: seqErr } = await supabaseAdmin.rpc("nextval_quote");
    let numero: string;
    if (seqErr || seqVal == null) {
      numero = "FV-" + Date.now().toString().slice(-7);
    } else {
      numero = "FV-" + String(seqVal as unknown as number).padStart(5, "0");
    }

    const { data: cot, error: cotErr } = await supabaseAdmin
      .from("cotizaciones")
      .insert({
        numero,
        cliente_id: cliente.id,
        largo_m: data.largo_m,
        ancho_m: data.ancho_m,
        metros2,
        color_id: data.color_id ?? null,
        color_nombre,
        precio_m2: precio,
        total,
        saldo: total,
        estado: "cotizacion_creada",
        plazo_horas: 72,
      })
      .select("numero")
      .single();
    if (cotErr) throw new Error("No se pudo crear la cotización: " + cotErr.message);

    return { numero: cot.numero };
  });

export const acceptQuoteAndPay = createServerFn({ method: "POST" })
  .inputValidator((data) => AcceptSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cot, error } = await supabaseAdmin
      .from("cotizaciones")
      .select("id, total, pago_recibido, estado, numero, cliente:clientes(nombre, correo, telefono)")
      .eq("numero", data.numero)
      .single();
    if (error || !cot) throw new Error("Cotización no encontrada");
    if (cot.estado === "pedido_terminado" || cot.estado === "rechazada") {
      throw new Error("Esta cotización ya no puede ser aceptada");
    }
    // Authorization: only the customer (whose email is on file) may accept.
    const clienteCorreo = (cot.cliente as { correo?: string } | null)?.correo ?? "";
    if (clienteCorreo.trim().toLowerCase() !== data.correo.trim().toLowerCase()) {
      throw new Error("El correo no coincide con el registrado en esta cotización.");
    }
    // Idempotency: prevent stacking payment rows for the same quote+percentage.
    const { data: existingPago } = await supabaseAdmin
      .from("pagos")
      .select("id")
      .eq("cotizacion_id", cot.id)
      .eq("porcentaje", data.porcentaje)
      .maybeSingle();
    if (existingPago) {
      throw new Error("Esta cotización ya tiene un pago registrado con ese porcentaje.");
    }

    const total = Number(cot.total);
    const monto = Math.round((total * data.porcentaje) / 100);
    const nuevoPagado = Number(cot.pago_recibido) + monto;
    const saldo = Math.max(0, total - nuevoPagado);

    await supabaseAdmin.from("pagos").insert({
      cotizacion_id: cot.id,
      porcentaje: data.porcentaje,
      monto,
      metodo: "pendiente_confirmacion",
      estado: "registrado",
    });

    await supabaseAdmin
      .from("cotizaciones")
      .update({
        pago_recibido: nuevoPagado,
        saldo,
        estado: saldo === 0 ? "pedido_confirmado" : "pago_parcial",
      })
      .eq("id", cot.id);

    // Flow 2: notify admin that the client approved the quote — best-effort.
    try {
      const { sendGmail, ADMIN_INBOX } = await import("@/lib/gmail.server");
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const host = getRequestHeader("host") ?? "";
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      const base = host ? `${proto}://${host}` : "";
      const cliente = cot.cliente as { nombre?: string; correo?: string; telefono?: string } | null;
      const totalFmt = total.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
      const montoFmt = monto.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
      const text = [
        `El cliente ha APROBADO la cotización ${cot.numero}.`,
        "",
        `Cliente: ${cliente?.nombre ?? "—"}`,
        `Correo: ${cliente?.correo ?? "—"}`,
        `Teléfono: ${cliente?.telefono ?? "—"}`,
        `Total cotización: ${totalFmt}`,
        `Pago comprometido: ${montoFmt} (${data.porcentaje}%)`,
        `Saldo: ${saldo.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}`,
        "",
        base
          ? `Ver cotización: ${base}/cotizacion/${cot.numero}`
          : `Cotización: /cotizacion/${cot.numero}`,
        base ? `Panel admin: ${base}/admin/cotizaciones` : "",
      ].filter(Boolean).join("\r\n");
      await sendGmail({
        to: ADMIN_INBOX,
        subject: `cotizacion nro ${cot.numero} - APROBADA POR CLIENTE`,
        text,
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
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });
  return { cfg, colores: colores ?? [] };
});
