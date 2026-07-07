import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PublicHeader, PublicFooter } from "@/components/public/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCLP, formatDate, ESTADO_LABEL } from "@/lib/format";
import { listMyQuotesByEmail, requestQuoteHistoryCode } from "@/lib/public.functions";
import { toast } from "sonner";
import { Search, FileText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/mis-cotizaciones")({
  head: () => ({
    meta: [
      { title: "Mis cotizaciones · FERMAVAL" },
      { name: "description", content: "Consulta el estado y el historial de tus cotizaciones de cubiertas y revestimientos FERMAVAL." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MyQuotesPage,
});

type QuoteRow = Awaited<ReturnType<typeof listMyQuotesByEmail>>[number];

function MyQuotesPage() {
  const [correo, setCorreo] = useState("");
  const [rows, setRows] = useState<QuoteRow[] | null>(null);

  const search = useMutation({
    mutationFn: (c: string) => listMyQuotesByEmail({ data: { correo: c } }),
    onSuccess: (r) => {
      setRows(r);
      if (!r.length) toast.info("No encontramos cotizaciones para ese correo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Volver</Link>
          </Button>
        </div>

        <Card className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div>
            <div>
              <h1 className="font-display text-2xl text-primary">Mis cotizaciones</h1>
              <p className="text-sm text-muted-foreground">
                Ingresa el correo con el que solicitaste tus cotizaciones.
              </p>
            </div>
          </div>

          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!correo.trim()) return;
              search.mutate(correo.trim().toLowerCase());
            }}
          >
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="tu@correo.cl"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" variant="hero" disabled={search.isPending || !correo.trim()}>
              <Search className="mr-1 h-4 w-4" />
              {search.isPending ? "Buscando…" : "Buscar"}
            </Button>
          </form>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Por seguridad, para ver el detalle de una cotización necesitas el enlace personal que te enviamos por correo.
          </p>
        </Card>

        {rows && rows.length > 0 && (
          <Card className="mt-6 overflow-hidden border-2 border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Número</th>
                    <th className="p-3 text-left">Fecha</th>
                    <th className="p-3 text-left">Color</th>
                    <th className="p-3 text-right">m²</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Saldo</th>
                    <th className="p-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.numero} className="border-b last:border-0">
                      <td className="p-3 font-mono">{r.numero}</td>
                      <td className="p-3">{formatDate(r.created_at)}</td>
                      <td className="p-3">{r.color_nombre ?? "—"}</td>
                      <td className="p-3 text-right">{r.metros2.toFixed(2)}</td>
                      <td className="p-3 text-right">{formatCLP(r.total)}</td>
                      <td className="p-3 text-right">{formatCLP(r.saldo)}</td>
                      <td className="p-3">
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {ESTADO_LABEL[r.estado] ?? r.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
