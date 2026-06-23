import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getColores, upsertColor, deleteColor } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/colores")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isSuperadmin) throw redirect({ to: "/admin" });
  },
  component: ColoresPage,
});


type Color = { id: string; nombre: string; hex: string; imagen_url: string | null; activo: boolean; orden: number };

function ColoresPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["colores-admin"], queryFn: () => getColores() });
  const [editing, setEditing] = useState<Color | null>(null);
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => deleteColor({ data: { id } }),
    onSuccess: () => {
      toast.success("Color eliminado");
      qc.invalidateQueries({ queryKey: ["colores-admin"] });
      qc.invalidateQueries({ queryKey: ["public-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl text-primary">COLORES</h1>
          <p className="text-sm text-muted-foreground">Gestiona los colores disponibles</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} variant="hero">
          <Plus className="mr-1 h-4 w-4" /> Nuevo color
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(data ?? []).map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div
              className="h-32"
              style={{
                background: c.imagen_url
                  ? `url(${c.imagen_url}) center/cover`
                  : `linear-gradient(135deg, ${c.hex}, color-mix(in oklab, ${c.hex} 70%, black))`,
              }}
            />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.nombre}</div>
                  <div className="font-mono text-xs text-muted-foreground">{c.hex}</div>
                </div>
                <div className="text-xs">
                  {c.activo ? <span className="text-green-600">Activo</span> : <span className="text-muted-foreground">Inactivo</span>}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}>
                  <Edit className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { if (confirm("¿Eliminar este color?")) del.mutate(c.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <ColorDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["colores-admin"] });
          qc.invalidateQueries({ queryKey: ["public-config"] });
        }}
      />
    </div>
  );
}

function ColorDialog({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Color | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    id: "", nombre: "", hex: "#888888", imagen_url: "", activo: true, orden: 0,
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        id: initial.id, nombre: initial.nombre, hex: initial.hex,
        imagen_url: initial.imagen_url ?? "", activo: initial.activo, orden: initial.orden,
      });
    } else {
      setForm({ id: "", nombre: "", hex: "#888888", imagen_url: "", activo: true, orden: 0 });
    }
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: () => upsertColor({
      data: {
        id: form.id || null, nombre: form.nombre, hex: form.hex,
        imagen_url: form.imagen_url || null, activo: form.activo, orden: form.orden,
      },
    }),
    onSuccess: () => { toast.success("Guardado"); onSaved(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar color" : "Nuevo color"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Color (hex)</Label><Input value={form.hex} onChange={(e) => setForm({ ...form, hex: e.target.value })} /></div>
            <div><Label>Orden</Label><Input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Imagen URL (opcional)</Label>
            <Input value={form.imagen_url} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
            <Label>Activo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero">
            {mut.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
