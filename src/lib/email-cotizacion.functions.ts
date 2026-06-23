import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendCotizacionEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    numero: z.string().min(1),
    to: z.string().email(),
    cliente_nombre: z.string(),
    total: z.number(),
    cotizacion_pdf_base64: z.string().min(10),
    pago_pdf_base64: z.string().min(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { sendGmail } = await import("@/lib/gmail.server");
    const aprobadorEmail = context.claims?.email ?? "";
    const subject = `cotizacion nro ${data.numero}`;
    const body = [
      `Estimado/a ${data.cliente_nombre},`,
      "",
      `Su cotización ${data.numero} ha sido aprobada y confirmada como pedido.`,
      `Total: ${data.total.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}`,
      "",
      "Adjuntamos la cotización aprobada y el comprobante de pago correspondiente.",
      "",
      "Saludos,",
      "FERMAVAL",
      "fermaval.contacto@gmail.com",
    ].join("\r\n");

    await sendGmail({
      to: data.to,
      cc: aprobadorEmail && aprobadorEmail !== data.to ? aprobadorEmail : undefined,
      subject,
      text: body,
      attachments: [
        { filename: `Cotizacion-${data.numero}.pdf`, contentBase64: data.cotizacion_pdf_base64, mime: "application/pdf" },
        { filename: `Comprobante-Pago-${data.numero}.pdf`, contentBase64: data.pago_pdf_base64, mime: "application/pdf" },
      ],
    });

    await context.supabase.from("config_audit_log").insert({
      user_id: context.userId,
      user_email: aprobadorEmail,
      entidad: "cotizaciones",
      accion: "email_enviado",
      cambio: `Email cotización ${data.numero} enviado a ${data.to}`,
      valor_antes: null,
      valor_despues: subject,
    });

    return { ok: true };
  });
