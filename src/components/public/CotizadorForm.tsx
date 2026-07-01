import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP } from "@/lib/format";
import { createPublicQuote } from "@/lib/public.functions";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Color = { id: string; nombre: string; hex: string; imagen_url: string | null; stock_m?: number };
type FieldCfg = { label: string; visible: boolean; required: boolean };
type FormFields = { nombre: FieldCfg; telefono: FieldCfg; correo: FieldCfg; direccion: FieldCfg };
const DEFAULT_FIELDS: FormFields = {
  nombre: { label: "Nombre", visible: true, required: true },
  telefono: { label: "Teléfono", visible: true, required: true },
  correo: { label: "Correo", visible: true, required: true },
  direccion: { label: "Dirección (opcional)", visible: true, required: false },
};

const TIPOS_PRODUCTO = ["Ondulado","PV8","PV8 Invertido","Microondulado","6V","PV4","Lata Lisa"] as const;
type Tipo = typeof TIPOS_PRODUCTO[number];
const ESPESOR_MM = 0.4;
const PUBLIC_LEGAL_NOTICE = "Por razones de seguridad y cumplimiento legal, solo se despacharán productos en vehículos que cuenten con las dimensiones adecuadas para su traslado. El retiro de planchas debe cumplir la normativa chilena vigente (Decreto 158 MOP): la carga no puede sobresalir más de 2 metros de la carrocería.";
const VARIANT_STOCK_REGEX = /variante|stock\s+para/i;

type Item = { largo: string; cantidad: string; color_id: string; tipo: Tipo };

export function CotizadorForm({ precio, colores, formFields }: { precio: number; colores: Color[]; formFields?: Partial<FormFields> | null }) {
  const ff: FormFields = {
    nombre: { ...DEFAULT_FIELDS.nombre, ...(formFields?.nombre ?? {}) },
    telefono: { ...DEFAULT_FIELDS.telefono, ...(formFields?.telefono ?? {}) },
    correo: { ...DEFAULT_FIELDS.correo, ...(formFields?.correo ?? {}) },
    direccion: { ...DEFAULT_FIELDS.direccion, ...(formFields?.direccion ?? {}) },
  };

  const navigate = useNavigate();
  const colorMap = useMemo(() => new Map(colores.map((c) => [c.id, c])), [colores]);
  const [items, setItems] = useState<Item[]>([
    { largo: "", cantidad: "1", color_id: colores[0]?.id ?? "", tipo: "Ondulado" },
  ]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");

  const itemsCalc = useMemo(
    () => items.map((it) => {
      const l = Number(it.largo) || 0;
      const n = Number(it.cantidad) || 0;
      return { largo: l, cantidad: n, color_id: it.color_id, tipo: it.tipo, m2: Number((l * 1 * n).toFixed(2)) };
    }),
    [items],
  );
  const m2Total = useMemo(() => Number(itemsCalc.reduce((s, x) => s + x.m2, 0).toFixed(2)), [itemsCalc]);
  const total = Math.round(m2Total * precio);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems((arr) => [...arr, { largo: "", cantidad: "1", color_id: colores[0]?.id ?? "", tipo: "Ondulado" }]);
  }
  function removeItem(i: number) {
    setItems((arr) => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i));
  }

  const mut = useMutation({
    mutationFn: () => createPublicQuote({
      data: {
        items: itemsCalc.map((it) => ({
          largo_m: it.largo, cantidad_planchas: it.cantidad,
          color_id: it.color_id || null, tipo: it.tipo, espesor_mm: ESPESOR_MM,
        })),
        cliente: { nombre, telefono, correo, direccion },
      },
    }),
    onSuccess: (r) => {
      toast.success(`Cotización ${r.numero} generada`);
      navigate({ to: "/cotizacion/$numero", params: { numero: r.numero }, search: { t: r.access_token } });
    },
    onError: (e: Error) => {
      // Bypass: silenciar cualquier mensaje relacionado con variantes de stock;
      // el inventario real se controla por Color + 0,4 mm, no por tipo de lata.
      if (VARIANT_STOCK_REGEX.test(e.message)) {
        toast.dismiss();
        return;
      }
      toast.error(e.message);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const [i, it] of itemsCalc.entries()) {
      if (it.largo <= 0) { toast.error(`Plancha ${i + 1}: ingresa un largo válido`); return; }
      if (it.cantidad <= 0 || !Number.isInteger(it.cantidad)) { toast.error(`Plancha ${i + 1}: cantidad inválida`); return; }
      if (!it.color_id) { toast.error(`Plancha ${i + 1}: selecciona un color`); return; }
    }
    const checks: Array<[string, boolean, string]> = [
      [ff.nombre.label, ff.nombre.visible && ff.nombre.required && !nombre.trim(), nombre],
      [ff.telefono.label, ff.telefono.visible && ff.telefono.required && !telefono.trim(), telefono],
      [ff.correo.label, ff.correo.visible && ff.correo.required && !correo.trim(), correo],
      [ff.direccion.label, ff.direccion.visible && ff.direccion.required && !direccion.trim(), direccion],
    ];
    for (const [label, missing] of checks) {
      if (missing) { toast.error(`Completa el campo "${label}"`); return; }
    }
    if (ff.correo.visible && correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      toast.error("Correo inválido"); return;
    }
    mut.mutate();
  }


  return (
    <Card className="w-full min-w-0 overflow-hidden border-2 border-border bg-card p-4 shadow-xl md:p-8">
      <form onSubmit={submit} className="grid w-full min-w-0 grid-cols-1 gap-6">
        <div className="w-full min-w-0 space-y-3">
          <div>
            <Label>Planchas del pedido</Label>
            <p className="text-xs text-muted-foreground">
              Ancho estándar: 1 m · Espesor estándar: <strong>0,4 mm</strong>. Selecciona tipo, color y largo por plancha.
            </p>
          </div>

          {items.map((it, i) => {
            const calc = itemsCalc[i];
            return (
              <div key={i} className="w-full min-w-0 space-y-3 overflow-hidden rounded-md border bg-muted/20 p-3">
                <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_2.5rem] md:items-end">
                  <div className="w-full min-w-0 space-y-1">
                    <Label htmlFor={`tipo-${i}`}>Tipo</Label>
                    <Select value={it.tipo} onValueChange={(v) => updateItem(i, { tipo: v as Tipo })}>
                      <SelectTrigger id={`tipo-${i}`} className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_PRODUCTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full min-w-0 space-y-1">
                    <Label htmlFor={`largo-${i}`}>Largo (m)</Label>
                    <Input id={`largo-${i}`} type="number" step="0.01" min="0" value={it.largo}
                      onChange={(e) => updateItem(i, { largo: e.target.value })} placeholder="0,00" />
                  </div>
                  <div className="w-full min-w-0 space-y-1">
                    <Label htmlFor={`cant-${i}`}>Cantidad</Label>
                    <Input id={`cant-${i}`} type="number" step="1" min="1" value={it.cantidad}
                      onChange={(e) => updateItem(i, { cantidad: e.target.value })} placeholder="1" />
                  </div>
                  <div className="flex w-full min-w-0 items-center justify-between rounded-md bg-background px-3 py-2 text-sm md:block md:bg-transparent md:px-0 md:py-0">
                    <div className="text-[10px] uppercase text-muted-foreground">m²</div>
                    <div className="font-mono text-base font-semibold text-primary">{calc.m2.toFixed(2)}</div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-full md:w-9" onClick={() => removeItem(i)} disabled={items.length === 1} title="Quitar">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="w-full min-w-0">
                  <Label>Color (espesor fijo 0,4 mm)</Label>
                  <div className="mt-2 grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                    {colores.map((c) => (
                      <button type="button" key={c.id} onClick={() => updateItem(i, { color_id: c.id })}
                        className={`flex w-full min-w-0 items-center gap-2 rounded-md border-2 p-2 text-left transition ${it.color_id === c.id ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/50"}`}>
                        <span className="h-6 w-6 shrink-0 rounded shadow-inner" style={{ background: c.hex }} />
                        <span className="min-w-0 flex-1 text-xs font-medium leading-tight">{c.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" size="sm" className="w-full md:w-auto" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" /> Agregar otra plancha
          </Button>

          {itemsCalc.some((x) => x.m2 > 0) && (
            <div className="w-full min-w-0 rounded-md border bg-background p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalle del pedido</div>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 text-left font-medium">#</th>
                      <th className="py-1 text-left font-medium">Tipo</th>
                      <th className="py-1 text-left font-medium">Color</th>
                      <th className="py-1 text-right font-medium">Espesor</th>
                      <th className="py-1 text-right font-medium">Largo</th>
                      <th className="py-1 text-right font-medium">Cant.</th>
                      <th className="py-1 text-right font-medium">m²</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {itemsCalc.map((it, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1">{it.tipo}</td>
                        <td className="py-1">{colorMap.get(it.color_id)?.nombre ?? "—"}</td>
                        <td className="py-1 text-right">0,4 mm</td>
                        <td className="py-1 text-right">{it.largo} m</td>
                        <td className="py-1 text-right">{it.cantidad}</td>
                        <td className="py-1 text-right font-semibold">{it.m2.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="w-full min-w-0 rounded-md bg-muted p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total metros cuadrados</div>
            <div className="font-display text-3xl text-primary">{m2Total.toFixed(2)} m²</div>
          </div>
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          {ff.nombre.visible && (
            <div className="w-full min-w-0 space-y-1"><Label htmlFor="nombre">{ff.nombre.label}{ff.nombre.required && " *"}</Label><Input className="w-full" id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          )}
          {ff.telefono.visible && (
            <div className="w-full min-w-0 space-y-1"><Label htmlFor="telefono">{ff.telefono.label}{ff.telefono.required && " *"}</Label><Input className="w-full" id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
          )}
          {ff.correo.visible && (
            <div className="w-full min-w-0 space-y-1"><Label htmlFor="correo">{ff.correo.label}{ff.correo.required && " *"}</Label><Input className="w-full" id="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
          )}
          {ff.direccion.visible && (
            <div className="w-full min-w-0 space-y-1"><Label htmlFor="direccion">{ff.direccion.label}{ff.direccion.required && " *"}</Label><Input className="w-full" id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
          )}
        </div>

        <div className="quote-legal-notice w-full min-w-0 rounded-md p-3 text-xs font-medium text-foreground">
          📌 {PUBLIC_LEGAL_NOTICE}
        </div>


        <div className="flex w-full min-w-0 flex-col items-stretch justify-between gap-4 rounded-md border-2 border-dashed border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total estimado</div>
            <div className="font-display text-4xl text-primary">{formatCLP(total)}</div>
            <div className="text-xs text-muted-foreground">{m2Total.toFixed(2)} m² × {formatCLP(precio)} / m²</div>
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full sm:w-auto" disabled={mut.isPending}>
            {mut.isPending ? "Generando..." : "Generar cotización"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
