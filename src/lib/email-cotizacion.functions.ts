import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const FROM_EMAIL = "fermaval.contacto@gmail.com";

function b64url(s: string): string {
  // base64 -> base64url, no padding
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildMime(opts: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments: Array<{ filename: string; contentBase64: string; mime: string }>;
}): string {
  const boundary = "fv_boundary_" + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : "",
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join("\r\n");

  const parts: string[] = [];
  parts.push(
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.text,
  );
  for (const a of opts.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.mime}; name="${a.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${a.filename}"`,
      "",
      a.contentBase64.match(/.{1,76}/g)?.join("\r\n") ?? a.contentBase64,
    );
  }
  parts.push(`--${boundary}--`, "");
  return headers + "\r\n\r\n" + parts.join("\r\n");
}

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
    const apiKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!apiKey || !connKey) {
      throw new Error("Integración de correo no configurada.");
    }
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
      FROM_EMAIL,
    ].join("\r\n");

    const mime = buildMime({
      from: `FERMAVAL <${FROM_EMAIL}>`,
      to: data.to,
      cc: aprobadorEmail && aprobadorEmail !== data.to ? aprobadorEmail : undefined,
      subject,
      text: body,
      attachments: [
        { filename: `Cotizacion-${data.numero}.pdf`, contentBase64: data.cotizacion_pdf_base64, mime: "application/pdf" },
        { filename: `Comprobante-Pago-${data.numero}.pdf`, contentBase64: data.pago_pdf_base64, mime: "application/pdf" },
      ],
    });

    const raw = b64url(Buffer.from(mime, "utf-8").toString("base64"));

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": connKey,
      },
      body: JSON.stringify({ raw }),
    });
    const txt = await res.text();
    if (!res.ok) {
      throw new Error(`Gmail send failed: ${res.status} ${txt.slice(0, 300)}`);
    }

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
