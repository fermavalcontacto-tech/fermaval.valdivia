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
import { CheckCircle2, Clock, ArrowLeft, Download, Printer, Share2 } from "lucide-react";
import { downloadCotizacionPDF, printCotizacionPDF, shareCotizacionPDF, cotizacionPdfFilename, type CotizacionPDF } from "@/lib/cotizacion-pdf";
import { normalizePrecioModo, precioModoLabel, precioParaCliente } from "@/lib/domain/quotes.core";


function maskCorreo(c: string | null | undefined): string {
  if (!c) return "—";
  const [u, d] = c.split("@");
  if (!d) return "—";
  const head = u.slice(0, 1);
  const tail = u.length > 2 ? u.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, u.length - (tail ? 2 : 1)))}${tail}@${d}`;
}

const getQuote = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ numero: z.string().max(40), token: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cot, error } = await supabaseAdmin
      .from("cotizaciones")
      .select(
        "id, numero, access_token, created_at, estado, largo_m, ancho_m, cantidad_planchas, metros2, color_nombre, precio_m2, total, pago_recibido, saldo, cliente:clientes(nombre, giro, rut, correo)",
      )
      .eq("numero", data.numero)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const expected = String(cot?.access_token ?? "");
    const provided = String(data.token ?? "");
    let ok = false;
    if (cot && expected && provided.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
      ok = diff === 0;
    }
    let safeCot: unknown = null;
    let items: Array<{ position: number; largo_m: number; ancho_m: number; cantidad_planchas: number; metros2: number; tipo: string | null; espesor_mm: number | null; color_nombre: string | null; precio_m2: number | null }> = [];
    if (cot && ok) {
      const c = cot.cliente as { nombre?: string; giro?: string; rut?: string; correo?: string } | null;
      const firstName = (c?.nombre ?? "").trim().split(/\s+/)[0] ?? "";
      const { id: _id, access_token: _at, ...rest } = cot;
      void _id; void _at;
      safeCot = {
        ...rest,
        cliente: { nombre: firstName, giro: c?.giro ?? "", rut: c?.rut ?? "", correo: maskCorreo(c?.correo) },
      };
      const { data: its } = await supabaseAdmin
        .from("cotizacion_items")
        .select("position, largo_m, ancho_m, cantidad_planchas, metros2, tipo, espesor_mm, color_nombre, precio_m2")
        .eq("cotizacion_id", cot.id)
        .order("position", { ascending: true });
      items = (its ?? []).map((r) => ({
        position: Number(r.position),
        largo_m: Number(r.largo_m),
        ancho_m: Number(r.ancho_m),
        cantidad_planchas: Number(r.cantidad_planchas),
        metros2: Number(r.metros2),
        tipo: (r.tipo as string | null) ?? null,
        espesor_mm: r.espesor_mm == null ? null : Number(r.espesor_mm),
        color_nombre: (r.color_nombre as string | null) ?? null,
        precio_m2: r.precio_m2 == null ? null : Number(r.precio_m2),
      }));
    }
    const { data: cfg } = await supabaseAdmin
      .from("configuracion_web").select("info_comercial, telefono, direccion, instagram, linktree_url, precio_cliente_modo").eq("id", 1).single();
    return { cot: safeCot as typeof cot | null, items, cfg };
  });


export const Route = createFileRoute("/cotizacion/$numero")({
  validateSearch: (s: Record<string, unknown>) => ({
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: ({ params, deps, context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["quote", params.numero, deps.t ?? ""],
        queryFn: () => getQuote({ data: { numero: params.numero, token: deps.t } }),
      }),
    ),
  component: QuotePage,
});

function QuotePage() {
  const { numero } = Route.useParams();
  const { t: token } = Route.useSearch();
  const router = useRouter();
  const { data } = useSuspenseQuery(queryOptions({
    queryKey: ["quote", numero, token ?? ""],
    queryFn: () => getQuote({ data: { numero, token } }),
  }));
  const [showPay, setShowPay] = useState(false);
  const [correo, setCorreo] = useState("");

  const accept = useMutation({
    mutationFn: (porcentaje: 20 | 50) => acceptQuoteAndPay({ data: { numero, porcentaje, correo, token: token ?? "" } }),
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
  const cliente = cot.cliente as { nombre: string; giro?: string; rut?: string; correo: string } | null;
  const aceptada = cot.estado !== "cotizacion_creada" && cot.estado !== "esperando_pago" && cot.estado !== "rechazada";
  const modo = normalizePrecioModo(data.cfg?.precio_cliente_modo);
  const modoLabel = precioModoLabel(modo);
  const showP = (neto: number) => precioParaCliente(neto, modo);


  function buildPdf(): CotizacionPDF {
    const items = (data.items.length ? data.items : [{ position: 0, largo_m: Number(cot.largo_m), ancho_m: 1, cantidad_planchas: cot.cantidad_planchas ?? 1, metros2: Number(cot.metros2), tipo: null, espesor_mm: null, color_nombre: null, precio_m2: null }])
      .map((it) => ({
        largo_m: Number(it.largo_m), ancho_m: 1,
        cantidad_planchas: Number(it.cantidad_planchas), metros2: Number(it.metros2),
        tipo: it.tipo ?? null,
        espesor_mm: it.espesor_mm == null ? null : Number(it.espesor_mm),
        color_nombre: it.color_nombre ?? null,
        precio_m2: it.precio_m2 == null ? null : Number(it.precio_m2),
      }));
    const pdf: CotizacionPDF = {
      numero: cot.numero,
      fecha: cot.created_at,
      cliente: { nombre: cliente?.nombre ?? "—", giro: cliente?.giro ?? "", rut: cliente?.rut ?? "", correo: cliente?.correo ?? "", telefono: "—", direccion: "—" },
      largo_m: Number(cot.largo_m), ancho_m: 1, cantidad_planchas: cot.cantidad_planchas ?? 1, metros2: Number(cot.metros2),
      items,
      color_nombre: cot.color_nombre, precio_m2: Number(cot.precio_m2),
      descuento: 0, total: Number(cot.total), pago_recibido: Number(cot.pago_recibido), saldo: Number(cot.saldo),
      estado: ESTADO_LABEL[cot.estado] ?? cot.estado,
      aprobador_nombre: "", aprobador_email: "", aprobado_at: "",
      origen: "cliente",
      precio_modo: modo,

    };
    return pdf;
  }

  async function handleDownload() {
    const pdf = buildPdf();
    try {
      await downloadCotizacionPDF(pdf);
      toast.success(`Descargando ${cotizacionPdfFilename(pdf)}`);
    } catch {
      toast.error("No se pudo descargar el PDF. Intenta con \"Compartir\".");
    }
  }
  async function handleShare() {
    const pdf = buildPdf();
    const ok = await shareCotizacionPDF(pdf);
    if (!ok) { await handleDownload(); }
  }
  function handlePrint() { printCotizacionPDF(buildPdf()); }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader linktreeUrl={data.cfg?.linktree_url} />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-4 space-y-2">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Volver</Link></Button>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button onClick={() => void handleDownload()} variant="hero" className="w-full sm:w-auto">
              <Download className="mr-1 h-4 w-4" /> Descargar PDF
            </Button>
            <Button onClick={() => void handleShare()} variant="outline" className="w-full sm:w-auto">
              <Share2 className="mr-1 h-4 w-4" /> Compartir
            </Button>
            <Button onClick={handlePrint} variant="outline" className="w-full sm:w-auto">
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>



        <Card className="overflow-hidden border-2 border-border bg-card">
          <div className="brand-gradient p-4 text-primary-foreground sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Cotización</div>
                <div className="font-display text-2xl sm:text-4xl">{cot.numero}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Fecha</div>
                <div className="text-sm">{formatDate(cot.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">Cliente</h3>
              <p className="mt-2 break-words font-medium">{cliente?.nombre ?? "—"}</p>
              <p className="text-sm text-muted-foreground">RUT: {cliente?.rut || "No informado"}</p>
              <p className="text-sm text-muted-foreground">Giro / actividad: {cliente?.giro || "No informado"}</p>
              <p className="break-all text-sm text-muted-foreground">{cliente?.correo ?? "—"}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Datos parciales por seguridad. Los datos completos están en tu confirmación por correo.
              </p>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">Detalle</h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Color</dt><dd className="text-right">{cot.color_nombre ?? "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Precio / m² ({modoLabel})</dt><dd className="text-right">{formatCLP(showP(Number(cot.precio_m2)))} {modoLabel}</dd></div>
                <div className="flex justify-between gap-2 font-semibold"><dt>Total m²</dt><dd>{Number(cot.metros2).toFixed(2)} m²</dd></div>
              </dl>
            </div>
          </div>

          <div className="border-t border-border px-4 pb-6 sm:px-6">
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-accent sm:mt-6">Medidas</h3>
            {(() => {
              const filas = data.items.length
                ? data.items
                : [{ position: 0, largo_m: Number(cot.largo_m), ancho_m: 1, cantidad_planchas: cot.cantidad_planchas ?? 1, metros2: Number(cot.metros2) }];
              return (
                <>
                  {/* Móvil: tarjetas */}
                  <div className="space-y-2 md:hidden">
                    {filas.map((it, i) => (
                      <div key={i} className="rounded-md border border-border p-3 text-sm">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plancha {i + 1}</div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Largo</span><span>{it.largo_m.toFixed(2)} m</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Ancho</span><span>1 m</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Cantidad</span><span>{it.cantidad_planchas}</span></div>
                        <div className="flex justify-between font-semibold"><span>m²</span><span>{it.metros2.toFixed(2)}</span></div>
                      </div>
                    ))}
                    <div className="flex justify-between rounded-md bg-muted/40 p-3 text-sm font-semibold">
                      <span>Total m²</span><span>{Number(cot.metros2).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Escritorio: tabla */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-right">Largo</th>
                          <th className="p-2 text-right">Ancho</th>
                          <th className="p-2 text-right">Cantidad</th>
                          <th className="p-2 text-right">m²</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((it, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2 text-right">{it.largo_m.toFixed(2)} m</td>
                            <td className="p-2 text-right">1 m</td>
                            <td className="p-2 text-right">{it.cantidad_planchas}</td>
                            <td className="p-2 text-right">{it.metros2.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30 font-semibold">
                          <td className="p-2" colSpan={4}>Total m²</td>
                          <td className="p-2 text-right">{Number(cot.metros2).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>



          <div className="grid gap-4 border-t border-border p-6 md:grid-cols-3">
            <div className="rounded-md bg-muted p-4">
              <div className="text-xs uppercase text-muted-foreground">Total ({modoLabel})</div>
              <div className="font-display text-3xl text-primary">{formatCLP(showP(Number(cot.total)))}</div>
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

          <div className="border-t border-border p-6">
            <div className="rounded-md border-2 border-accent/40 bg-accent/5 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent">📌 Validez de la cotización</div>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Esta cotización tiene una validez de <span className="text-accent">7 días corridos</span> desde la fecha de emisión.
              </p>
            </div>
            <div className="mt-4 rounded-md border-y-2 border-primary/60 bg-background px-4 py-5 text-center">
              <p className="text-sm font-semibold text-foreground">¿Tienes dudas o deseas confirmar tu pedido?</p>
              <p className="mt-1 font-display text-xl text-primary">FERMAVAL</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">📞 WhatsApp / Teléfono</p>
              <a href="https://wa.me/56930126744" className="font-mono text-lg font-bold text-primary underline-offset-4 hover:underline">+56 9 3012 6744</a>
              <p className="mt-2"><a href="https://www.fermaval.com" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">www.fermaval.com</a></p>
            </div>
          </div>


          <div className="border-t border-border bg-muted/40 p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-accent" />
              <span>{data.cfg?.info_comercial}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                {ESTADO_LABEL[cot.estado] ?? cot.estado}
              </div>
              {Number(cot.saldo) === 0 && Number(cot.total) > 0 && (
                <div className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  <CheckCircle2 className="h-3 w-3" /> Pagado
                </div>
              )}
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
                  <div>
                    <label className="text-sm font-medium" htmlFor="confirm-correo">
                      Confirma tu correo para aceptar
                    </label>
                    <input
                      id="confirm-correo"
                      type="email"
                      autoComplete="email"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="tu@correo.cl"
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Debe coincidir con el correo registrado en esta cotización.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">Elige el porcentaje a abonar:</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button onClick={() => accept.mutate(20)} disabled={accept.isPending || !correo} variant="outline" size="lg" className="h-auto flex-col py-4">
                      <span className="font-display text-3xl text-primary">20%</span>
                      <span className="text-sm">{formatCLP(Math.round(Number(cot.total) * 0.20))}</span>
                    </Button>
                    <Button onClick={() => accept.mutate(50)} disabled={accept.isPending || !correo} variant="hero" size="lg" className="h-auto flex-col py-4">
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
