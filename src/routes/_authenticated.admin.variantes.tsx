import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProductoVariantes, adjustVarianteStock, TIPOS_PRODUCTO } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/variantes")({
  component: VariantesPage,
});

type Variante = {
  id: string;
  tipo: string;
  color_id: string;
  espesor_mm: number;
  activo: boolean;
  fabricado_m: number;
  materia_prima_m: number;
  stock_m: number;
  color: { nombre: string; hex: string } | null;
};

function VariantesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<Variante[]>({
    queryKey: ["producto-variantes"],
    queryFn: () => listProductoVariantes() as unknown as Promise<Variante[]>,
  });
  const [adjust, setAdjust] = useState<{ v: Variante; sign: 1 | -1 } | null>(null);

  // Agrupar por color: una fila por color con materia prima + contadores por tipo
  const byColor = useMemo(() => {
    const map = new Map<string, { color: { nombre: string; hex: string }; materia: number; sample: Variante; rows: Record<string, Variante> }>();
    for (const v of data ?? []) {
      const key = v.color_id;
      if (!map.has(key)) {
        map.set(key, {
          color: v.color ?? { nombre: "—", hex: "#999" },
          materia: Number(v.materia_prima_m ?? v.stock_m ?? 0),
          sample: v,
          rows: {},
        });
      }
      map.get(key)!.rows[v.tipo] = v;
    }
    return Array.from(map.entries()).sort((a, b) => a[1].color.nombre.localeCompare(b[1].color.nombre));
  }, [data]);

  const totalMateriaPrima = byColor.reduce((acc, [, v]) => acc + Number(v.materia), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">VARIANTES DE PRODUCTO</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            La <strong>Materia Prima Disponible</strong> es la bobina de acero por color (inicia en 1400 m). Las columnas por tipo de plancha son <strong>contadores acumulados de fabricación</strong>: se inicializan en 0 m y suman los metros confirmados en cada cotización pagada (ese mismo monto se descuenta de la materia prima del color).
          </p>
        </div>
        <Card className="px-4 py-2 text-right">
          <div className="text-[10px] uppercase text-muted-foreground">Materia prima total disponible</div>
          <div className="font-display text-2xl text-primary">{totalMateriaPrima.toFixed(2)} m</div>
        </Card>
      </div>

      {error ? (
        <Card className="p-6 text-sm text-destructive">Error al cargar la matriz: {(error as Error).message}</Card>
      ) : isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Cargando matriz...</Card>
      ) : byColor.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No hay variantes aún. Crea un color en "Colores y Stock" y se generarán automáticamente las combinaciones con cada tipo de producto.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Color</TableHead>
                <TableHead className="min-w-[200px] bg-primary/5 text-primary">Materia Prima Disponible</TableHead>
                {TIPOS_PRODUCTO.map((t) => (
                  <TableHead key={t} className="text-center min-w-[120px]">{t}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {byColor.map(([cid, { color, materia, sample, rows }]) => {
                const low = materia <= 0;
                return (
                  <TableRow key={cid}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded-sm border" style={{ background: color.hex }} />
                        <span className="font-medium">{color.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="bg-primary/5">
                      <div className={`font-display text-xl ${low ? "text-destructive" : "text-primary"}`}>
                        {materia.toFixed(2)} <span className="text-[10px]">m</span>
                      </div>
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setAdjust({ v: sample, sign: 1 })}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setAdjust({ v: sample, sign: -1 })}>
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    {TIPOS_PRODUCTO.map((t) => {
                      const v = rows[t];
                      if (!v) {
                        return <TableCell key={t} className="text-center text-xs text-muted-foreground">—</TableCell>;
                      }
                      const fab = Number(v.fabricado_m ?? 0);
                      return (
                        <TableCell key={t} className="text-center">
                          <div className="text-[10px] uppercase text-muted-foreground">Fabricado</div>
                          <div className={`font-display text-lg ${fab > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {fab.toFixed(2)} <span className="text-[10px]">m</span>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {adjust && (
        <AdjustDialog
          variante={adjust.v}
          sign={adjust.sign}
          onClose={() => setAdjust(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["producto-variantes"] });
            qc.invalidateQueries({ queryKey: ["stock-movs"] });
            qc.invalidateQueries({ queryKey: ["colores-admin"] });
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({ variante, sign, onClose, onSaved }: { variante: Variante; sign: 1 | -1; onClose: () => void; onSaved: () => void }) {
  const [metros, setMetros] = useState("");
  const [motivo, setMotivo] = useState(sign > 0 ? "Reposición de bobina" : "Ajuste manual");

  const mut = useMutation({
    mutationFn: () => adjustVarianteStock({
      data: { variante_id: variante.id, delta_m: sign * Number(metros), motivo: motivo.trim() },
    }),
    onSuccess: () => {
      toast.success(sign > 0 ? "Materia prima agregada" : "Materia prima descontada");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {sign > 0 ? "Agregar" : "Descontar"} materia prima · {variante.color?.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <div><strong>Color:</strong> {variante.color?.nombre}</div>
            <div><strong>Materia prima actual:</strong> {Number(variante.materia_prima_m ?? variante.stock_m).toFixed(2)} m</div>
          </div>
          <div>
            <Label>Metros a {sign > 0 ? "agregar" : "descontar"}</Label>
            <Input type="number" step="0.01" min="0" value={metros} onChange={(e) => setMetros(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={sign > 0 ? "hero" : "destructive"}
            disabled={!metros || Number(metros) <= 0 || motivo.trim().length < 2 || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "Guardando..." : sign > 0 ? "Agregar" : "Descontar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
