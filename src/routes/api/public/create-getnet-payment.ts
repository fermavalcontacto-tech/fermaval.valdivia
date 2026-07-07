import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes } from "crypto";

// Getnet Chile Web Checkout (motor PlacetoPay).
const GETNET_ENDPOINT =
  process.env.GETNET_ENDPOINT ?? "https://checkout.test.getnet.cl/api/session";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function buildAuth(login: string, secretKey: string) {
  const nonceBytes = randomBytes(16);
  const nonceB64 = nonceBytes.toString("base64");
  const seed = new Date().toISOString();
  const hash = createHash("sha256")
    .update(Buffer.concat([nonceBytes, Buffer.from(seed + secretKey, "utf8")]))
    .digest();
  return { login, tranKey: hash.toString("base64"), nonce: nonceB64, seed };
}

export const Route = createFileRoute("/api/public/create-getnet-payment")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const login = process.env.GETNET_LOGIN;
          const secretKey = process.env.GETNET_SECRET_KEY;
          if (!login || !secretKey) {
            return new Response(
              JSON.stringify({ error: "Getnet no está configurado (faltan credenciales)." }),
              { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          const body = (await request.json()) as {
            numero?: string;
            token?: string;
            descripcion?: string;
            returnUrl?: string;
          };

          const numero = String(body.numero ?? "").trim();
          const token = String(body.token ?? "").trim();
          if (!numero || !token) {
            return new Response(JSON.stringify({ error: "Datos inválidos." }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: cot } = await supabaseAdmin
            .from("cotizaciones")
            .select("id, numero, access_token, saldo, total, estado")
            .eq("numero", numero)
            .maybeSingle();
          if (!cot || String(cot.access_token) !== token) {
            return new Response(JSON.stringify({ error: "Cotización no encontrada." }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          if (cot.estado === "pedido_confirmado" || cot.estado === "pedido_terminado" || cot.estado === "rechazada") {
            return new Response(JSON.stringify({ error: "Esta cotización no admite pagos." }), {
              status: 409,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // El monto SIEMPRE es el saldo pendiente autoritativo del servidor,
          // nunca un valor suministrado por el cliente.
          const monto = Math.round(Number(cot.saldo));
          if (!Number.isFinite(monto) || monto <= 0) {
            return new Response(JSON.stringify({ error: "Cotización sin saldo pendiente." }), {
              status: 409,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const url = new URL(request.url);
          const origin = `${url.protocol}//${url.host}`;
          const returnUrl =
            body.returnUrl?.startsWith("http")
              ? body.returnUrl
              : `${origin}/cotizacion/${encodeURIComponent(numero)}?t=${encodeURIComponent(token)}&pago=getnet`;

          const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          const ipAddress =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "0.0.0.0";
          const userAgent = request.headers.get("user-agent") ?? "Fermaval Web";

          const reference = `${numero}-${Date.now()}`;
          const payload = {
            auth: buildAuth(login, secretKey),
            payment: {
              reference,
              description: body.descripcion ?? `Cotización ${numero} FERMAVAL`,
              amount: { currency: "CLP", total: monto },
            },
            expiration,
            returnUrl,
            ipAddress,
            userAgent,
          };

          const res = await fetch(GETNET_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = (await res.json()) as {
            status?: { status?: string; message?: string };
            requestId?: number;
            processUrl?: string;
          };

          if (!res.ok || json.status?.status !== "OK" || !json.processUrl || !json.requestId) {
            return new Response(
              JSON.stringify({
                error: json.status?.message ?? "No se pudo iniciar el pago con Getnet.",
              }),
              { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          // Guardar mapping request_id → cotización + monto esperado.
          // Fuente autoritativa para el webhook (no confiar en `reference`).
          await supabaseAdmin
            .from("getnet_sessions" as never)
            .upsert(
              {
                request_id: json.requestId,
                cotizacion_id: cot.id,
                reference,
                monto_esperado: monto,
                status: "PENDING",
              } as never,
              { onConflict: "request_id" } as never,
            );

          return new Response(
            JSON.stringify({
              processUrl: json.processUrl,
              requestId: json.requestId,
              reference,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error inesperado.";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
