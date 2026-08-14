import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQuery } from "@tanstack/react-query";
import { getDashboard, getAnalytics, listAlertas } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCLP } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { TrendingUp, FileText, PackageCheck, Wallet, Receipt, AlertTriangle, CheckCircle2, Calculator, CalendarRange } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, accent, tone }: { icon: typeof TrendingUp; label: string; value: string; accent?: boolean; tone?: "pos" | "neg" }) {
  const valueColor =
    tone === "pos" ? "text-green-600 dark:text-green-400"
    : tone === "neg" ? "text-destructive"
    : "text-primary";
  return (
    <Card className={`p-5 ${accent ? "border-accent/40 bg-accent/5" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 font-display text-3xl ${valueColor}`}>{value}</div>
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

      {data.egresosPendientes > 0 ? (
        <Card className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-200/70 dark:bg-amber-900/50 p-2">
              <AlertTriangle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-xl text-amber-900 dark:text-amber-100">
                Hay solicitudes de dinero pendientes
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                Tienes <strong className="font-bold">{data.egresosPendientes}</strong>{" "}
                {data.egresosPendientes === 1 ? "solicitud pendiente" : "solicitudes pendientes"} de revisión.
              </p>
            </div>
            <Link
              to="/admin/egresos"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Revisar
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="border-green-400/50 bg-green-50 dark:bg-green-950/30 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-300" />
            <p className="text-sm text-green-900 dark:text-green-100">
              Todo al día — no hay solicitudes de dinero pendientes.
            </p>
          </div>
        </Card>
      )}

      <AlertsCard />


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat icon={TrendingUp} label="Ventas del mes" value={formatCLP(data.ventas)} accent />
        <Stat icon={FileText} label="Cotizaciones pendientes" value={String(data.cotPendientes)} />
        <Stat icon={PackageCheck} label="Pedidos confirmados" value={String(data.pedidosConfirmados)} />
        <Stat icon={Wallet} label="Utilidades (Ventas − Gastos)" value={formatCLP(data.utilidades)} tone={data.utilidades >= 0 ? "pos" : "neg"} />
        <Stat icon={Receipt} label="Gastos del mes" value={formatCLP(data.gastos)} tone="neg" />
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

      <UtilidadM2Section />

      <AnalyticsSection />

    </div>
  );
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function AnalyticsSection() {
  const today = new Date();
  const [mode, setMode] = useState<"mensual" | "anual">("mensual");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const years = useMemo(() => {
    const y = today.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [today]);

  const { data, isFetching } = useQuery({
    queryKey: ["analytics", mode, year, month],
    queryFn: () => getAnalytics({ data: { mode, year, month } }),
  });

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-primary flex items-center gap-2">
            <CalendarRange className="h-6 w-6" /> Analítica avanzada
          </h2>
          <p className="text-sm text-muted-foreground">Ventas, gastos e IVA por periodo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-card p-1">
            <Button size="sm" variant={mode === "mensual" ? "default" : "ghost"} onClick={() => setMode("mensual")}>Mensual</Button>
            <Button size="sm" variant={mode === "anual" ? "default" : "ghost"} onClick={() => setMode("anual")}>Anual</Button>
          </div>
          {mode === "mensual" && (
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="Ventas totales" value={formatCLP(data?.ventas ?? 0)} accent />
        <Stat icon={Receipt} label="Gastos totales" value={formatCLP(data?.gastos ?? 0)} tone="neg" />
        <Stat icon={Calculator} label="IVA estimado (19%)" value={formatCLP(data?.iva ?? 0)} />
        <Stat icon={Wallet} label="Utilidades del periodo" value={formatCLP(data?.balance ?? 0)} tone={(data?.balance ?? 0) >= 0 ? "pos" : "neg"} />
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {mode === "mensual" ? `Ventas vs Gastos · ${MESES[month - 1]} ${year}` : `Ventas, Gastos e IVA · ${year}`}
        </h3>
        <div className="h-72">
          <ResponsiveContainer>
            {mode === "mensual" ? (
              <LineChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCLP(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Line type="monotone" dataKey="ventas" name="Ventas" stroke="var(--accent)" strokeWidth={2} />
                <Line type="monotone" dataKey="gastos" name="Gastos" stroke="var(--destructive)" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCLP(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="var(--accent)" />
                <Bar dataKey="gastos" name="Gastos" fill="var(--destructive)" />
                <Bar dataKey="iva" name="IVA" fill="var(--primary)" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {isFetching && <p className="mt-2 text-xs text-muted-foreground">Actualizando…</p>}
      </Card>
    </div>
  );
}

type Alerta = { tipo: string; severidad: string; registro_id: string; mensaje: string; ocurrido_at: string; meta: Record<string, string | number | boolean | null> };

function AlertsCard() {
  const { data, isLoading } = useQuery<Alerta[]>({
    queryKey: ["alertas"],
    queryFn: () => listAlertas() as unknown as Promise<Alerta[]>,
    refetchInterval: 60_000,
  });
  if (isLoading) return null;
  const alertas = data ?? [];
  if (alertas.length === 0) return null;
  const color = (s: string) =>
    s === "alta" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : s === "media" ? "border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
    : "border-border bg-muted/30 text-muted-foreground";
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas del sistema ({alertas.length})
        </h3>
      </div>
      <ul className="space-y-2 max-h-72 overflow-auto">
        {alertas.map((a, i) => (
          <li key={`${a.tipo}-${a.registro_id}-${i}`} className={`rounded-md border px-3 py-2 text-sm ${color(a.severidad)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.mensaje}</span>
              <span className="text-[10px] uppercase tracking-wider">{a.tipo.replace(/_/g, " ")}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type UtilidadRow = { id: string; periodo: string; utilidad_m2: number; nota: string | null };

function UtilidadM2Section() {
  const qc = useQueryClient();
  const now = new Date();
  const [periodo, setPeriodo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");

  const { data = [] } = useQuery<UtilidadRow[]>({
    queryKey: ["utilidad-m2"],
    queryFn: () => listUtilidadM2() as unknown as Promise<UtilidadRow[]>,
  });

  useEffect(() => {
    const row = data.find((r) => r.periodo.slice(0, 7) === periodo);
    setValor(row ? String(Number(row.utilidad_m2)) : "");
    setNota(row?.nota ?? "");
  }, [periodo, data]);

  const mut = useMutation({
    mutationFn: () => upsertUtilidadM2({ data: { periodo, utilidad_m2: parseDecimal(valor), nota: nota || null } }),
    onSuccess: () => { toast.success("Utilidad por m² guardada"); qc.invalidateQueries({ queryKey: ["utilidad-m2"] }); },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar"),
  });

  const actual = data.find((r) => r.periodo.slice(0, 7) === periodo);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Coins className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Utilidad por m² de plancha (mensual)</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Mes</Label>
          <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Utilidad / m² (neto)</Label>
          <Input {...DECIMAL_INPUT_PROPS} value={valor} onChange={(e) => setValor(sanitizeDecimalInput(e.target.value))} placeholder="Ej: 1200" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Nota (opcional)</Label>
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: alza de bobinas" />
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">
          {mut.isPending ? "Guardando…" : actual ? "Actualizar" : "Guardar"}
        </Button>
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historial</div>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay utilidades registradas.</p>
        ) : (
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-medium">{MESES[Number(r.periodo.slice(5, 7)) - 1]} {r.periodo.slice(0, 4)}</span>
                <span className="flex items-center gap-2">
                  {r.nota && <span className="text-xs text-muted-foreground">{r.nota}</span>}
                  <span className="font-mono font-semibold">{formatCLP(r.utilidad_m2)} / m²</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
