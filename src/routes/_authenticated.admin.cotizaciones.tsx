import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCotizaciones, updateCotizacionEstado, createCotizacionManual } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCLP, formatDate, ESTADO_LABEL } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/cotizaciones")({
  component: CotizacionesPage,
});

const estados = ["cotizacion_creada","esperando_pago","pago_parcial","pedido_confirmado","pedido_terminado","rechazada"] as const;

function CotizacionesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => listCotizaciones() });
  const mut = useMutation({
    mutationFn: (v: { id: string; estado: typeof estados[number] }) => updateCotizacionEstado({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cotizaciones"] }); toast.success("Estado actualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">COTIZACIONES</h1>
          <p className="text-sm text-muted-foreground">Gestiona todas las cotizaciones</p>
        </div>
        <NuevaCotizacionDialog onCreated={() => qc.invalidateQueries({ queryKey: ["cotizaciones"] })} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">N°</th><th className="p-3">Cliente</th><th className="p-3">Fecha</th><th className="p-3">Total</th><th className="p-3">Pagado</th><th className="p-3">Saldo</th><th className="p-3">Estado</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {(data ?? []).map((c) => {
                const cli = c.cliente as { nombre?: string } | null;
                return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3 font-mono">{c.numero}</td>
                  <td className="p-3">{cli?.nombre ?? "—"}</td>
                  <td className="p-3">{formatDate(c.created_at)}</td>
                  <td className="p-3">{formatCLP(c.total)}</td>
                  <td className="p-3">{formatCLP(c.pago_recibido)}</td>
                  <td className="p-3 font-semibold">{formatCLP(c.saldo)}</td>
                  <td className="p-3">
                    <Select value={c.estado} onValueChange={(v) => mut.mutate({ id: c.id, estado: v as typeof estados[number] })}>
                      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{estados.map((s) => <SelectItem key={s} value={s}>{ESTADO_LABEL[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/cotizacion/$numero" params={{ numero: c.numero }} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              )})}
              {!isLoading && (data ?? []).length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin cotizaciones aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NuevaCotizacionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", correo: "", direccion: "", largo_m: "", ancho_m: "", color: "", precio_m2: "7990" });
  const mut = useMutation({
    mutationFn: () => createCotizacionManual({ data: {
      cliente: { nombre: form.nombre, telefono: form.telefono, correo: form.correo, direccion: form.direccion },
      largo_m: Number(form.largo_m), ancho_m: Number(form.ancho_m),
      color_nombre: form.color || null, precio_m2: Number(form.precio_m2),
    }}),
    onSuccess: (r) => { toast.success(`Creada ${r.numero}`); onCreated(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="hero"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva cotización</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Nombre</Label><Input value={form.nombre} onChange={(e)=>setForm({...form, nombre: e.target.value})} /></div>
          <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e)=>setForm({...form, telefono: e.target.value})} /></div>
          <div><Label>Correo</Label><Input type="email" value={form.correo} onChange={(e)=>setForm({...form, correo: e.target.value})} /></div>
          <div><Label>Dirección</Label><Input value={form.direccion} onChange={(e)=>setForm({...form, direccion: e.target.value})} /></div>
          <div><Label>Largo (m)</Label><Input type="number" step="0.01" value={form.largo_m} onChange={(e)=>setForm({...form, largo_m: e.target.value})} /></div>
          <div><Label>Ancho (m)</Label><Input type="number" step="0.01" value={form.ancho_m} onChange={(e)=>setForm({...form, ancho_m: e.target.value})} /></div>
          <div><Label>Color</Label><Input value={form.color} onChange={(e)=>setForm({...form, color: e.target.value})} /></div>
          <div><Label>Precio / m²</Label><Input type="number" value={form.precio_m2} onChange={(e)=>setForm({...form, precio_m2: e.target.value})} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Creando..." : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
