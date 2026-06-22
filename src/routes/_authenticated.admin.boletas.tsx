import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBoletas, createBoleta } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP, formatDate, TIPO_GASTO_LABEL } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, FileImage, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/boletas")({
  component: BoletasPage,
});

function BoletasPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["boletas"], queryFn: () => listBoletas() });

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
              <tr><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Descripción</th><th className="p-3">Monto</th><th className="p-3">Archivo</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {(data ?? []).map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="p-3">{formatDate(b.fecha)}</td>
                  <td className="p-3">{TIPO_GASTO_LABEL[b.tipo_gasto]}</td>
                  <td className="p-3">{b.descripcion ?? "—"}</td>
                  <td className="p-3 font-semibold">{formatCLP(b.monto)}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => download(b.archivo_path, b.archivo_nombre)}>
                      <Download className="mr-1 h-3 w-3" /> {b.archivo_nombre ?? "Archivo"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sin boletas aún.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NuevaBoleta({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof TIPO_GASTO_LABEL>("materiales");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0,10));
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
      await createBoleta({ data: { tipo_gasto: tipo, descripcion: descripcion || null, monto: Number(monto), fecha, archivo_path: path, archivo_nombre: file.name } });
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
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_GASTO_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Descripción</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto</Label><Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
            <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
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
