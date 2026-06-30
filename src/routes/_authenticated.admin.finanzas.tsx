import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getDashboard,
  listMovimientosHistoricos,
  upsertMovimientoHistorico,
  deleteMovimientoHistorico,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Trash2, Lock } from "lucide-react";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
const qMov = queryOptions({ queryKey: ["movimientos_historicos"], queryFn: () => listMovimientosHistoricos() });

export const Route = createFileRoute("/_authenticated/admin/finanzas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: FinanzasPage,
});

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function FinanzasPage() {
  const { auth } = Route.useRouteContext();
  const { data } = useSuspenseQuery(q);

  // Filtro de mes para el dashboard (selector global)
  const [selectedKey, setSelectedKey] = useState<string>(data.months[data.months.length - 1]?.key ?? "");
  const selectedMonth = useMemo(
    () => data.months.find((m) => m.key === selectedKey) ?? data.months[data.months.length - 1],
    [data.months, selectedKey],
  );

  const ventasSel = selectedMonth?.ventas ?? 0;
  const gastosSel = selectedMonth?.gastos ?? 0;
  const utilidadesSel = ventasSel - gastosSel;
  const ivaSel = Math.round((ventasSel * 0.19) / 1.19);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">FINANZAS</h1>
          <p className="text-sm text-muted-foreground">Mostrando: {selectedMonth?.label}</p>
        </div>
        <div className="w-56">
          <Label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Filtrar mes</Label>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.months.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label} ({m.key})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 border-accent/40 bg-accent/5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ganancias del mes</div>
          <div className="mt-2 font-display text-3xl text-primary">{formatCLP(ventasSel)}</div>
        </Card>
        <Card className={`p-5 border ${utilidadesSel >= 0 ? "border-green-400/40 bg-green-50/40 dark:bg-green-950/20" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance neto</div>
          <div className={`mt-2 font-display text-3xl ${utilidadesSel >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>{formatCLP(utilidadesSel)}</div>
          <div className="text-xs text-muted-foreground">Ventas − Gastos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">IVA (19%)</div>
          <div className="mt-2 font-display text-3xl text-primary">{formatCLP(ivaSel)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Gastos</div>
          <div className="mt-2 font-display text-3xl text-destructive">{formatCLP(gastosSel)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evolución últimos 12 meses (incluye movimientos históricos)</h3>
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
              <Area type="monotone" dataKey="gastos" stroke="var(--destructive)" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {auth.isSuperadmin ? (
        <HistoricosPanel />
      ) : (
        <Card className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          La carga manual de movimientos históricos está restringida al Administrador General.
        </Card>
      )}
    </div>
  );
}

function HistoricosPanel() {
  const qc = useQueryClient();
  const { data: movimientos = [] } = useQuery(qMov);

  const now = new Date();
  const [mes, setMes] = useState<string>(String(now.getMonth() + 1).padStart(2, "0"));
  const [anio, setAnio] = useState<string>(String(now.getFullYear()));
  const [ventas, setVentas] = useState<string>("");
  const [gastos, setGastos] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");

  const upsert = useMutation({
    mutationFn: (v: { periodo: string; ventas: number; gastos: number; descripcion: string }) =>
      upsertMovimientoHistorico({ data: v }),
    onSuccess: () => {
      toast.success("Movimiento histórico guardado");
      setVentas(""); setGastos(""); setDescripcion("");
      qc.invalidateQueries({ queryKey: ["movimientos_historicos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMovimientoHistorico({ data: { id } }),
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["movimientos_historicos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(ventas), g = Number(gastos);
    if (!Number.isFinite(v) || v < 0) return toast.error("Ventas inválidas");
    if (!Number.isFinite(g) || g < 0) return toast.error("Gastos inválidos");
    upsert.mutate({
      periodo: `${anio}-${mes}`,
      ventas: v,
      gastos: g,
      descripcion: descripcion.trim(),
    });
  }

  const anioActual = now.getFullYear();
  const anios = Array.from({ length: 7 }, (_, i) => String(anioActual - 3 + i));

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-accent" />
        <h3 className="font-display text-lg text-primary">Ingreso manual de movimientos históricos</h3>
        <span className="ml-auto rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">Solo Administrador General</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Registra ventas y gastos mensuales retroactivos. Los montos se suman automáticamente al Dashboard y a los gráficos del mes seleccionado.
      </p>

      <form onSubmit={submit} className="grid gap-4 md:grid-cols-5">
        <div>
          <Label className="text-xs">Mes</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((label, i) => {
                const val = String(i + 1).padStart(2, "0");
                return <SelectItem key={val} value={val}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Año</Label>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anios.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ventas totales (IVA incluido)</Label>
          <Input type="number" min="0" step="1" value={ventas} onChange={(e) => setVentas(e.target.value)} placeholder="0" required />
        </div>
        <div>
          <Label className="text-xs">Gastos totales</Label>
          <Input type="number" min="0" step="1" value={gastos} onChange={(e) => setGastos(e.target.value)} placeholder="0" required />
        </div>
        <div className="md:col-span-5">
          <Label className="text-xs">Descripción / nota</Label>
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Carga inicial de movimientos históricos según reportes de Fredy"
            rows={2}
          />
        </div>
        <div className="md:col-span-5">
          <Button type="submit" disabled={upsert.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {upsert.isPending ? "Guardando..." : "Guardar movimiento"}
          </Button>
          <span className="ml-3 text-xs text-muted-foreground">Si ya existe un registro para ese mes, se reemplazará.</span>
        </div>
      </form>

      <div className="mt-6">
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Movimientos registrados</h4>
        {movimientos.length === 0 ? (
          <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">Sin movimientos históricos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Periodo</th>
                  <th className="py-2 pr-3 text-right">Ventas</th>
                  <th className="py-2 pr-3 text-right">Gastos</th>
                  <th className="py-2 pr-3 text-right">Utilidad</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const d = new Date(m.periodo);
                  const label = `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
                  const util = Number(m.ventas) - Number(m.gastos);
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{label}</td>
                      <td className="py-2 pr-3 text-right">{formatCLP(Number(m.ventas))}</td>
                      <td className="py-2 pr-3 text-right text-destructive">{formatCLP(Number(m.gastos))}</td>
                      <td className="py-2 pr-3 text-right">{formatCLP(util)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{m.descripcion ?? "—"}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => {
                            if (confirm("¿Eliminar este movimiento histórico?")) del.mutate(m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
