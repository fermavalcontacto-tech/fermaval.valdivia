import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes } from "crypto";

const GETNET_ENDPOINT =
  process.env.GETNET_ENDPOINT ?? "https://checkout.test.getnet.cl/api/session";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

type NotifyBody = {
  requestId?: number | string;
  reference?: string;
  signature?: string;
  status?: { status?: string; message?: string; date?: string; reason?: string };
};

type GetnetPayment = {
  status?: { status?: string; date?: string; message?: string };
  amount?: { from?: { currency?: string; total?: number }; to?: { currency?: string; total?: number } };
};

type GetnetSessionResp = {
  status?: { status?: string; message?: string };
  request?: { payment?: { reference?: string; amount?: { currency?: string; total?: number } } };
  payment?: GetnetPayment[];
};

function buildAuth(login: string, secretKey: string) {
  const nonceBytes = randomBytes(16);
  const nonceB64 = nonceBytes.toString("base64");
  const seed = new Date().toISOString();
  const hash = createHash("sha256")
    .update(Buffer.concat([nonceBytes, Buffer.from(seed + secretKey, "utf8")]))
    .digest();
  return { login, tranKey: hash.toString("base64"), nonce: nonceB64, seed };
}

async function fetchSessionAmount(requestId: number | string, login: string, secretKey: string) {
  try {
    const url = `${GETNET_ENDPOINT.replace(/\/$/, "")}/${encodeURIComponent(String(requestId))}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth: buildAuth(login, secretKey) }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as GetnetSessionResp;
    const approved = (json.payment ?? []).filter((p) => p.status?.status === "APPROVED");
    if (!approved.length) return null;
    // Sumar montos aprobados
    const total = approved.reduce(
      (acc, p) => acc + Math.round(Number(p.amount?.to?.total ?? p.amount?.from?.total ?? 0)),
      0,
    );
    return Number.isFinite(total) && total > 0 ? total : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/webhook-getnet")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        new Response(JSON.stringify({ ok: true, service: "webhook-getnet" }), {
          headers: { "Content-Type": "application/json", ...CORS },
        }),
      POST: async ({ request }) => {
        try {
          const secretKey = process.env.GETNET_SECRET_KEY;
          const login = process.env.GETNET_LOGIN;
          if (!secretKey || !login) {
            return new Response(JSON.stringify({ error: "Missing config" }), {
              status: 500,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const body = (await request.json()) as NotifyBody;
          const requestId = body.requestId;
          const status = body.status?.status ?? "";
          const date = body.status?.date ?? "";
          const signature = body.signature ?? "";

          if (!requestId || !status || !date || !signature) {
            return new Response(JSON.stringify({ error: "Payload incompleto" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const expected = createHash("sha1")
            .update(`${requestId}${status}${date}${secretKey}`)
            .digest("hex");
          if (expected !== signature) {
            return new Response(JSON.stringify({ error: "Firma inválida" }), {
              status: 401,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Lookup autoritativo por request_id (jamás por `reference` sin firmar).
          const { data: session } = await supabaseAdmin
            .from("getnet_sessions" as never)
            .select("request_id, cotizacion_id, monto_esperado, status")
            .eq("request_id", requestId)
            .maybeSingle();

          if (!session) {
            // Firma correcta pero requestId desconocido → nada que actualizar.
            return new Response(JSON.stringify({ ok: true, ignored: "unknown_session" }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const s = session as unknown as {
            request_id: number;
            cotizacion_id: string;
            monto_esperado: number;
            status: string | null;
          };

          // Traer monto real aprobado desde Getnet (no confiar en el body).
          const montoAprobado =
            status === "APPROVED" ? await fetchSessionAmount(requestId, login, secretKey) : null;

          await supabaseAdmin
            .from("getnet_sessions" as never)
            .update({
              status,
              monto_aprobado: montoAprobado,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("request_id", requestId);

          if (status === "APPROVED" && montoAprobado && montoAprobado > 0) {
            const { data: cot } = await supabaseAdmin
              .from("cotizaciones")
              .select("id, total, pago_recibido, estado")
              .eq("id", s.cotizacion_id)
              .maybeSingle();

            if (cot) {
              // Evitar procesar dos veces el mismo requestId.
              const { data: prev } = await supabaseAdmin
                .from("pagos")
                .select("id")
                .eq("cotizacion_id", cot.id)
                .eq("metodo", `getnet:${requestId}`)
                .maybeSingle();

              if (!prev) {
                // Créditar solo lo realmente aprobado, tope al saldo esperado.
                const credit = Math.min(montoAprobado, s.monto_esperado);
                const nuevoPagado = Number(cot.pago_recibido) + credit;
                const total = Number(cot.total);
                const saldo = Math.max(0, total - nuevoPagado);

                await supabaseAdmin.from("pagos").insert({
                  cotizacion_id: cot.id,
                  monto: credit,
                  metodo: `getnet:${requestId}`,
                  estado: "aprobado",
                });
                await supabaseAdmin
                  .from("cotizaciones")
                  .update({
                    pago_recibido: nuevoPagado,
                    saldo,
                    estado: saldo === 0 ? "pedido_confirmado" : "pago_parcial",
                  })
                  .eq("id", cot.id);
              }
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
