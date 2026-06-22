import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listEgresos, createEgreso, decideEgreso } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP, formatDate, TIPO_GASTO_LABEL } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/egresos")({
  component: EgresosPage,
});

function EgresosPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["egresos"], queryFn: () => listEgresos() });

  const decide = useMutation({
    mutationFn: (v: { id: string; estado: "aprobado" | "rechazado" }) => decideEgreso({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["egresos"] }); toast.success("Actualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl text-primary">SOLICITUDES DE EGRESO</h1>
          <p className="text-sm text-muted-foreground">Gastos solicitados por el equipo</p>
        </div>
        <NuevaSolicitud onCreated={() => qc.invalidateQueries({ queryKey: ["egresos"] })} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Descripción</th><th className="p-3">Monto</th><th className="p-3">Estado</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3">{formatDate(s.fecha)}</td>
                  <td className="p-3">{TIPO_GASTO_LABEL[s.tipo]}</td>
                  <td className="p-3">{s.descripcion}</td>
                  <td className="p-3 font-semibold">{formatCLP(s.monto)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      s.estado === "aprobado" ? "bg-green-100 text-green-800" :
                      s.estado === "rechazado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }`}>{s.estado}</span>
                  </td>
                  <td className="p-3">
                    {auth.isAdmin && s.estado === "pendiente" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: s.id, estado: "aprobado" })}><Check className="h-4 w-4 text-green-600" /></Button>
                        <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: s.id, estado: "rechazado" })}><X className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin solicitudes.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NuevaSolicitud({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "materiales" as const, descripcion: "", monto: "", fecha: new Date().toISOString().slice(0,10) });
  const mut = useMutation({
    mutationFn: () => createEgreso({ data: { tipo: form.tipo, descripcion: form.descripcion, monto: Number(form.monto), fecha: form.fecha } }),
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
            <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e)=>setForm({...form, fecha: e.target.value})} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Guardando..." : "Solicitar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
