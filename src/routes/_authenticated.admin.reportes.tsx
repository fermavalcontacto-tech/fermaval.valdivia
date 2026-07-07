import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { generateMonthlyExcel, listAuditLog } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reportes")({
  component: ReportesPage,
});

const now = new Date();

function ReportesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">REPORTES</h1>
        <p className="text-sm text-muted-foreground">Excel mensual y bitácora de auditoría</p>
      </div>
      <Tabs defaultValue="excel">
        <TabsList>
          <TabsTrigger value="excel">Excel mensual</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
        </TabsList>
        <TabsContent value="excel" className="pt-4"><ExcelSection /></TabsContent>
        <TabsContent value="audit" className="pt-4"><AuditSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function ExcelSection() {
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
        Incluye Ventas, Gastos aprobados y Resumen (ganancias, IVA, resultado).
      </p>
    </Card>
  );
}

const TABLAS = ["", "cotizaciones", "cotizacion_items", "pagos", "boletas", "colores", "producto_variantes", "stock_movimientos", "solicitudes_egreso", "configuracion_web", "user_roles"];

type AuditRow = {
  id: string; created_at: string; user_email: string | null; rol: string | null;
  accion: string; tabla: string; registro_id: string | null; payload: unknown;
};

function AuditSection() {
  const [tabla, setTabla] = useState("");
  const [accion, setAccion] = useState<"" | "INSERT" | "UPDATE" | "DELETE">("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<AuditRow[]>({
    queryKey: ["audit-log", tabla, accion, email],
    queryFn: () => listAuditLog({
      data: {
        tabla: tabla || undefined,
        accion: accion || undefined,
        email: email || undefined,
        limit: 200,
      },
    }) as unknown as Promise<AuditRow[]>,
  });

  const badge = (a: string) => a === "INSERT" ? "default" : a === "UPDATE" ? "secondary" : "destructive";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label>Tabla</Label>
            <Select value={tabla || "__all"} onValueChange={(v) => setTabla(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {TABLAS.filter(Boolean).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Acción</Label>
            <Select value={accion || "__all"} onValueChange={(v) => setAccion(v === "__all" ? "" : v as "INSERT" | "UPDATE" | "DELETE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@..." />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Cargando..." : "Refrescar"}
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="p-6 text-sm text-destructive">Error: {(error as Error).message}</Card>
      ) : isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Cargando bitácora...</Card>
      ) : (data ?? []).length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Sin registros con esos filtros.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((r) => (
                <FragmentRow key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} badge={badge} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function FragmentRow({ r, open, onToggle, badge }: {
  r: AuditRow;
  open: boolean;
  onToggle: () => void;
  badge: (a: string) => "default" | "secondary" | "destructive";
}) {
  return (
    <>
      <TableRow>
        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("es-CL")}</TableCell>
        <TableCell className="text-xs">{r.user_email ?? "—"}</TableCell>
        <TableCell className="text-xs">{r.rol ?? "—"}</TableCell>
        <TableCell><Badge variant={badge(r.accion)}>{r.accion}</Badge></TableCell>
        <TableCell className="text-xs font-mono">{r.tabla}</TableCell>
        <TableCell className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">{r.registro_id ?? "—"}</TableCell>
        <TableCell>
          <Button size="sm" variant="ghost" onClick={onToggle}>{open ? "Ocultar" : "Ver"}</Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px]">
              {JSON.stringify(r.payload, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
