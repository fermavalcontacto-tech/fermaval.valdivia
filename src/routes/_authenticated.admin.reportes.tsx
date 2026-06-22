import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { generateMonthlyExcel } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reportes")({
  component: ReportesPage,
});

const now = new Date();

function ReportesPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const mut = useMutation({
    mutationFn: () => generateMonthlyExcel({ data: { year, month } }),
    onSuccess: (r) => {
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Reporte generado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">REPORTES</h1>
        <p className="text-sm text-muted-foreground">Exporta tu información mensual a Excel</p>
      </div>
      <Card className="max-w-md p-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mes</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{meses.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Año</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="hero" className="mt-4 w-full">
          <Download className="mr-1 h-4 w-4" />
          {mut.isPending ? "Generando..." : "Descargar Excel"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          El archivo incluye: Ventas (con N°, cliente, total, pagado, saldo), Gastos aprobados y un Resumen (ganancias, utilidades, IVA, resultado final).
        </p>
      </Card>
    </div>
  );
}
