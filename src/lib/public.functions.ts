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
    const { data: seqData, error: seqErr } = await supabaseAdmin.rpc("nextval_quote" as never).maybeSingle();
    let numero: string;
    if (seqErr || !seqData) {
      // fallback: timestamp
      numero = "FV-" + Date.now().toString().slice(-7);
    } else {
      numero = "FV-" + String((seqData as { nextval: number }).nextval).padStart(5, "0");
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
      .select("id, total, pago_recibido, estado, numero")
      .eq("numero", data.numero)
      .single();
    if (error || !cot) throw new Error("Cotización no encontrada");
    if (cot.estado === "pedido_terminado" || cot.estado === "rechazada") {
      throw new Error("Esta cotización ya no puede ser aceptada");
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
