import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { formatCLP } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/admin/finanzas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: FinanzasPage,
});

function FinanzasPage() {
  const { data } = useSuspenseQuery(q);
  const last = data.months[data.months.length - 1];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">FINANZAS</h1>
        <p className="text-sm text-muted-foreground">Mes actual: {last?.label}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 border-accent/40 bg-accent/5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ganancias totales</div>
          <div className="mt-2 font-display text-3xl text-primary">{formatCLP(data.ventas)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Utilidades</div>
          <div className="mt-2 font-display text-3xl text-primary">{formatCLP(data.utilidades)}</div>
          <div className="text-xs text-muted-foreground">Ganancias − gastos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">IVA (19%)</div>
          <div className="mt-2 font-display text-3xl text-primary">{formatCLP(data.iva)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Gastos</div>
          <div className="mt-2 font-display text-3xl text-destructive">{formatCLP(data.gastos)}</div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evolución últimos 6 meses</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data.months}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCLP(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Area type="monotone" dataKey="ventas" stroke="var(--accent)" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
