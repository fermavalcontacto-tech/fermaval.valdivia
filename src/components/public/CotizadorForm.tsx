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

type Color = { id: string; nombre: string; hex: string; imagen_url: string | null };

export function CotizadorForm({ precio, colores }: { precio: number; colores: Color[] }) {
  const navigate = useNavigate();
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [colorId, setColorId] = useState<string>(colores[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");

  const m2 = useMemo(() => {
    const l = Number(largo); const a = Number(ancho);
    if (!l || !a) return 0;
    return Number((l * a).toFixed(2));
  }, [largo, ancho]);
  const total = Math.round(m2 * precio);

  const mut = useMutation({
    mutationFn: () => createPublicQuote({
      data: {
        largo_m: Number(largo),
        ancho_m: Number(ancho),
        color_id: colorId || null,
        cliente: { nombre, telefono, correo, direccion },
      },
    }),
    onSuccess: (r) => {
      toast.success(`Cotización ${r.numero} generada`);
      navigate({ to: "/cotizacion/$numero", params: { numero: r.numero } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (m2 <= 0) { toast.error("Ingresa largo y ancho válidos"); return; }
    if (!nombre || !telefono || !correo || !direccion) { toast.error("Completa todos tus datos"); return; }
    mut.mutate();
  }

  return (
    <Card className="border-2 border-border bg-card p-6 md:p-8 shadow-xl">
      <form onSubmit={submit} className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="largo">Largo (m)</Label>
            <Input id="largo" type="number" step="0.01" min="0" value={largo} onChange={(e) => setLargo(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label htmlFor="ancho">Ancho (m)</Label>
            <Input id="ancho" type="number" step="0.01" min="0" value={ancho} onChange={(e) => setAncho(e.target.value)} placeholder="0,00" />
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Metros cuadrados</div>
            <div className="font-display text-3xl text-primary">{m2.toFixed(2)} m²</div>
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
            <div className="text-xs text-muted-foreground">{m2.toFixed(2)} m² × {formatCLP(precio)} / m²</div>
          </div>
          <Button type="submit" variant="hero" size="lg" disabled={mut.isPending}>
            {mut.isPending ? "Generando..." : "Generar cotización"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
