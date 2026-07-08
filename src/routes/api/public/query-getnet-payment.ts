import { createFileRoute } from "@tanstack/react-router";
import {
  fetchGetnetSession,
  mapGetnetStatus,
  totalApproved,
  getnetLog,
} from "@/lib/getnet.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/**
 * Consulta el estado real de una transacción Getnet y actualiza Supabase.
 * Puede llamarse:
 *  - Desde el cliente al volver del checkout (pasa numero + token de cotización).
 *  - Desde el admin (pasa requestId directamente; requiere sesión de staff via
 *    RLS, pero por simplicidad este endpoint es público y trabaja por requestId
 *    autoritativo — solo actualiza estados, no aprueba montos sin verificar).
 */
export const Route = createFileRoute("/api/public/query-getnet-payment")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const login = process.env.GETNET_LOGIN;
          const secretKey = process.env.GETNET_SECRET_KEY;
          if (!login || !secretKey) {
            return new Response(JSON.stringify({ error: "Getnet no configurado." }), {
              status: 500,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const body = (await request.json()) as {
            requestId?: number | string;
            numero?: string;
            token?: string;
          };

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Resolver requestId: por parámetro directo (admin) o por
          // (numero+token) — última sesión de esa cotización (cliente).
          let requestId = body.requestId;
          let cotizacionId: string | null = null;

          if (!requestId && body.numero && body.token) {
            const { data: cot } = await supabaseAdmin
              .from("cotizaciones")
              .select("id, access_token")
              .eq("numero", String(body.numero))
              .maybeSingle();
            if (!cot || String(cot.access_token) !== String(body.token)) {
              return new Response(JSON.stringify({ error: "Cotización no encontrada." }), {
                status: 404,
                headers: { "Content-Type": "application/json", ...CORS },
              });
            }
            cotizacionId = cot.id;
            const { data: last } = await supabaseAdmin
              .from("getnet_sessions" as never)
              .select("request_id")
              .eq("cotizacion_id", cot.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            requestId = (last as unknown as { request_id?: number } | null)?.request_id;
          }

          if (!requestId) {
            return new Response(JSON.stringify({ error: "Sin transacción para consultar." }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          getnetLog("query.request", { requestId });

          const resp = await fetchGetnetSession(requestId, login, secretKey);
          if (!resp) {
            return new Response(JSON.stringify({ error: "Error consultando Getnet." }), {
              status: 502,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // Cargar sesión local (autoritativa para monto esperado / cotización).
          const { data: sessionRow } = await supabaseAdmin
            .from("getnet_sessions" as never)
            .select("request_id, cotizacion_id, monto_esperado, status")
            .eq("request_id", requestId)
            .maybeSingle();

          if (!sessionRow) {
            return new Response(JSON.stringify({ error: "Sesión desconocida." }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          const s = sessionRow as unknown as {
            request_id: number;
            cotizacion_id: string;
            monto_esperado: number;
            status: string | null;
          };
          if (!cotizacionId) cotizacionId = s.cotizacion_id;

          const rawStatus = resp.status?.status ?? "";
          const mapped = mapGetnetStatus(rawStatus);
          const approvedTotal = totalApproved(resp);
          const approvedPayment = (resp.payment ?? []).find(
            (p) => p.status?.status === "APPROVED",
          );
          const paymentDate =
            approvedPayment?.status?.date ?? approvedPayment?.processingDate ?? null;

          await supabaseAdmin
            .from("getnet_sessions" as never)
            .update({
              status: mapped,
              monto_aprobado: approvedTotal || null,
              payment_date: paymentDate,
              raw_response: resp as unknown as object,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("request_id", requestId);

          getnetLog("query.result", { requestId, status: mapped, approved: approvedTotal });

          // Si fue aprobado y aún no está registrado el pago, registrarlo.
          if (rawStatus === "APPROVED" && approvedTotal > 0) {
            const { data: prev } = await supabaseAdmin
              .from("pagos")
              .select("id")
              .eq("cotizacion_id", s.cotizacion_id)
              .eq("metodo", `getnet:${requestId}`)
              .maybeSingle();

            if (!prev) {
              const { data: cot } = await supabaseAdmin
                .from("cotizaciones")
                .select("id, total, pago_recibido")
                .eq("id", s.cotizacion_id)
                .maybeSingle();
              if (cot) {
                const credit = Math.min(approvedTotal, s.monto_esperado);
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
                getnetLog("query.paid", { requestId, credit, saldo });
              }
            }
          }

          return new Response(
            JSON.stringify({
              status: mapped,
              rawStatus,
              approvedTotal,
              paymentDate,
              requestId,
              cotizacionId,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error";
          getnetLog("query.exception", { msg });
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
