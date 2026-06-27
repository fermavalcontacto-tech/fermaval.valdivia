import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBoletas, createBoleta, updateBoleta, deleteBoleta } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP, formatDate, TIPO_GASTO_LABEL } from "@/lib/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, FileImage, Download, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/boletas")({
  component: BoletasPage,
});

type Tipo = keyof typeof TIPO_GASTO_LABEL;
type Persona = "Freddy" | "Bayron" | "Oscar";
const PERSONAS: Persona[] = ["Freddy", "Bayron", "Oscar"];
function detectPersona(email: string): Persona | "" {
  const local = (email || "").toLowerCase().split("@")[0] ?? "";
  for (const p of PERSONAS) if (local.includes(p.toLowerCase())) return p;
  return "";
}
type Boleta = {
  id: string; tipo_gasto: Tipo; descripcion: string | null;
  monto: number; fecha: string; archivo_path: string; archivo_nombre: string | null;
  responsable: Persona | null;
};


function BoletasPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["boletas"], queryFn: () => listBoletas() });
  const [editing, setEditing] = useState<Boleta | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteBoleta({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boletas"] }); toast.success("Boleta eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(path: string, nombre: string | null) {
    const { data, error } = await supabase.storage.from("boletas").createSignedUrl(path, 60);
    if (error || !data) { toast.error("No se pudo abrir"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nombre ?? path.split("/").pop() ?? "boleta";
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl text-primary">BOLETAS Y COMPROBANTES</h1>
          <p className="text-sm text-muted-foreground">Sube y clasifica tus gastos</p>
        </div>
        <NuevaBoleta onCreated={() => qc.invalidateQueries({ queryKey: ["boletas"] })} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Descripción</th>
                <th className="p-3">Monto</th><th className="p-3">Boleta Subida Por</th><th className="p-3">Archivo</th><th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {((data ?? []) as Boleta[]).map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="p-3">{formatDate(b.fecha)}</td>
                  <td className="p-3">{TIPO_GASTO_LABEL[b.tipo_gasto]}</td>
                  <td className="p-3">{b.descripcion ?? "—"}</td>
                  <td className="p-3 font-semibold">{formatCLP(b.monto)}</td>
                  <td className="p-3">{b.responsable ?? "—"}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => download(b.archivo_path, b.archivo_nombre)}>
                      <Download className="mr-1 h-3 w-3" /> {b.archivo_nombre ?? "Archivo"}
                    </Button>

                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {auth.isSuperadmin && (
                        <>
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => setEditing(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar esta boleta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción borrará la boleta, su archivo y quedará registrada en el historial.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
              ))}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin boletas aún.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {auth.isSuperadmin && (
        <EditarBoletaDialog
          boleta={editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["boletas"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EditarBoletaDialog({
  boleta, onOpenChange, onSaved,
}: { boleta: Boleta | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    tipo: "materiales" as Tipo, descripcion: "", monto: "0", fecha: "",
  });
  useEffect(() => {
    if (!boleta) return;
    setForm({
      tipo: boleta.tipo_gasto, descripcion: boleta.descripcion ?? "",
      monto: String(boleta.monto), fecha: boleta.fecha,
    });
  }, [boleta]);

  const mut = useMutation({
    mutationFn: () => updateBoleta({ data: {
      id: boleta!.id, tipo_gasto: form.tipo,
      descripcion: form.descripcion || null,
      monto: Number(form.monto), fecha: form.fecha,
    } }),
    onSuccess: () => { toast.success("Boleta actualizada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!boleta} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar boleta</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo de gasto</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_GASTO_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Descripción</Label><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto</Label><Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
            <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">{mut.isPending ? "Guardando..." : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaBoleta({ onCreated }: { onCreated: () => void }) {
  const { auth } = Route.useRouteContext();
  const isSuper = auth.isSuperadmin;
  const today = new Date().toISOString().slice(0,10);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("materiales");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!file) { toast.error("Selecciona un archivo"); return; }
    if (!monto) { toast.error("Ingresa el monto"); return; }
    setUploading(true);
    try {
      const path = `${new Date().getFullYear()}/${tipo}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("boletas").upload(path, file);
      if (upErr) throw upErr;
      const fechaFinal = isSuper ? fecha : today;
      await createBoleta({ data: { tipo_gasto: tipo, descripcion: descripcion || null, monto: Number(monto), fecha: fechaFinal, archivo_path: path, archivo_nombre: file.name } });
      toast.success("Boleta subida");
      onCreated(); setOpen(false);
      setFile(null); setMonto(""); setDescripcion("");
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="hero"><Plus className="mr-1 h-4 w-4" /> Subir boleta</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Subir boleta o comprobante</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo de gasto</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_GASTO_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Descripción</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto</Label><Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
            <div>
              <Label>Fecha {isSuper && <span className="text-xs text-muted-foreground">(puede ser anterior)</span>}</Label>
              <Input type="date" value={fecha} max={isSuper ? undefined : today} disabled={!isSuper} onChange={(e) => setFecha(e.target.value)} />
              {!isSuper && <p className="mt-1 text-[10px] text-muted-foreground">Solo el Administrador General puede registrar fechas pasadas.</p>}
            </div>
          </div>
          <div>
            <Label>Archivo</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><FileImage className="h-3 w-3" /> {file.name}</div>}
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={uploading} variant="hero">{uploading ? "Subiendo..." : "Guardar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
