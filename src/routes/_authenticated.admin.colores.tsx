import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getColores, upsertColor, deleteColor, adjustColorStock, listStockMovimientos } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit, ArrowUpCircle, ArrowDownCircle, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/colores")({
  component: ColoresPage,
});

type Color = { id: string; nombre: string; hex: string; imagen_url: string | null; activo: boolean; orden: number; stock_m: number };

function ColoresPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["colores-admin"], queryFn: () => getColores() });
  const movs = useQuery({ queryKey: ["stock-movs"], queryFn: () => listStockMovimientos() });
  const [editing, setEditing] = useState<Color | null>(null);
  const [open, setOpen] = useState(false);
  const [stockFor, setStockFor] = useState<Color | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">COLORES Y STOCK</h1>
          <p className="text-sm text-muted-foreground">Gestiona los colores y el stock disponible en metros. Los cambios se reflejan al instante en el cotizador.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <History className="mr-1 h-4 w-4" /> Movimientos
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} variant="hero">
            <Plus className="mr-1 h-4 w-4" /> Nuevo color
          </Button>
        </div>
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
              <div className="mt-3 rounded-md border bg-muted/30 p-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Stock disponible</div>
                <div className={`font-display text-2xl ${Number(c.stock_m) <= 0 ? "text-destructive" : "text-primary"}`}>{Number(c.stock_m).toFixed(2)} <span className="text-xs">m</span></div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1">
                <Button size="sm" variant="outline" onClick={() => setStockFor(c)}>
                  <ArrowUpCircle className="mr-1 h-3 w-3" /> Stock
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}>
                  <Edit className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { if (confirm(`¿Eliminar "${c.nombre}"?`)) del.mutate(c.id); }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
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
          qc.invalidateQueries({ queryKey: ["stock-movs"] });
          qc.invalidateQueries({ queryKey: ["public-config"] });
        }}
      />
      <StockDialog
        color={stockFor}
        onOpenChange={(o) => { if (!o) setStockFor(null); }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["colores-admin"] });
          qc.invalidateQueries({ queryKey: ["stock-movs"] });
          qc.invalidateQueries({ queryKey: ["public-config"] });
          setStockFor(null);
        }}
      />
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Movimientos de stock</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Color</th>
                  <th className="p-2 text-right">Δ metros</th>
                  <th className="p-2">Motivo</th>
                  <th className="p-2">Por</th>
                </tr>
              </thead>
              <tbody>
                {(movs.data ?? []).map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="p-2 text-xs">{new Date(m.created_at).toLocaleString("es-CL")}</td>
                    <td className="p-2">{m.color_nombre ?? "—"}</td>
                    <td className={`p-2 text-right font-mono font-semibold ${Number(m.metros) < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {Number(m.metros) > 0 ? "+" : ""}{Number(m.metros).toFixed(2)}
                    </td>
                    <td className="p-2 text-xs">{m.motivo}</td>
                    <td className="p-2 text-xs text-muted-foreground">{m.user_email ?? "—"}</td>
                  </tr>
                ))}
                {!movs.data?.length && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sin movimientos.</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
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
    id: "", nombre: "", hex: "#888888", imagen_url: "", activo: true, orden: 0, stock_m: 0,
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        id: initial.id, nombre: initial.nombre, hex: initial.hex,
        imagen_url: initial.imagen_url ?? "", activo: initial.activo, orden: initial.orden,
        stock_m: Number(initial.stock_m ?? 0),
      });
    } else {
      setForm({ id: "", nombre: "", hex: "#888888", imagen_url: "", activo: true, orden: 0, stock_m: 0 });
    }
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: () => upsertColor({
      data: {
        id: form.id || null, nombre: form.nombre, hex: form.hex,
        imagen_url: form.imagen_url || null, activo: form.activo, orden: form.orden,
        stock_m: Number(form.stock_m) || 0,
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
            <Label>Stock (metros)</Label>
            <Input type="number" step="0.01" min="0" value={form.stock_m}
              onChange={(e) => setForm({ ...form, stock_m: Number(e.target.value) })} />
            <p className="mt-1 text-[10px] text-muted-foreground">Editar aquí sobrescribe el stock total y queda registrado como ajuste.</p>
          </div>
          <div>
            <Label>Imagen URL (opcional)</Label>
            <Input value={form.imagen_url} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
            <Label>Activo (visible en el cotizador)</Label>
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

function StockDialog({
  color, onOpenChange, onSaved,
}: { color: Color | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [delta, setDelta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [signo, setSigno] = useState<"in" | "out">("in");

  useEffect(() => { if (color) { setDelta(""); setMotivo(""); setSigno("in"); } }, [color]);

  const mut = useMutation({
    mutationFn: () => adjustColorStock({ data: {
      color_id: color!.id,
      delta_m: (signo === "in" ? 1 : -1) * Number(delta),
      motivo: motivo.trim(),
    }}),
    onSuccess: () => { toast.success("Stock actualizado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!color} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajustar stock — {color?.nombre}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md bg-muted p-3 text-center">
            <div className="text-xs uppercase text-muted-foreground">Stock actual</div>
            <div className="font-display text-3xl text-primary">{Number(color?.stock_m ?? 0).toFixed(2)} m</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={signo === "in" ? "hero" : "outline"} onClick={() => setSigno("in")}>
              <ArrowUpCircle className="mr-1 h-4 w-4" /> Ingreso
            </Button>
            <Button type="button" variant={signo === "out" ? "hero" : "outline"} onClick={() => setSigno("out")}>
              <ArrowDownCircle className="mr-1 h-4 w-4" /> Salida
            </Button>
          </div>
          <div>
            <Label>Cantidad (m)</Label>
            <Input type="number" step="0.01" min="0" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Recepción proveedor, merma, devolución..." />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !delta || !motivo} variant="hero">
            {mut.isPending ? "Guardando..." : "Registrar movimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
