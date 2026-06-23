import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PublicHeader, PublicFooter } from "@/components/public/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCLP, formatDate, ESTADO_LABEL } from "@/lib/format";
import { acceptQuoteAndPay } from "@/lib/public.functions";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, ArrowLeft } from "lucide-react";

function maskCorreo(c: string | null | undefined): string {
  if (!c) return "—";
  const [u, d] = c.split("@");
  if (!d) return "—";
  const head = u.slice(0, 1);
  const tail = u.length > 2 ? u.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, u.length - (tail ? 2 : 1)))}${tail}@${d}`;
}

const getQuote = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ numero: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cot, error } = await supabaseAdmin
      .from("cotizaciones")
      .select(
        "numero, created_at, estado, largo_m, ancho_m, metros2, color_nombre, precio_m2, total, pago_recibido, saldo, cliente:clientes(nombre, correo)",
      )
      .eq("numero", data.numero)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Strip PII before sending to the browser: only first name + masked email.
    let safeCot: typeof cot = cot;
    if (cot) {
      const c = cot.cliente as { nombre?: string; correo?: string } | null;
      const firstName = (c?.nombre ?? "").trim().split(/\s+/)[0] ?? "";
      safeCot = {
        ...cot,
        cliente: c ? { nombre: firstName, correo: maskCorreo(c.correo) } : null,
      };
    }
    const { data: cfg } = await supabaseAdmin
      .from("configuracion_web").select("info_comercial, telefono, direccion, instagram, linktree_url").eq("id", 1).single();
    return { cot: safeCot, cfg };
  });

export const Route = createFileRoute("/cotizacion/$numero")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({ queryKey: ["quote", params.numero], queryFn: () => getQuote({ data: { numero: params.numero } }) }),
    ),
  component: QuotePage,
});

function QuotePage() {
  const { numero } = Route.useParams();
  const router = useRouter();
  const { data } = useSuspenseQuery(queryOptions({
    queryKey: ["quote", numero],
    queryFn: () => getQuote({ data: { numero } }),
  }));
  const [showPay, setShowPay] = useState(false);

  const accept = useMutation({
    mutationFn: (porcentaje: 20 | 50) => acceptQuoteAndPay({ data: { numero, porcentaje } }),
    onSuccess: (r) => {
      toast.success(`Pago del ${formatCLP(r.monto)} registrado. Saldo: ${formatCLP(r.saldo)}`);
      setShowPay(false);
      router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data.cot) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader linktreeUrl={data.cfg?.linktree_url} />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="font-display text-4xl text-primary">Cotización no encontrada</h1>
          <p className="mt-4 text-muted-foreground">El número {numero} no existe.</p>
          <Button asChild className="mt-6"><Link to="/">Volver al inicio</Link></Button>
        </div>
      </div>
    );
  }

  const cot = data.cot;
  const cliente = cot.cliente as { nombre: string; correo: string; telefono: string; direccion: string };
  const aceptada = cot.estado !== "cotizacion_creada" && cot.estado !== "esperando_pago" && cot.estado !== "rechazada";

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader linktreeUrl={data.cfg?.linktree_url} />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Volver</Link></Button>

        <Card className="overflow-hidden border-2 border-border bg-card">
          <div className="brand-gradient p-6 text-primary-foreground">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Cotización</div>
                <div className="font-display text-4xl">{cot.numero}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Fecha</div>
                <div className="text-sm">{formatDate(cot.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">Cliente</h3>
              <p className="mt-2 font-medium">{cliente?.nombre}</p>
              <p className="text-sm text-muted-foreground">{cliente?.correo}</p>
              <p className="text-sm text-muted-foreground">{cliente?.telefono}</p>
              <p className="text-sm text-muted-foreground">{cliente?.direccion}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">Detalle</h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Largo</dt><dd>{Number(cot.largo_m).toFixed(2)} m</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Ancho</dt><dd>{Number(cot.ancho_m).toFixed(2)} m</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Metros cuadrados</dt><dd>{Number(cot.metros2).toFixed(2)} m²</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Color</dt><dd>{cot.color_nombre ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Precio / m²</dt><dd>{formatCLP(Number(cot.precio_m2))}</dd></div>
              </dl>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border p-6 md:grid-cols-3">
            <div className="rounded-md bg-muted p-4">
              <div className="text-xs uppercase text-muted-foreground">Total</div>
              <div className="font-display text-3xl text-primary">{formatCLP(Number(cot.total))}</div>
            </div>
            <div className="rounded-md bg-muted p-4">
              <div className="text-xs uppercase text-muted-foreground">Pagado</div>
              <div className="font-display text-3xl text-primary">{formatCLP(Number(cot.pago_recibido))}</div>
            </div>
            <div className="rounded-md bg-accent/10 p-4">
              <div className="text-xs uppercase text-muted-foreground">Saldo</div>
              <div className="font-display text-3xl text-accent">{formatCLP(Number(cot.saldo))}</div>
            </div>
          </div>

          <div className="border-t border-border bg-muted/40 p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-accent" />
              <span>{data.cfg?.info_comercial}</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
              {ESTADO_LABEL[cot.estado] ?? cot.estado}
            </div>
          </div>

          {!aceptada && cot.estado !== "rechazada" && (
            <div className="border-t border-border p-6">
              {!showPay ? (
                <Button onClick={() => setShowPay(true)} variant="hero" size="lg" className="w-full">
                  Aceptar cotización y pagar
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Elige el porcentaje a abonar:</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button onClick={() => accept.mutate(20)} disabled={accept.isPending} variant="outline" size="lg" className="h-auto flex-col py-4">
                      <span className="font-display text-3xl text-primary">20%</span>
                      <span className="text-sm">{formatCLP(Math.round(Number(cot.total) * 0.20))}</span>
                    </Button>
                    <Button onClick={() => accept.mutate(50)} disabled={accept.isPending} variant="hero" size="lg" className="h-auto flex-col py-4">
                      <span className="font-display text-3xl">50%</span>
                      <span className="text-sm">{formatCLP(Math.round(Number(cot.total) * 0.50))}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Al aceptar, registramos tu intención de pago. El equipo te contactará para coordinar la transferencia.
                  </p>
                </div>
              )}
            </div>
          )}
          {aceptada && (
            <div className="border-t border-border bg-accent/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
              <p className="mt-2 font-semibold text-primary">¡Cotización aceptada!</p>
              <p className="text-sm text-muted-foreground">Te contactaremos para coordinar la entrega.</p>
            </div>
          )}
        </Card>
      </div>
      <PublicFooter telefono={data.cfg?.telefono} direccion={data.cfg?.direccion} instagram={data.cfg?.instagram} />
    </div>
  );
}
