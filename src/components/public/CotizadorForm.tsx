import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { formatCLP } from "@/lib/format";
import { createPublicQuote } from "@/lib/public.functions";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Color = { id: string; nombre: string; hex: string; imagen_url: string | null };
type Item = { largo: string; cantidad: string };

export function CotizadorForm({ precio, colores }: { precio: number; colores: Color[] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([{ largo: "", cantidad: "1" }]);
  const [colorId, setColorId] = useState<string>(colores[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");

  const itemsCalc = useMemo(
    () => items.map((it) => {
      const l = Number(it.largo) || 0;
      const n = Number(it.cantidad) || 0;
      return { largo: l, cantidad: n, m2: Number((l * 1 * n).toFixed(2)) };
    }),
    [items],
  );
  const m2Total = useMemo(() => Number(itemsCalc.reduce((s, x) => s + x.m2, 0).toFixed(2)), [itemsCalc]);
  const total = Math.round(m2Total * precio);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() { setItems((arr) => [...arr, { largo: "", cantidad: "1" }]); }
  function removeItem(i: number) { setItems((arr) => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)); }

  const mut = useMutation({
    mutationFn: () => createPublicQuote({
      data: {
        items: itemsCalc.map((it) => ({ largo_m: it.largo, cantidad_planchas: it.cantidad })),
        color_id: colorId || null,
        cliente: { nombre, telefono, correo, direccion },
      },
    }),
    onSuccess: (r) => {
      toast.success(`Cotización ${r.numero} generada`);
      navigate({ to: "/cotizacion/$numero", params: { numero: r.numero }, search: { t: r.access_token } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const [i, it] of itemsCalc.entries()) {
      if (it.largo <= 0) { toast.error(`Medida ${i + 1}: ingresa un largo válido`); return; }
      if (it.cantidad <= 0 || !Number.isInteger(it.cantidad)) { toast.error(`Medida ${i + 1}: cantidad inválida`); return; }
    }
    if (!nombre || !telefono || !correo || !direccion) { toast.error("Completa todos tus datos"); return; }
    mut.mutate();
  }

  return (
    <Card className="border-2 border-border bg-card p-6 md:p-8 shadow-xl">
      <form onSubmit={submit} className="grid gap-6">
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <Label>Medidas de planchas</Label>
              <p className="text-xs text-muted-foreground">Ancho estándar: 1 metro (fijo). Puedes agregar varias medidas.</p>
            </div>
          </div>

          {items.map((it, i) => {
            const calc = itemsCalc[i];
            return (
              <div key={i} className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                <div>
                  <Label htmlFor={`largo-${i}`}>Largo de plancha (m)</Label>
                  <Input id={`largo-${i}`} type="number" step="0.01" min="0" value={it.largo}
                    onChange={(e) => updateItem(i, { largo: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <Label htmlFor={`cant-${i}`}>Cantidad de planchas</Label>
                  <Input id={`cant-${i}`} type="number" step="1" min="1" value={it.cantidad}
                    onChange={(e) => updateItem(i, { cantidad: e.target.value })} placeholder="1" />
                </div>
                <div className="text-sm">
                  <div className="text-[10px] uppercase text-muted-foreground">m²</div>
                  <div className="font-mono text-base font-semibold text-primary">{calc.m2.toFixed(2)}</div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1} title="Quitar">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}

          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" /> Agregar otra medida
          </Button>

          {itemsCalc.some((x) => x.m2 > 0) && (
            <div className="rounded-md border bg-background p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalle del pedido</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 text-left font-medium">#</th>
                      <th className="py-1 text-right font-medium">Largo</th>
                      <th className="py-1 text-right font-medium">Ancho</th>
                      <th className="py-1 text-right font-medium">Cantidad</th>
                      <th className="py-1 text-right font-medium">m²</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {itemsCalc.map((it, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1 text-right">{it.largo} m</td>
                        <td className="py-1 text-right">1 m</td>
                        <td className="py-1 text-right">{it.cantidad}</td>
                        <td className="py-1 text-right font-semibold">{it.m2.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total metros cuadrados</div>
            <div className="font-display text-3xl text-primary">{m2Total.toFixed(2)} m²</div>
            <div className="text-[10px] text-muted-foreground">Suma de todas las medidas (largo × 1 m × cantidad)</div>
          </div>
        </div>

        <div>
          <Label>Color</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {colores.map((c) => (
              <button type="button" key={c.id} onClick={() => setColorId(c.id)}
                className={`flex items-center gap-2 rounded-md border-2 p-2 text-left transition ${colorId === c.id ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/50"}`}>
                <span className="h-8 w-8 rounded shadow-inner" style={{ background: c.hex }} />
                <span className="text-sm font-medium">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="nombre">Nombre</Label><Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div><Label htmlFor="telefono">Teléfono</Label><Input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
          <div><Label htmlFor="correo">Correo</Label><Input id="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
          <div><Label htmlFor="direccion">Dirección</Label><Input id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 rounded-md border-2 border-dashed border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total estimado</div>
            <div className="font-display text-4xl text-primary">{formatCLP(total)}</div>
            <div className="text-xs text-muted-foreground">{m2Total.toFixed(2)} m² × {formatCLP(precio)} / m²</div>
          </div>
          <Button type="submit" variant="hero" size="lg" disabled={mut.isPending}>
            {mut.isPending ? "Generando..." : "Generar cotización"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
