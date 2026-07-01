import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

// Webhook oficial de Getnet Chile (motor PlacetoPay). Getnet firma cada notificación con:
//   signature = sha1( requestId + status.status + status.date + secretKey )
// Ver documentación: https://docs.placetopay.dev/checkout/notifications

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
          if (!secretKey) {
            return new Response(JSON.stringify({ error: "Missing secret" }), {
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

          // Extraer número de cotización desde reference "NUMERO-timestamp"
          const numero = String(body.reference ?? "").split("-").slice(0, -1).join("-") || String(body.reference ?? "");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (status === "APPROVED" && numero) {
            const { data: cot } = await supabaseAdmin
              .from("cotizaciones")
              .select("id, total, pago_recibido")
              .eq("numero", numero)
              .maybeSingle();
            if (cot) {
              // Marcamos como pagada; el monto real vendría en un fetch a /api/session/{requestId},
              // aquí registramos el evento en pagos y actualizamos estado.
              await supabaseAdmin.from("pagos").insert({
                cotizacion_id: cot.id,
                monto: Number(cot.total),
                metodo: "getnet",
                referencia: String(requestId),
              });
              await supabaseAdmin
                .from("cotizaciones")
                .update({
                  estado: "pagada_completa",
                  pago_recibido: Number(cot.total),
                  saldo: 0,
                })
                .eq("id", cot.id);
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
