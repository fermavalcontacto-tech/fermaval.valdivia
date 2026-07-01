import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes } from "crypto";

// Getnet Chile Web Checkout (motor PlacetoPay).
// Endpoint sandbox de integración. Cambiar a producción cuando se certifiquen las 4 compras de prueba.
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
  // tranKey = base64( sha256( nonce_raw + seed + secretKey ) )
  const hash = createHash("sha256")
    .update(Buffer.concat([nonceBytes, Buffer.from(seed + secretKey, "utf8")]))
    .digest();
  return {
    login,
    tranKey: hash.toString("base64"),
    nonce: nonceB64,
    seed,
  };
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
            monto?: number;
            descripcion?: string;
            returnUrl?: string;
          };

          const numero = String(body.numero ?? "").trim();
          const token = String(body.token ?? "").trim();
          const monto = Math.round(Number(body.monto ?? 0));
          if (!numero || !token || monto <= 0) {
            return new Response(JSON.stringify({ error: "Datos inválidos." }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // Verificar que la cotización existe y el token es válido antes de crear la sesión.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: cot } = await supabaseAdmin
            .from("cotizaciones")
            .select("id, numero, access_token, saldo, total")
            .eq("numero", numero)
            .maybeSingle();
          if (!cot || String(cot.access_token) !== token) {
            return new Response(JSON.stringify({ error: "Cotización no encontrada." }), {
              status: 404,
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

          const payload = {
            auth: buildAuth(login, secretKey),
            payment: {
              reference: `${numero}-${Date.now()}`,
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

          if (!res.ok || json.status?.status !== "OK" || !json.processUrl) {
            return new Response(
              JSON.stringify({
                error: json.status?.message ?? "No se pudo iniciar el pago con Getnet.",
              }),
              { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          return new Response(
            JSON.stringify({
              processUrl: json.processUrl,
              requestId: json.requestId,
              reference: payload.payment.reference,
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
