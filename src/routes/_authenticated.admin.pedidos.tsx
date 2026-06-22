import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCotizaciones } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { formatCLP, formatDate, ESTADO_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: PedidosPage,
});

const grupos = [
  { key: "cotizacion_creada", title: "Cotización creada" },
  { key: "esperando_pago", title: "Esperando pago" },
  { key: "pago_parcial", title: "Pago parcial" },
  { key: "pedido_confirmado", title: "Pedido confirmado" },
  { key: "pedido_terminado", title: "Pedido terminado" },
];

function PedidosPage() {
  const { data } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => listCotizaciones() });
  const all = data ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">PEDIDOS</h1>
        <p className="text-sm text-muted-foreground">Seguimiento por estado</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {grupos.map((g) => {
          const items = all.filter((c) => c.estado === g.key);
          return (
            <Card key={g.key} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">{g.title}</h3>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">Sin pedidos</p>}
                {items.map((c) => {
                  const cli = c.cliente as { nombre?: string } | null;
                  return (
                  <div key={c.id} className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="font-mono text-xs text-muted-foreground">{c.numero}</div>
                    <div className="font-medium">{cli?.nombre ?? "—"}</div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span>{formatDate(c.created_at)}</span>
                      <span className="font-semibold">{formatCLP(c.total)}</span>
                    </div>
                  </div>
                )})}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
