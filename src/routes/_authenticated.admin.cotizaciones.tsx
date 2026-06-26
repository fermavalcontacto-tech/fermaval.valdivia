import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCotizaciones, updateCotizacionEstado, createCotizacionManual,
  updateCotizacionFull, deleteCotizacion,
} from "@/lib/admin.functions";
import { sendCotizacionEmail } from "@/lib/email-cotizacion.functions";
import { pdfsForCotizacion, downloadCotizacionPDF, downloadPagoPDF, type CotizacionPDF } from "@/lib/cotizacion-pdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCLP, formatDate, ESTADO_LABEL } from "@/lib/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Pencil, Trash2, Download, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/cotizaciones")({
  component: CotizacionesPage,
});

const estados = ["cotizacion_creada","esperando_pago","pago_parcial","pedido_confirmado","pedido_terminado","rechazada"] as const;
type Estado = typeof estados[number];

type Cotizacion = {
  id: string; numero: string; created_at: string;
  largo_m: number; ancho_m: number; cantidad_planchas: number; metros2: number; precio_m2: number;
  descuento: number; total: number; pago_recibido: number; saldo: number;
  color_nombre: string | null; estado: Estado; cliente_id: string;
  cliente: { id?: string; nombre?: string; correo?: string; telefono?: string; direccion?: string } | null;
};

function CotizacionesPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => listCotizaciones() });
  const [editing, setEditing] = useState<Cotizacion | null>(null);

  function toPdfData(c: Cotizacion): CotizacionPDF {
    return {
      numero: c.numero,
      fecha: c.created_at,
      cliente: {
        nombre: c.cliente?.nombre ?? "—",
        correo: c.cliente?.correo ?? "",
        telefono: c.cliente?.telefono ?? "—",
        direccion: c.cliente?.direccion ?? "—",
      },
      largo_m: c.largo_m, ancho_m: c.ancho_m, cantidad_planchas: c.cantidad_planchas, metros2: c.metros2,
      color_nombre: c.color_nombre, precio_m2: c.precio_m2,
      descuento: c.descuento ?? 0, total: c.total,
      pago_recibido: c.pago_recibido, saldo: c.saldo,
      estado: ESTADO_LABEL[c.estado] ?? c.estado,
      aprobador_nombre: auth.email?.split("@")[0] ?? "Administrador",
      aprobador_email: auth.email ?? "",
      aprobado_at: new Date().toISOString(),
    };
  }

  async function dispatchAprobacion(c: Cotizacion) {
    const pdfData = toPdfData(c);
    downloadCotizacionPDF(pdfData);
    downloadPagoPDF(pdfData);
    const correo = c.cliente?.correo;
    if (!correo) {
      toast.warning("Cliente sin correo: PDFs descargados, no se envió email.");
      return;
    }
    try {
      const { cotizacionBase64, pagoBase64 } = pdfsForCotizacion(pdfData);
      await sendCotizacionEmail({ data: {
        numero: c.numero, to: correo, cliente_nombre: pdfData.cliente.nombre,
        total: c.total, cotizacion_pdf_base64: cotizacionBase64, pago_pdf_base64: pagoBase64,
      }});
      toast.success(`Email enviado a ${correo}`);
    } catch (e) {
      toast.error(`Email no enviado: ${(e as Error).message}`);
    }
  }

  const mut = useMutation({
    mutationFn: (v: { id: string; estado: Estado; cot: Cotizacion }) =>
      updateCotizacionEstado({ data: { id: v.id, estado: v.estado } }).then(() => v),
    onSuccess: async (v) => {
      qc.invalidateQueries({ queryKey: ["cotizaciones"] });
      toast.success("Estado actualizado");
      if (v.estado === "pedido_confirmado") {
        await dispatchAprobacion({ ...v.cot, estado: v.estado });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteCotizacion({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cotizaciones"] }); toast.success("Cotización eliminada"); },
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
              <tr>
                <th className="p-3">N°</th><th className="p-3">Cliente</th><th className="p-3">Fecha</th>
                <th className="p-3">Total</th><th className="p-3">Pagado</th><th className="p-3">Saldo</th>
                <th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {((data ?? []) as Cotizacion[]).map((c) => {
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
                    <Select value={c.estado} onValueChange={(v) => mut.mutate({ id: c.id, estado: v as Estado, cot: c })}>
                      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{estados.map((s) => <SelectItem key={s} value={s}>{ESTADO_LABEL[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" title="Ver cotización pública">
                        <Link to="/cotizacion/$numero" params={{ numero: c.numero }} search={{ t: (c as { access_token?: string }).access_token }} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      {(c.estado === "pedido_confirmado" || c.estado === "pedido_terminado") && (
                        <Button variant="ghost" size="sm" title="Descargar / reenviar comprobante" onClick={() => dispatchAprobacion(c)}>
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      {auth.isSuperadmin && (
                        <>
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar cotización {c.numero}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará la cotización, pagos asociados y quedará registrada en el historial.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
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

      {auth.isSuperadmin && (
        <EditarCotizacionDialog
          cot={editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["cotizaciones"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EditarCotizacionDialog({
  cot, onOpenChange, onSaved,
}: { cot: Cotizacion | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: "", telefono: "", correo: "", direccion: "",
    largo_m: "0", cantidad_planchas: "1", color: "", precio_m2: "0",
    descuento: "0", pago_recibido: "0", estado: "cotizacion_creada" as Estado,
  });
  useEffect(() => {
    if (!cot) return;
    setForm({
      nombre: cot.cliente?.nombre ?? "", telefono: cot.cliente?.telefono ?? "",
      correo: cot.cliente?.correo ?? "", direccion: cot.cliente?.direccion ?? "",
      largo_m: String(cot.largo_m), cantidad_planchas: String(cot.cantidad_planchas ?? 1),
      color: cot.color_nombre ?? "", precio_m2: String(cot.precio_m2),
      descuento: String(cot.descuento ?? 0), pago_recibido: String(cot.pago_recibido),
      estado: cot.estado,
    });
  }, [cot]);

  const mut = useMutation({
    mutationFn: () => updateCotizacionFull({ data: {
      id: cot!.id,
      cliente: {
        id: cot!.cliente_id,
        nombre: form.nombre, telefono: form.telefono,
        correo: form.correo, direccion: form.direccion,
      },
      largo_m: Number(form.largo_m), cantidad_planchas: Number(form.cantidad_planchas),
      color_nombre: form.color || null, precio_m2: Number(form.precio_m2),
      descuento: Number(form.descuento), pago_recibido: Number(form.pago_recibido),
      estado: form.estado,
    } }),
    onSuccess: () => { toast.success("Cotización actualizada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const m2 = Number(form.largo_m) * 1 * Number(form.cantidad_planchas);
  const total = Math.max(0, Math.round(m2 * Number(form.precio_m2) - Number(form.descuento)));
  const saldo = Math.max(0, total - Number(form.pago_recibido));

  return (
    <Dialog open={!!cot} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Editar cotización {cot?.numero}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Nombre</Label><Input value={form.nombre} onChange={(e)=>setForm({...form, nombre: e.target.value})} /></div>
          <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e)=>setForm({...form, telefono: e.target.value})} /></div>
          <div><Label>Correo</Label><Input type="email" value={form.correo} onChange={(e)=>setForm({...form, correo: e.target.value})} /></div>
          <div><Label>Dirección</Label><Input value={form.direccion} onChange={(e)=>setForm({...form, direccion: e.target.value})} /></div>
          <div><Label>Largo (m)</Label><Input type="number" step="0.01" value={form.largo_m} onChange={(e)=>setForm({...form, largo_m: e.target.value})} /></div>
          <div><Label>Ancho (m)</Label><Input type="number" step="0.01" value={form.ancho_m} onChange={(e)=>setForm({...form, ancho_m: e.target.value})} /></div>
          <div><Label>Color</Label><Input value={form.color} onChange={(e)=>setForm({...form, color: e.target.value})} /></div>
          <div><Label>Precio / m²</Label><Input type="number" value={form.precio_m2} onChange={(e)=>setForm({...form, precio_m2: e.target.value})} /></div>
          <div><Label>Descuento (CLP)</Label><Input type="number" value={form.descuento} onChange={(e)=>setForm({...form, descuento: e.target.value})} /></div>
          <div><Label>Pago recibido (CLP)</Label><Input type="number" value={form.pago_recibido} onChange={(e)=>setForm({...form, pago_recibido: e.target.value})} /></div>
          <div className="sm:col-span-2">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => setForm({...form, estado: v as Estado})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{estados.map((s) => <SelectItem key={s} value={s}>{ESTADO_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span>m²:</span><span className="font-mono">{m2.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total:</span><span className="font-mono font-semibold">{formatCLP(total)}</span></div>
            <div className="flex justify-between"><span>Saldo:</span><span className="font-mono font-semibold">{formatCLP(saldo)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Guardando..." : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaCotizacionDialog({ onCreated }: { onCreated: () => void }) {
  const { auth } = Route.useRouteContext();
  const isSuper = auth.isSuperadmin;
  const today = new Date().toISOString().slice(0,10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", correo: "", direccion: "", largo_m: "", ancho_m: "", color: "", precio_m2: "7990", fecha_solicitud: today });
  const mut = useMutation({
    mutationFn: () => createCotizacionManual({ data: {
      cliente: { nombre: form.nombre, telefono: form.telefono, correo: form.correo, direccion: form.direccion },
      largo_m: Number(form.largo_m), ancho_m: Number(form.ancho_m),
      color_nombre: form.color || null, precio_m2: Number(form.precio_m2),
      fecha_solicitud: isSuper ? form.fecha_solicitud : today,
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
          <div className="sm:col-span-2">
            <Label>Fecha de la solicitud {isSuper && <span className="text-xs text-muted-foreground">(puede ser anterior)</span>}</Label>
            <Input
              type="date"
              value={form.fecha_solicitud}
              max={isSuper ? undefined : today}
              disabled={!isSuper}
              onChange={(e)=>setForm({...form, fecha_solicitud: e.target.value})}
            />
            {!isSuper && <p className="mt-1 text-[10px] text-muted-foreground">Solo el Administrador General puede registrar fechas pasadas para archivar correctamente meses anteriores.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Creando..." : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
