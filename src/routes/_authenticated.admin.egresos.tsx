import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listEgresos, createEgreso, decideEgreso, deleteEgreso, updateEgresoLatas, COLORES_LATA, PERSONAS_INTERNAS } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP, formatDate, TIPO_GASTO_LABEL } from "@/lib/format";
import { exportRowsToExcel } from "@/lib/export-excel";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Check, X, Trash2, Download, Palette, FileSpreadsheet } from "lucide-react";
import { downloadComprobantePDF, type LataItem } from "@/lib/comprobante-pdf";

const COLOR_SWATCH: Record<string, string> = {
  Rojo: "#dc2626", Azul: "#2563eb", Verde: "#16a34a", Amarillo: "#eab308",
  Blanco: "#f8fafc", Negro: "#111827", Gris: "#6b7280", Naranja: "#ea580c",
  Café: "#78350f", Celeste: "#38bdf8",
};

export const Route = createFileRoute("/_authenticated/admin/egresos")({
  component: EgresosPage,
});

type Persona = typeof PERSONAS_INTERNAS[number];

function EgresosPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["egresos"], queryFn: () => listEgresos() });

  const decide = useMutation({
    mutationFn: (v: { id: string; estado: "aprobado" | "rechazado" }) => decideEgreso({ data: v }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["egresos"] });
      toast.success("Actualizado");
      if (vars.estado === "aprobado") {
        const s = (data ?? []).find((x) => x.id === vars.id);
        if (s) {
          downloadComprobantePDF({
            id: s.id, tipo: s.tipo, descripcion: s.descripcion, monto: Number(s.monto),
            fecha: s.fecha, solicitado_por: s.solicitado_por, boleta_subida_por: s.boleta_subida_por,
            estado: "aprobado",
            decidido_at: new Date().toISOString(),
            aprobador_nombre: "Administrador General",
            aprobador_email: auth.email,
            latas: (s.latas as LataItem[] | null) ?? [],
          });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteEgreso({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["egresos"] }); toast.success("Solicitud eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isSuper = auth.email.toLowerCase() === "fermaval.contacto@gmail.com";

  const PERSONAS_FILTRO = ["Freddy", "Bayron", "Oscar", "Fermaval"] as const;
  type PersonaFiltro = typeof PERSONAS_FILTRO[number];
  const [filtroResp, setFiltroResp] = useState<PersonaFiltro | "todos">("todos");

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (filtroResp === "todos") return list;
    return list.filter((s) => s.boleta_subida_por === filtroResp);
  }, [data, filtroResp]);

  async function exportarFiltrado() {
    if (filtered.length === 0) { toast.error("No hay egresos que exportar"); return; }
    const sufijo = filtroResp === "todos" ? "todos" : filtroResp;
    await exportRowsToExcel({
      filename: `egresos-${sufijo}-${new Date().toISOString().slice(0,10)}.xlsx`,
      sheetName: "Egresos",
      columns: [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Tipo", key: "tipo", width: 16 },
        { header: "Descripción", key: "descripcion", width: 40 },
        { header: "Monto (CLP)", key: "monto", width: 16 },
        { header: "Solicitado Por", key: "solicitado", width: 18 },
        { header: "Boleta Subida Por", key: "subida", width: 20 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Latas (color)", key: "latas", width: 40 },
      ],
      rows: filtered.map((s) => {
        const latas = (s.latas as LataItem[] | null) ?? [];
        return {
          fecha: formatDate(s.fecha),
          tipo: TIPO_GASTO_LABEL[s.tipo] ?? s.tipo,
          descripcion: s.descripcion,
          monto: Number(s.monto),
          solicitado: s.solicitado_por ?? "",
          subida: s.boleta_subida_por ?? "",
          estado: s.estado,
          latas: latas.map((l) => `${l.cantidad}× ${l.descripcion} (${l.color})`).join("; "),
        };
      }),
    });
    toast.success(`Exportados ${filtered.length} egresos`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl text-primary">SOLICITUDES DE EGRESO</h1>
          <p className="text-sm text-muted-foreground">Gastos solicitados por el equipo</p>
        </div>
        <NuevaSolicitud onCreated={() => qc.invalidateQueries({ queryKey: ["egresos"] })} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <Label className="text-xs">Filtrar por “Boleta Subida Por”</Label>
          <Select value={filtroResp} onValueChange={(v) => setFiltroResp(v as PersonaFiltro | "todos")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {PERSONAS_FILTRO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{filtered.length}</strong> de {(data ?? []).length}
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportarFiltrado}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Exportar filtrados a Excel
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descripción</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Solicitado Por</th>
                <th className="p-3">Boleta Subida Por</th>
                <th className="p-3">Latas (color)</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {filtered.map((s) => {
                const latas = (s.latas as LataItem[] | null) ?? [];
                return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3">{formatDate(s.fecha)}</td>
                  <td className="p-3">{TIPO_GASTO_LABEL[s.tipo]}</td>
                  <td className="p-3">{s.descripcion}</td>
                  <td className="p-3 font-semibold">{formatCLP(s.monto)}</td>
                  <td className="p-3">{s.solicitado_por ?? "—"}</td>
                  <td className="p-3">{s.boleta_subida_por ?? "—"}</td>
                  <td className="p-3">
                    {latas.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {latas.map((l, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-0.5 text-[11px]">
                            <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: COLOR_SWATCH[l.color] ?? "#999" }} />
                            {l.cantidad}× {l.descripcion}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      s.estado === "aprobado" ? "bg-green-100 text-green-800" :
                      s.estado === "rechazado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }`}>{s.estado}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {auth.isAdmin && (
                        <LatasDialog id={s.id} initial={latas} onSaved={() => qc.invalidateQueries({ queryKey: ["egresos"] })} />
                      )}
                      {s.estado === "aprobado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Descargar Comprobante"
                          onClick={() => downloadComprobantePDF({
                            id: s.id, tipo: s.tipo, descripcion: s.descripcion, monto: Number(s.monto),
                            fecha: s.fecha, solicitado_por: s.solicitado_por, boleta_subida_por: s.boleta_subida_por,
                            estado: "aprobado",
                            decidido_at: s.decidido_at ?? null,
                            aprobador_nombre: "Administrador General",
                            aprobador_email: "fermaval.contacto@gmail.com",
                            latas,
                          })}
                        >
                          <Download className="h-4 w-4 mr-1" /> Comprobante
                        </Button>
                      )}
                      {isSuper && s.estado === "pendiente" && (
                        <>
                          <Button size="sm" variant="outline" title="Aprobar" onClick={() => decide.mutate({ id: s.id, estado: "aprobado" })}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button size="sm" variant="outline" title="Rechazar" onClick={() => decide.mutate({ id: s.id, estado: "rechazado" })}><X className="h-4 w-4 text-red-600" /></Button>
                        </>
                      )}
                      {isSuper && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar esta solicitud?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción es irreversible y quedará registrada en el historial.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{(data ?? []).length === 0 ? "Sin solicitudes." : "Sin resultados para el filtro."}</td></tr>}

            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NuevaSolicitud({ onCreated }: { onCreated: () => void }) {
  const { auth } = Route.useRouteContext();
  const isSuper = auth.email.toLowerCase() === "fermaval.contacto@gmail.com";
  const today = new Date().toISOString().slice(0,10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "materiales" as const,
    descripcion: "",
    monto: "",
    fecha: today,
    solicitado_por: "Freddy" as Persona,
  });
  const mut = useMutation({
    mutationFn: () => createEgreso({ data: {
      tipo: form.tipo,
      descripcion: form.descripcion,
      monto: Number(form.monto),
      fecha: isSuper ? form.fecha : today,
      solicitado_por: form.solicitado_por,
      boleta_subida_por: null,
    } }),
    onSuccess: () => { toast.success("Solicitud creada"); onCreated(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="hero"><Plus className="mr-1 h-4 w-4" /> Nueva solicitud</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva solicitud de egreso</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as typeof form.tipo })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_GASTO_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Descripción</Label><Textarea value={form.descripcion} onChange={(e)=>setForm({...form, descripcion: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto</Label><Input type="number" value={form.monto} onChange={(e)=>setForm({...form, monto: e.target.value})} /></div>
            <div>
              <Label>Fecha {isSuper && <span className="text-xs text-muted-foreground">(puede ser anterior)</span>}</Label>
              <Input
                type="date"
                value={form.fecha}
                max={isSuper ? undefined : today}
                disabled={!isSuper}
                onChange={(e)=>setForm({...form, fecha: e.target.value})}
              />
              {!isSuper && <p className="mt-1 text-[10px] text-muted-foreground">Solo el Administrador General puede registrar fechas pasadas.</p>}
            </div>
          </div>
          <div>
            <Label>Creador de la Solicitud *</Label>
            <Select value={form.solicitado_por} onValueChange={(v) => setForm({ ...form, solicitado_por: v as Persona })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONAS_INTERNAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              La boleta se asignará y subirá más tarde desde el apartado “Rendir Boleta”.
            </p>
          </div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Guardando..." : "Solicitar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LatasDialog({ id, initial, onSaved }: { id: string; initial: LataItem[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [latas, setLatas] = useState<LataItem[]>(initial.length ? initial : []);
  const mut = useMutation({
    mutationFn: () => updateEgresoLatas({ data: { id, latas } }),
    onSuccess: () => { toast.success("Latas actualizadas"); onSaved(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  function update(i: number, patch: Partial<LataItem>) {
    setLatas((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function add() {
    setLatas((arr) => [...arr, { descripcion: "", cantidad: 1, color: "Blanco" }]);
  }
  function remove(i: number) {
    setLatas((arr) => arr.filter((_, idx) => idx !== i));
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setLatas(initial); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Personalizar latas (color por lata)">
          <Palette className="h-4 w-4 mr-1" /> Latas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Personalizar latas solicitadas</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {latas.length === 0 && (
            <p className="rounded border bg-muted/30 p-3 text-sm text-muted-foreground">
              Aún no hay latas registradas. Agrega la primera con el botón inferior.
            </p>
          )}
          {latas.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_160px_auto] items-end gap-2 rounded border p-2">
              <div>
                <Label className="text-xs">Descripción / referencia</Label>
                <Input value={l.descripcion} onChange={(e) => update(i, { descripcion: e.target.value })} placeholder="Ej: Esmalte 1 gal" />
              </div>
              <div>
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" min={1} value={l.cantidad}
                  onChange={(e) => update(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Select value={l.color} onValueChange={(v) => update(i, { color: v })}>
                  <SelectTrigger>
                    <SelectValue>
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full border" style={{ background: COLOR_SWATCH[l.color] ?? "#999" }} />
                        {l.color}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COLORES_LATA.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full border" style={{ background: COLOR_SWATCH[c] ?? "#999" }} />
                          {c}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(i)} title="Quitar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" /> Agregar lata</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="hero" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

