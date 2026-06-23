import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { formatCLP } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { TrendingUp, FileText, PackageCheck, Wallet, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, accent }: { icon: typeof TrendingUp; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={`p-5 ${accent ? "border-accent/40 bg-accent/5" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 font-display text-3xl text-primary">{value}</div>
    </Card>
  );
}

function Dashboard() {
  const { data } = useSuspenseQuery(q);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">DASHBOARD</h1>
        <p className="text-sm text-muted-foreground">Resumen del mes actual</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={TrendingUp} label="Ventas del mes" value={formatCLP(data.ventas)} accent />
        <Stat icon={FileText} label="Cotizaciones pendientes" value={String(data.cotPendientes)} />
        <Stat icon={PackageCheck} label="Pedidos confirmados" value={String(data.pedidosConfirmados)} />
        <Stat icon={Wallet} label="Ganancias / Utilidades" value={formatCLP(data.utilidades)} />
        <Stat icon={Receipt} label="Gastos del mes" value={formatCLP(data.gastos)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ganancias por mes</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCLP(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="ventas" stroke="var(--accent)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Comparación mensual</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCLP(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="var(--accent)" />
                <Bar dataKey="gastos" name="Gastos" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cotizaciones aceptadas vs rechazadas</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Legend />
              <Bar dataKey="aceptadas" name="Aceptadas" fill="var(--accent)" />
              <Bar dataKey="rechazadas" name="Rechazadas" fill="var(--destructive)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
