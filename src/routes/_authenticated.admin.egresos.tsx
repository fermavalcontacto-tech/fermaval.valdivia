import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listEgresos, createEgreso, decideEgreso, deleteEgreso, PERSONAS_INTERNAS } from "@/lib/admin.functions";
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
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Check, X, Trash2, Download } from "lucide-react";
import { downloadComprobantePDF } from "@/lib/comprobante-pdf";

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
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descripción</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Solicitado Por</th>
                <th className="p-3">Boleta Subida Por</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3">{formatDate(s.fecha)}</td>
                  <td className="p-3">{TIPO_GASTO_LABEL[s.tipo]}</td>
                  <td className="p-3">{s.descripcion}</td>
                  <td className="p-3 font-semibold">{formatCLP(s.monto)}</td>
                  <td className="p-3">{s.solicitado_por ?? "—"}</td>
                  <td className="p-3">{s.boleta_subida_por ?? "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      s.estado === "aprobado" ? "bg-green-100 text-green-800" :
                      s.estado === "rechazado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }`}>{s.estado}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
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
              ))}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin solicitudes.</td></tr>}
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
    boleta_subida_por: "ninguno" as Persona | "ninguno",
  });
  const mut = useMutation({
    mutationFn: () => createEgreso({ data: {
      tipo: form.tipo,
      descripcion: form.descripcion,
      monto: Number(form.monto),
      fecha: isSuper ? form.fecha : today,
      solicitado_por: form.solicitado_por,
      boleta_subida_por: form.boleta_subida_por === "ninguno" ? null : form.boleta_subida_por,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Creador de la Solicitud *</Label>
              <Select value={form.solicitado_por} onValueChange={(v) => setForm({ ...form, solicitado_por: v as Persona })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSONAS_INTERNAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsable de Subir Boleta</Label>
              <Select value={form.boleta_subida_por} onValueChange={(v) => setForm({ ...form, boleta_subida_por: v as Persona | "ninguno" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin asignar</SelectItem>
                  {PERSONAS_INTERNAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Guardando..." : "Solicitar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
