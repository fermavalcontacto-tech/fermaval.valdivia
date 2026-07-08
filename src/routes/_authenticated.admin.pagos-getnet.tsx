import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCLP, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { CreditCard, RefreshCw, ExternalLink, Send, Copy } from "lucide-react";

type Row = {
  request_id: number;
  cotizacion_id: string;
  reference: string;
  checkout_url: string | null;
  status: string | null;
  monto_esperado: number;
  monto_aprobado: number | null;
  payment_date: string | null;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
  cotizaciones: {
    numero: string;
    total: number;
    saldo: number;
    cliente: { nombre: string; correo: string | null } | null;
  } | null;
};

const listGetnetSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("getnet_sessions" as never)
      .select(
        "request_id, cotizacion_id, reference, checkout_url, status, monto_esperado, monto_aprobado, payment_date, expiration_date, created_at, updated_at, cotizaciones(numero, total, saldo, cliente:clientes(nombre, correo))",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Row[];
  });

const q = queryOptions({ queryKey: ["admin", "pagos-getnet"], queryFn: () => listGetnetSessions() });

export const Route = createFileRoute("/_authenticated/admin/pagos-getnet")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: PagosGetnetPage,
});

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "Pendiente").toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (s.includes("pagado") || s === "approved") cls = "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  else if (s.includes("parcial")) cls = "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  else if (s.includes("rechaz") || s === "rejected" || s === "failed") cls = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  else if (s.includes("expir")) cls = "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200";
  else if (s.includes("anul")) cls = "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status ?? "Pendiente"}
    </span>
  );
}

function PagosGetnetPage() {
  const { data, refetch } = useSuspenseQuery(q);

  const query = useMutation({
    mutationFn: (requestId: number) =>
      fetch("/api/public/query-getnet-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Error consultando");
        return j as { status: string; approvedTotal: number };
      }),
    onSuccess: (r) => {
      toast.success(`Estado actualizado: ${r.status}`);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-4xl text-primary">
            <CreditCard className="h-8 w-8" /> PAGOS GETNET
          </h1>
          <p className="text-sm text-muted-foreground">
            Transacciones generadas mediante Web Checkout de Getnet Chile.
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-1 h-4 w-4" /> Refrescar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Cotización</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-left">Fecha</th>
                <th className="p-3 text-left">Request ID</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Aún no hay transacciones registradas.
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.request_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-semibold">
                      <Link
                        to="/cotizacion/$numero"
                        params={{ numero: r.cotizaciones?.numero ?? "" }}
                        className="text-primary hover:underline"
                      >
                        {r.cotizaciones?.numero ?? "—"}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div>{r.cotizaciones?.cliente?.nombre ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.cotizaciones?.cliente?.correo ?? ""}</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-medium">{formatCLP(r.monto_esperado)}</div>
                      {r.monto_aprobado ? (
                        <div className="text-xs text-green-700 dark:text-green-400">
                          Aprobado: {formatCLP(r.monto_aprobado)}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                    <td className="p-3 text-xs">
                      <div>Creado: {formatDateTime(r.created_at)}</div>
                      {r.payment_date ? (
                        <div className="text-green-700 dark:text-green-400">Pago: {formatDateTime(r.payment_date)}</div>
                      ) : null}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.request_id}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {r.checkout_url && (
                          <Button asChild variant="outline" size="sm" title="Ver checkout">
                            <a href={r.checkout_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          onClick={() => query.mutate(r.request_id)}
                          disabled={query.isPending}
                          variant="outline"
                          size="sm"
                          title="Consultar estado"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${query.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        {r.checkout_url && (
                          <>
                            <Button
                              onClick={() => {
                                navigator.clipboard.writeText(r.checkout_url!);
                                toast.success("Link copiado");
                              }}
                              variant="outline"
                              size="sm"
                              title="Copiar link"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              onClick={() => {
                                const correo = r.cotizaciones?.cliente?.correo;
                                const subject = encodeURIComponent(
                                  `Link de pago Cotización ${r.cotizaciones?.numero ?? ""}`,
                                );
                                const bodyMail = encodeURIComponent(
                                  `Hola,\n\nAquí está el link para pagar la cotización ${r.cotizaciones?.numero ?? ""}:\n${r.checkout_url}\n\nSaludos,\nFERMAVAL`,
                                );
                                window.location.href = `mailto:${correo ?? ""}?subject=${subject}&body=${bodyMail}`;
                              }}
                              variant="outline"
                              size="sm"
                              title="Reenviar link por correo"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
