// Server-only Gmail sending helper. Uses Lovable connector gateway with the
// linked Google Mail account (fermaval.contacto@gmail.com).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
export const FROM_EMAIL = "fermaval.contacto@gmail.com";
export const ADMIN_INBOX = "fermaval.contacto@gmail.com";
// Los 4 perfiles internos FERMAVAL que reciben copia (BCC) de cada
// notificación de aceptación de cotización y de confirmación de pedido.
export const INTERNAL_RECIPIENTS = [
  "fermaval.contacto@gmail.com",
  "freddy.torres.oliva@gmail.com",
  "Ocatorr32@gmail.com",
  "Bayrontorresnaipil@gmail.com",
] as const;
export const INTERNAL_BCC = INTERNAL_RECIPIENTS.join(", ");

function b64url(s: string) {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export type Attachment = { filename: string; contentBase64: string; mime: string };

export function buildMime(opts: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
}): string {
  const boundary = "fv_" + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : "",
    opts.bcc ? `Bcc: ${opts.bcc}` : "",
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join("\r\n");

  const parts: string[] = [];
  parts.push(
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.text, "utf-8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "",
  );
  for (const a of opts.attachments ?? []) {
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

export async function sendGmail(opts: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
}): Promise<void> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!apiKey || !connKey) throw new Error("Gmail no configurado.");
  const mime = buildMime({ from: `FERMAVAL <${FROM_EMAIL}>`, ...opts });
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail send failed ${res.status}: ${t.slice(0, 300)}`);
  }
}
