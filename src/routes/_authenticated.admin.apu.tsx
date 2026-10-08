import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getColores, listApu, upsertApu, copiarApuMesAnterior } from "@/lib/admin.functions";
import { TIPOS_PRODUCTO, parseDecimal } from "@/lib/domain/quotes.core";
import { costoApuTotal } from "@/lib/domain/apu";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/apu")({
  head: () => ({ meta: [{ title: "APU por color y producto · Fermaval" }] }),
  component: ApuPage,
});

type Vals = { costo_material: string; mano_obra: string; otros_costos: string };

function ApuPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [periodo, setPeriodo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [tipo, setTipo] = useState<string>(TIPOS_PRODUCTO[0]);
  const { data: colores = [] } = useQuery({ queryKey: ["colores"], queryFn: () => getColores() });
  const { data: apu = [] } = useQuery({ queryKey: ["apu", periodo], queryFn: () => listApu({ data: { periodo } }) });
  const [vals, setVals] = useState<Record<string, Vals>>({});

  useEffect(() => {
    const v: Record<string, Vals> = {};
    for (const a of apu.filter((x) => x.tipo === tipo)) {
      v[a.color_id] = { costo_material: String(a.costo_material), mano_obra: String(a.mano_obra), otros_costos: String(a.otros_costos) };
    }
    setVals(v);
  }, [apu, tipo]);

  const guardar = useMutation({
    mutationFn: async () => {
      for (const [color_id, v] of Object.entries(vals)) {
        await upsertApu({ data: { periodo, tipo, color_id,
          costo_material: parseDecimal(v.costo_material), mano_obra: parseDecimal(v.mano_obra), otros_costos: parseDecimal(v.otros_costos) } });
      }
    },
    onSuccess: () => { toast.success("APU guardado"); qc.invalidateQueries({ queryKey: ["apu"] }); qc.invalidateQueries({ queryKey: ["utilidad-apu"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const copiar = useMutation({
    mutationFn: () => copiarApuMesAnterior({ data: { periodo } }),
    onSuccess: (r) => { toast.success(`${r.copiados} registros copiados`); qc.invalidateQueries({ queryKey: ["apu"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (id: string, k: keyof Vals, v: string) =>
    setVals((p) => ({ ...p, [id]: { ...(p[id] ?? { costo_material: "", mano_obra: "", otros_costos: "" }), [k]: v } }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">APU</h1>
        <p className="text-sm text-muted-foreground">Análisis de precio unitario: costo neto por m² de cada producto y color, mes a mes. Se usa para calcular la utilidad real en Finanzas.</p>
      </div>
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Mes</Label><Input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} /></div>
          <div className="w-56"><Label className="text-xs">Producto</Label>
            <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_PRODUCTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button variant="outline" onClick={() => copiar.mutate()} disabled={copiar.isPending}>Copiar APU del mes anterior</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-2 pr-3">Color</th><th className="py-2 pr-3">Material / m²</th><th className="py-2 pr-3">Mano de obra / m²</th><th className="py-2 pr-3">Otros / m²</th><th className="py-2 text-right">Costo APU / m²</th></tr>
            </thead>
            <tbody>
              {colores.map((c) => {
                const v = vals[c.id];
                const total = v ? costoApuTotal({ costo_material: parseDecimal(v.costo_material), mano_obra: parseDecimal(v.mano_obra), otros_costos: parseDecimal(v.otros_costos) }) : null;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{c.nombre}</td>
                    {(["costo_material", "mano_obra", "otros_costos"] as const).map((k) => (
                      <td key={k} className="py-2 pr-3"><Input inputMode="decimal" className="w-28" value={v?.[k] ?? ""} placeholder="0" onChange={(e) => set(c.id, k, e.target.value)} /></td>
                    ))}
                    <td className="py-2 text-right">{total == null ? <span className="text-xs text-muted-foreground">sin APU</span> : formatCLP(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
          {guardar.isPending ? "Guardando..." : "Guardar APU"}
        </Button>
      </Card>
    </div>
  );
}
