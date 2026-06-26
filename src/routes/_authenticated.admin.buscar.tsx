import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  searchCotizaciones,
  setPagoCotizacion,
  setEstadoPedido,
  getResumenSeguimiento,
  getCotizacionAudit,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCLP, formatDate, formatDateTime, ESTADO_LABEL } from "@/lib/format";
import { Search, CircleDollarSign, PackageCheck, Truck, ClipboardList, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/buscar")({
  component: BuscarPage,
});

const PAGO_LABEL: Record<string, string> = {
  sin_pago: "Sin pago",
  pago_20: "Anticipo 20%",
  pago_50: "Anticipo 50%",
  pago_total: "Pago total",
};
const PEDIDO_LABEL: Record<string, string> = {
  en_preparacion: "En preparación",
  en_produccion: "En producción",
  pedido_entregado: "Pedido entregado",
  finalizado: "Finalizado",
};
const PEDIDO_COLOR: Record<string, string> = {
  en_preparacion: "bg-yellow-500/20 text-yellow-700 border-yellow-500/40",
  en_produccion: "bg-blue-500/20 text-blue-700 border-blue-500/40",
  pedido_entregado: "bg-green-500/20 text-green-700 border-green-500/40",
  finalizado: "bg-emerald-600/20 text-emerald-800 border-emerald-600/40",
};

type Cot = Awaited<ReturnType<typeof searchCotizaciones>>[number];

function pagoTier(total: number, pago: number): "sin_pago"|"pago_20"|"pago_50"|"pago_total" {
  if (pago === 0) return "sin_pago";
  const pct = total > 0 ? pago / total : 0;
  if (pct >= 0.95) return "pago_total";
  if (pct >= 0.40) return "pago_50";
  return "pago_20";
}

function BuscarPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const isSuperadmin = auth.isSuperadmin;

  const [q, setQ] = useState("");
  const [pago, setPago] = useState<"all"|"sin_pago"|"pago_20"|"pago_50"|"pago_total">("all");
  const [pedido, setPedido] = useState<"all"|"en_preparacion"|"en_produccion"|"pedido_entregado"|"finalizado">("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [selected, setSelected] = useState<Cot | null>(null);

  const searchFn = useServerFn(searchCotizaciones);
  const resumenFn = useServerFn(getResumenSeguimiento);
  const auditFn = useServerFn(getCotizacionAudit);
  const pagoFn = useServerFn(setPagoCotizacion);
  const estadoFn = useServerFn(setEstadoPedido);

  const resumen = useQuery({ queryKey: ["resumen-seguimiento"], queryFn: () => resumenFn() });

  const results = useQuery({
    queryKey: ["buscar-cot", q, pago, pedido, desde, hasta],
    queryFn: () => searchFn({ data: {
      q, pago, pedido,
      desde: desde || null,
      hasta: hasta || null,
    } }),
  });

  const audit = useQuery({
    queryKey: ["audit-cot", selected?.numero],
    queryFn: () => auditFn({ data: { numero: selected!.numero } }),
    enabled: !!selected,
  });

  const mutPago = useMutation({
    mutationFn: (vars: { id: string; tier: "sin_pago"|"pago_20"|"pago_50"|"pago_total" }) =>
      pagoFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success("Pago actualizado");
      qc.invalidateQueries({ queryKey: ["buscar-cot"] });
      qc.invalidateQueries({ queryKey: ["resumen-seguimiento"] });
      qc.invalidateQueries({ queryKey: ["audit-cot"] });
      if (selected) {
        // refresh selected from latest results below
        setSelected((s) => s && s.id === vars.id ? { ...s } : s);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutEstado = useMutation({
    mutationFn: (vars: { id: string; estado_pedido: "en_preparacion"|"en_produccion"|"pedido_entregado"|"finalizado" }) =>
      estadoFn({ data: vars }),
    onSuccess: () => {
      toast.success("Estado del pedido actualizado");
      qc.invalidateQueries({ queryKey: ["buscar-cot"] });
      qc.invalidateQueries({ queryKey: ["resumen-seguimiento"] });
      qc.invalidateQueries({ queryKey: ["audit-cot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mantener selected sincronizado con results
  const selectedLive = useMemo(() => {
    if (!selected) return null;
    return results.data?.find((r) => r.id === selected.id) ?? selected;
  }, [results.data, selected]);

  const r = resumen.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buscar Cotizaciones</h1>
        <p className="text-muted-foreground">Seguimiento de pagos y estado de pedidos</p>
      </div>

      {/* Dashboard resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard icon={<ClipboardList className="h-4 w-4" />} label="Sin pago" value={r?.sin_pago ?? 0} tone="bg-yellow-500/10 text-yellow-700" />
        <SummaryCard icon={<CircleDollarSign className="h-4 w-4" />} label="Anticipo 20%" value={r?.p20 ?? 0} tone="bg-orange-500/10 text-orange-700" />
        <SummaryCard icon={<CircleDollarSign className="h-4 w-4" />} label="Anticipo 50%" value={r?.p50 ?? 0} tone="bg-blue-500/10 text-blue-700" />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Pago total" value={r?.total_pagos ?? 0} tone="bg-emerald-500/10 text-emerald-700" />
        <SummaryCard icon={<Truck className="h-4 w-4" />} label="Entregados" value={r?.entregados ?? 0} tone="bg-green-500/10 text-green-700" />
      </div>

      {/* Search + filtros */}
      <Card>
        <CardHeader><CardTitle>Búsqueda y filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por N° (FV-0001…), nombre, correo o teléfono"
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>Estado de pago</Label>
              <Select value={pago} onValueChange={(v) => setPago(v as typeof pago)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sin_pago">Sin pago</SelectItem>
                  <SelectItem value="pago_20">Anticipo 20%</SelectItem>
                  <SelectItem value="pago_50">Anticipo 50%</SelectItem>
                  <SelectItem value="pago_total">Pagado completamente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado del pedido</Label>
              <Select value={pedido} onValueChange={(v) => setPedido(v as typeof pedido)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="en_preparacion">En preparación</SelectItem>
                  <SelectItem value="en_produccion">En producción</SelectItem>
                  <SelectItem value="pedido_entregado">Pedido entregado</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { setQ(""); setPago("all"); setPedido("all"); setDesde(""); setHasta(""); }}>Limpiar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Resultados ({results.data?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {results.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados.</p>}
            {(results.data ?? []).map((c) => {
              const total = Number(c.total) || 0;
              const pagado = Number(c.pago_recibido) || 0;
              const cliente = c.cliente as { nombre?: string } | null;
              const tier = pagoTier(total, pagado);
              const active = selectedLive?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full rounded-md border p-3 text-left transition hover:bg-muted/50 ${active ? "border-primary bg-muted/40" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-sm font-semibold">{c.numero}</div>
                    <Badge variant="outline" className={PEDIDO_COLOR[c.estado_pedido] ?? ""}>
                      {PEDIDO_LABEL[c.estado_pedido]}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm">{cliente?.nombre ?? "—"}</div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(c.created_at)}</span>
                    <span>{formatCLP(total)} · {PAGO_LABEL[tier]}</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Detalle */}
        <div className="space-y-4">
          {!selectedLive && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Selecciona una cotización para ver el detalle.</CardContent></Card>
          )}
          {selectedLive && (
            <DetailPanel
              c={selectedLive}
              isSuperadmin={isSuperadmin}
              onPago={(tier) => mutPago.mutate({ id: selectedLive.id, tier })}
              onEstado={(estado_pedido) => mutEstado.mutate({ id: selectedLive.id, estado_pedido })}
              pagoLoading={mutPago.isPending}
              estadoLoading={mutEstado.isPending}
              audit={audit.data ?? []}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${tone}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailPanel({
  c, isSuperadmin, onPago, onEstado, pagoLoading, estadoLoading, audit,
}: {
  c: Cot;
  isSuperadmin: boolean;
  onPago: (t: "sin_pago"|"pago_20"|"pago_50"|"pago_total") => void;
  onEstado: (e: "en_preparacion"|"en_produccion"|"pedido_entregado"|"finalizado") => void;
  pagoLoading: boolean;
  estadoLoading: boolean;
  audit: Array<{ id: string; user_email: string; cambio: string; created_at: string }>;
}) {
  const total = Number(c.total) || 0;
  const pagado = Number(c.pago_recibido) || 0;
  const saldo = Math.max(0, total - pagado);
  const tier = pagoTier(total, pagado);
  const cliente = c.cliente as { nombre?: string; correo?: string; telefono?: string; direccion?: string } | null;

  const timeline = [
    { label: "Cotización creada", done: true },
    { label: "Esperando pago", done: c.estado !== "cotizacion_creada" },
    { label: "Pago recibido", done: pagado > 0 },
    { label: "En producción", done: c.estado_pedido === "en_produccion" || c.estado_pedido === "pedido_entregado" || c.estado_pedido === "finalizado" },
    { label: "Pedido entregado", done: c.estado_pedido === "pedido_entregado" || c.estado_pedido === "finalizado" },
    { label: "Pagado completamente", done: pagado >= total && total > 0 },
  ];

  const puedeFinalizar = c.estado_pedido === "pedido_entregado" && pagado >= total && total > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-mono">{c.numero}</CardTitle>
              <p className="text-sm text-muted-foreground">{formatDate(c.created_at)}</p>
            </div>
            <Badge variant="outline" className={PEDIDO_COLOR[c.estado_pedido] ?? ""}>
              {PEDIDO_LABEL[c.estado_pedido]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-1">
            <div><span className="text-muted-foreground">Cliente: </span>{cliente?.nombre ?? "—"}</div>
            <div><span className="text-muted-foreground">Correo: </span>{cliente?.correo ?? "—"}</div>
            <div><span className="text-muted-foreground">Teléfono: </span>{cliente?.telefono ?? "—"}</div>
            <div><span className="text-muted-foreground">Dirección: </span>{cliente?.direccion ?? "—"}</div>
          </div>
          <div className="grid gap-1 border-t pt-3">
            {(() => {
              const its = ((c as unknown as { items?: Array<{ position: number; largo_m: number; cantidad_planchas: number; metros2: number }> }).items ?? [])
                .slice().sort((a, b) => a.position - b.position);
              const list = its.length ? its : [{ position: 0, largo_m: Number(c.largo_m), cantidad_planchas: c.cantidad_planchas ?? 1, metros2: Number(c.metros2) }];
              return (
                <div>
                  <div className="text-muted-foreground text-xs uppercase">Medidas ({list.length})</div>
                  <ul className="mt-1 space-y-0.5">
                    {list.map((it, i) => (
                      <li key={i} className="font-mono text-xs">{i + 1}. {Number(it.largo_m).toFixed(2)} m × 1 m × {it.cantidad_planchas} = {Number(it.metros2).toFixed(2)} m²</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <div><span className="text-muted-foreground">Total m²: </span>{Number(c.metros2)} m²</div>
            <div><span className="text-muted-foreground">Color: </span>{c.color_nombre ?? "—"}</div>
            <div><span className="text-muted-foreground">Precio m²: </span>{formatCLP(Number(c.precio_m2))}</div>
            <div><span className="text-muted-foreground">Origen: </span>{(c as unknown as { origen?: string }).origen ?? "cliente"}</div>
            <div><span className="text-muted-foreground">Estado comercial: </span>{ESTADO_LABEL[c.estado] ?? c.estado}</div>
          </div>

        </CardContent>
      </Card>

      {/* Estado de pago */}
      <Card>
        <CardHeader><CardTitle className="text-base">Estado de Pago</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Total" value={formatCLP(total)} />
            <Stat label="Pagado" value={formatCLP(pagado)} />
            <Stat label="Pendiente" value={formatCLP(saldo)} tone={saldo > 0 ? "text-orange-600" : "text-emerald-600"} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(["sin_pago","pago_20","pago_50","pago_total"] as const).map((t) => (
              <Button
                key={t}
                variant={tier === t ? "default" : "outline"}
                disabled={!isSuperadmin || pagoLoading}
                onClick={() => onPago(t)}
                size="sm"
              >
                {PAGO_LABEL[t]}
              </Button>
            ))}
          </div>
          {!isSuperadmin && <p className="text-xs text-muted-foreground">Solo el Administrador General puede editar pagos.</p>}
        </CardContent>
      </Card>

      {/* Estado del pedido */}
      <Card>
        <CardHeader><CardTitle className="text-base">Estado del Pedido</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(["en_preparacion","en_produccion","pedido_entregado"] as const).map((e) => (
              <Button
                key={e}
                variant={c.estado_pedido === e ? "default" : "outline"}
                disabled={!isSuperadmin || estadoLoading}
                onClick={() => onEstado(e)}
                size="sm"
              >
                {PEDIDO_LABEL[e]}
              </Button>
            ))}
            <Button
              variant={c.estado_pedido === "finalizado" ? "default" : "outline"}
              disabled={!isSuperadmin || estadoLoading || !puedeFinalizar}
              onClick={() => onEstado("finalizado")}
              size="sm"
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white"
              title={!puedeFinalizar ? "Requiere pedido entregado y pago total" : "Marcar como entregado y pagado"}
            >
              <PackageCheck className="mr-1 h-4 w-4" />
              Entregado y pagado
            </Button>
          </div>
          {!puedeFinalizar && c.estado_pedido !== "finalizado" && (
            <p className="text-xs text-muted-foreground">
              Para finalizar requiere: pedido entregado + pago total recibido.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Línea de tiempo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Línea de tiempo</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {timeline.map((step, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {step.done ? "✓" : i + 1}
                </span>
                <span className={step.done ? "" : "text-muted-foreground"}>{step.label}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Auditoría */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historial de cambios</CardTitle></CardHeader>
        <CardContent>
          {audit.length === 0 && <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>}
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="rounded border border-border p-2">
                <div className="text-xs text-muted-foreground">{formatDateTime(a.created_at)} · {a.user_email}</div>
                <div>{a.cambio}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
