import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Layers, AlertTriangle } from "lucide-react";
import {
  listBobinas, createBobina, deleteBobina, listPerdidas, getColores,
  fetchPreciosPorTipoAdmin,
} from "@/lib/admin.functions";
import {
  DECIMAL_INPUT_PROPS, sanitizeDecimalInput, parseDecimal,
  metrosUtiles, perdidaBobina, costoM2Bobina, margenM2, formatPct,
  friendlyValidationMessage, MERMA_BOBINA,
} from "@/lib/domain/quotes.core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/bobinas")({
  component: BobinasPage,
  head: () => ({
    meta: [
      { title: "Bobinas y proveedores | FERMAVAL" },
      { name: "description", content: "Control de bobinas de acero prepintado por proveedor, saldo FIFO, costo por m² y mermas." },
      { property: "og:title", content: "Bobinas y proveedores | FERMAVAL" },
      { property: "og:description", content: "Control de bobinas por proveedor, saldo FIFO, costo por m² y mermas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const clp = (n: number) => n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const m = (n: number) => `${Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 })} m`;

function BobinasPage() {
  const qc = useQueryClient();
  const bobinas = useQuery({ queryKey: ["bobinas"], queryFn: () => listBobinas() });
  const perdidas = useQuery({ queryKey: ["perdidas-m2"], queryFn: () => listPerdidas() });
  const colores = useQuery({ queryKey: ["colores-admin"], queryFn: () => getColores() });
  const precios = useQuery({ queryKey: ["precios-tipo"], queryFn: () => fetchPreciosPorTipoAdmin() });

  const del = useMutation({
    mutationFn: (id: string) => deleteBobina({ data: { id } }),
    onSuccess: () => {
      toast.success("Bobina eliminada");
      qc.invalidateQueries({ queryKey: ["bobinas"] });
      qc.invalidateQueries({ queryKey: ["colores-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = bobinas.data ?? [];
  const totalSaldo = rows.reduce((s, b) => s + Number(b.saldo_m), 0);
  const totalPerdida = rows.reduce((s, b) => s + Number(b.metros_perdida), 0);
  const totalInvertido = rows.reduce((s, b) => s + Number(b.valor_total), 0);
  const precioRef = Math.max(0, ...Object.values(precios.data ?? {}).map((v) => Number(v) || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">BOBINAS Y PROVEEDORES</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cada bobina ingresa con el 99% de sus metros como útiles (ancho útil 1 m, así 1 metro lineal = 1 m²);
            el {Math.round(MERMA_BOBINA * 100)}% restante se registra como pérdida. El consumo es por antigüedad:
            se descuenta primero la bobina más antigua del color.
          </p>
        </div>
        <NuevaBobinaDialog colores={colores.data ?? []} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["bobinas"] });
          qc.invalidateQueries({ queryKey: ["perdidas-m2"] });
          qc.invalidateQueries({ queryKey: ["colores-admin"] });
        }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Saldo total en bobinas</p>
          <p className="mt-1 text-2xl font-semibold">{m(totalSaldo)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">m² de pérdida acumulada</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">{Number(totalPerdida).toFixed(2)} m²</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Invertido en bobinas</p>
          <p className="mt-1 text-2xl font-semibold">{clp(totalInvertido)} <span className="text-xs font-normal text-muted-foreground">neto</span></p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Ingreso</th>
              <th className="p-3">Proveedor</th>
              <th className="p-3">Color</th>
              <th className="p-3">Comprados</th>
              <th className="p-3">Útiles (99%)</th>
              <th className="p-3">Pérdida (1%)</th>
              <th className="p-3">Saldo</th>
              <th className="p-3">Costo / m² neto</th>
              <th className="p-3">Ganancia / m²</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">
                Aún no hay bobinas registradas. Créalas aquí o aprueba un egreso con metros de bobina.
              </td></tr>
            )}
            {rows.map((b) => {
              const margen = precioRef > 0 ? margenM2(precioRef, Number(b.costo_m2)) : null;
              const sinSaldo = Number(b.saldo_m) <= 0;
              return (
                <tr key={b.id} className={`border-t ${sinSaldo ? "opacity-60" : ""}`}>
                  <td className="p-3 whitespace-nowrap">{b.fecha_ingreso}</td>
                  <td className="p-3 font-medium">{b.proveedor}</td>
                  <td className="p-3">{b.color_nombre ?? "—"}</td>
                  <td className="p-3">{m(Number(b.metros_comprados))}</td>
                  <td className="p-3">{m(Number(b.metros_utiles))}</td>
                  <td className="p-3 text-destructive">{m(Number(b.metros_perdida))}</td>
                  <td className={`p-3 font-semibold ${sinSaldo ? "text-destructive" : ""}`}>{m(Number(b.saldo_m))}</td>
                  <td className="p-3">{clp(Number(b.costo_m2))} neto</td>
                  <td className="p-3">
                    {margen ? <>{clp(margen.ganancia)} <span className="text-muted-foreground">({formatPct(margen.pct)})</span></> : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (confirm(`¿Eliminar la bobina de ${b.proveedor}?`)) del.mutate(b.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-display text-2xl text-primary">
          <AlertTriangle className="h-5 w-5" /> M² DE PÉRDIDA POR MES
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Periodo</th>
                <th className="p-2">Color</th>
                <th className="p-2">Proveedor</th>
                <th className="p-2">m² de pérdida</th>
                <th className="p-2">Costo de la pérdida</th>
              </tr>
            </thead>
            <tbody>
              {(perdidas.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sin pérdidas registradas.</td></tr>
              )}
              {(perdidas.data ?? []).map((p, i) => (
                <tr key={`${p.periodo}-${i}`} className="border-t">
                  <td className="p-2">{p.periodo.slice(0, 7)}</td>
                  <td className="p-2">{p.color_nombre ?? "—"}</td>
                  <td className="p-2">{p.proveedor ?? "—"}</td>
                  <td className="p-2 text-destructive">{p.m2_perdida.toFixed(2)} m²</td>
                  <td className="p-2">{clp(p.costo_perdida)} neto</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NuevaBobinaDialog({ colores, onSaved }: { colores: Array<{ id: string; nombre: string }>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [proveedor, setProveedor] = useState("");
  const [colorId, setColorId] = useState("");
  const [metros, setMetros] = useState("");
  const [valor, setValor] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");

  const metrosNum = parseDecimal(metros, 0);
  const valorNum = parseDecimal(valor, 0);

  const save = useMutation({
    mutationFn: () => createBobina({
      data: {
        proveedor: proveedor.trim(),
        color_id: colorId,
        metros_comprados: metrosNum,
        valor_total: valorNum,
        fecha_ingreso: fecha,
        nota: nota.trim() || null,
      },
    }),
    onSuccess: () => {
      toast.success("Bobina registrada y sumada al stock");
      setOpen(false);
      setProveedor(""); setColorId(""); setMetros(""); setValor(""); setNota("");
      onSaved();
    },
    onError: (e: Error) => toast.error(friendlyValidationMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero"><Plus className="mr-1 h-4 w-4" /> Nueva bobina</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Registrar bobina comprada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Proveedor</Label>
            <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej: Acesco" />
          </div>
          <div>
            <Label>Color de la bobina</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={colorId}
              onChange={(e) => setColorId(e.target.value)}
            >
              <option value="">Selecciona un color…</option>
              {colores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Metros comprados</Label>
              <Input
                {...DECIMAL_INPUT_PROPS}
                value={metros}
                onChange={(e) => setMetros(sanitizeDecimalInput(e.target.value))}
                placeholder="Ej: 1000"
              />
            </div>
            <div>
              <Label>Valor pagado (neto)</Label>
              <Input
                {...DECIMAL_INPUT_PROPS}
                value={valor}
                onChange={(e) => setValor(sanitizeDecimalInput(e.target.value))}
                placeholder="Ej: 3500000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="N° guía, observación…" />
            </div>
          </div>
          {metrosNum > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p>Metros útiles (99%): <strong>{m(metrosUtiles(metrosNum))}</strong></p>
              <p className="text-destructive">Pérdida (1%): <strong>{perdidaBobina(metrosNum).toFixed(2)} m² </strong></p>
              <p>Costo por m² neto: <strong>{clp(costoM2Bobina(valorNum, metrosNum))}</strong></p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="hero"
            disabled={save.isPending || !proveedor.trim() || !colorId || metrosNum <= 0}
            onClick={() => save.mutate()}
          >
            Guardar bobina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
