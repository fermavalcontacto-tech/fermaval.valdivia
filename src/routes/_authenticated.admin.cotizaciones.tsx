import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCotizaciones, updateCotizacionEstado, createCotizacionManual,
  updateCotizacionFull, deleteCotizacion, getColores, PERSONAS_INTERNAS, TIPOS_PRODUCTO,
} from "@/lib/admin.functions";
import { sendCotizacionEmail } from "@/lib/email-cotizacion.functions";
import { pdfsForCotizacion, downloadCotizacionPDF, downloadPagoPDF, type CotizacionPDF } from "@/lib/cotizacion-pdf";
import { PdfPreviewDialog } from "@/components/admin/PdfPreviewDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCLP, formatDate, ESTADO_LABEL } from "@/lib/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
const VARIANT_STOCK_REGEX = /variante/i;
const toastErrorFiltered = (e: Error) => { if (VARIANT_STOCK_REGEX.test(e.message)) return; toast.error(e.message); };
import { ExternalLink, Plus, Pencil, Trash2, Download, Mail, MessageCircle } from "lucide-react";

type ColorOption = { id: string; nombre: string; hex: string; activo: boolean; stock_m: number };
type Tipo = typeof TIPOS_PRODUCTO[number];

export const Route = createFileRoute("/_authenticated/admin/cotizaciones")({
  component: CotizacionesPage,
});

const estados = ["cotizacion_creada","esperando_pago","pago_parcial","pedido_confirmado","pedido_terminado","rechazada"] as const;
type Estado = typeof estados[number];

const QUOTE_DIALOG_CLASS = "quote-mobile-force fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-xl border p-4 sm:w-[min(720px,calc(100vw-2rem))] sm:max-w-2xl sm:p-6";
const ALERT_DIALOG_CLASS = "quote-mobile-force fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-xl border p-4 sm:w-[min(560px,calc(100vw-2rem))] sm:max-w-lg sm:p-6";
const QUOTE_LEGAL_NOTICE = "Por razones de seguridad y cumplimiento legal, solo se despacharán productos en vehículos que cuenten con las dimensiones adecuadas para su traslado. El retiro de planchas debe cumplir la normativa chilena vigente (Decreto 158 MOP): la carga no puede sobresalir más de 2 metros de la carrocería.";

type Cotizacion = {
  id: string; numero: string; created_at: string;
  largo_m: number; ancho_m: number; cantidad_planchas: number; metros2: number; precio_m2: number;
  descuento: number; total: number; pago_recibido: number; saldo: number;
  color_nombre: string | null; estado: Estado; cliente_id: string;
  responsable_nombre?: string | null;
  cliente: { id?: string; nombre?: string; correo?: string; telefono?: string; direccion?: string } | null;
};

function CotizacionesPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cotizaciones"], queryFn: () => listCotizaciones() });
  const [editing, setEditing] = useState<Cotizacion | null>(null);
  const [preview, setPreview] = useState<{ data: CotizacionPDF; cot?: Cotizacion } | null>(null);
  const [enviarCorreoAuto, setEnviarCorreoAuto] = useState(true);

  function toPdfData(c: Cotizacion): CotizacionPDF {
    const its = ((c as { items?: Array<{ position: number; largo_m: number; ancho_m: number; cantidad_planchas: number; metros2: number; color_nombre?: string | null; tipo?: string | null; espesor_mm?: number | null }> }).items ?? [])
      .slice().sort((a, b) => a.position - b.position)
      .map((it) => ({
        largo_m: Number(it.largo_m), ancho_m: Number(it.ancho_m),
        cantidad_planchas: Number(it.cantidad_planchas),
        metros2: Number(it.metros2),
        color_nombre: it.color_nombre ?? null,
        tipo: it.tipo ?? "Ondulado",
        espesor_mm: Number(it.espesor_mm ?? 0.4),
      }));
    const origen = (c as { origen?: string }).origen ?? "cliente";
    return {
      numero: c.numero,
      fecha: c.created_at,
      cliente: {
        nombre: c.cliente?.nombre ?? "—",
        correo: c.cliente?.correo ?? "",
        telefono: c.cliente?.telefono ?? "—",
        direccion: c.cliente?.direccion ?? "—",
      },
      largo_m: c.largo_m, ancho_m: c.ancho_m, cantidad_planchas: c.cantidad_planchas, metros2: c.metros2,
      items: its,
      color_nombre: c.color_nombre, precio_m2: c.precio_m2,
      descuento: c.descuento ?? 0, total: c.total,
      pago_recibido: c.pago_recibido, saldo: c.saldo,
      estado: ESTADO_LABEL[c.estado] ?? c.estado,
      aprobador_nombre: auth.email?.split("@")[0] ?? "Administrador",
      aprobador_email: auth.email ?? "",
      aprobado_at: new Date().toISOString(),
      origen,
      creado_por_nombre: auth.email?.split("@")[0],
      creado_por_email: auth.email,
      responsable_nombre: c.responsable_nombre ?? null,
    };
  }

  function shareWhatsApp(c: Cotizacion) {
    const phone = (c.cliente?.telefono ?? "").replace(/[^\d]/g, "");
    const url = `${window.location.origin}/cotizacion/${c.numero}?t=${(c as { access_token?: string }).access_token ?? ""}`;
    const msg = `Hola ${c.cliente?.nombre ?? ""}, te comparto tu cotización FERMAVAL ${c.numero} por ${formatCLP(c.total)} (${c.metros2.toFixed(2)} m²). Detalles: ${url}`;
    const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, "_blank");
  }

  function shareWhatsAppFromPdf(p: CotizacionPDF) {
    const phone = (p.cliente.telefono ?? "").replace(/[^\d]/g, "");
    const msg = `Hola ${p.cliente.nombre}, te comparto tu cotización FERMAVAL ${p.numero} por ${formatCLP(p.total)} (${p.metros2.toFixed(2)} m²). Adjunto el PDF.`;
    const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, "_blank");
  }


  async function dispatchAprobacion(c: Cotizacion, sendEmail: boolean) {
    const pdfData = toPdfData(c);
    downloadCotizacionPDF(pdfData);
    downloadPagoPDF(pdfData);
    if (!sendEmail) {
      toast.info("Envío de correo desactivado — PDFs descargados.");
      return;
    }
    const correo = c.cliente?.correo;
    if (!correo) {
      toast.warning("Cliente sin correo: PDFs descargados, no se envió email.");
      return;
    }
    try {
      const { cotizacionBase64, pagoBase64 } = pdfsForCotizacion(pdfData);
      await sendCotizacionEmail({ data: {
        numero: c.numero, to: correo, cliente_nombre: pdfData.cliente.nombre,
        total: c.total, cotizacion_pdf_base64: cotizacionBase64, pago_pdf_base64: pagoBase64,
      }});
      toast.success(`Email enviado a ${correo}`);
    } catch (e) {
      toast.error(`Email no enviado: ${(e as Error).message}`);
    }
  }

  const mut = useMutation({
    mutationFn: (v: { id: string; estado: Estado; cot: Cotizacion }) =>
      updateCotizacionEstado({ data: { id: v.id, estado: v.estado } }).then(() => v),
    onSuccess: async (v) => {
      qc.invalidateQueries({ queryKey: ["cotizaciones"] });
      toast.success("Estado actualizado");
      if (v.estado === "pedido_confirmado") {
        await dispatchAprobacion({ ...v.cot, estado: v.estado }, enviarCorreoAuto);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteCotizacion({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cotizaciones"] }); toast.success("Cotización eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-primary md:text-4xl">COTIZACIONES</h1>
          <p className="text-sm text-muted-foreground">Gestiona todas las cotizaciones</p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium">
            <Switch checked={enviarCorreoAuto} onCheckedChange={setEnviarCorreoAuto} />
            <span className="leading-tight">Enviar correo al cliente al confirmar pedido</span>
          </label>
          <NuevaCotizacionDialog onCreated={() => qc.invalidateQueries({ queryKey: ["cotizaciones"] })} onPreview={(d) => setPreview({ data: d })} />
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">N°</th><th className="p-3">Cliente</th>
                <th className="p-3">Responsable</th>
                <th className="p-3">Origen</th><th className="p-3">Fecha</th>
                <th className="p-3">Total</th><th className="p-3">Pagado</th><th className="p-3">Saldo</th>
                <th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Cargando...</td></tr>}
              {((data ?? []) as Cotizacion[]).map((c) => {
                const cli = c.cliente as { nombre?: string } | null;
                const origen = (c as { origen?: string }).origen ?? "cliente";
                return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3 font-mono">{c.numero}</td>
                  <td className="p-3">{cli?.nombre ?? "—"}</td>
                  <td className="p-3 text-xs">{c.responsable_nombre ?? "—"}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${origen === "interno" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{origen}</span></td>
                  <td className="p-3">{formatDate(c.created_at)}</td>
                  <td className="p-3">{formatCLP(c.total)}</td>
                  <td className="p-3">{formatCLP(c.pago_recibido)}</td>
                  <td className="p-3 font-semibold">{formatCLP(c.saldo)}</td>
                  <td className="p-3">
                    <Select value={c.estado} onValueChange={(v) => mut.mutate({ id: c.id, estado: v as Estado, cot: c })}>
                      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{estados.map((s) => <SelectItem key={s} value={s}>{ESTADO_LABEL[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" title="Ver cotización pública">
                        <Link to="/cotizacion/$numero" params={{ numero: c.numero }} search={{ t: (c as { access_token?: string }).access_token }} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" title="Vista previa / Descargar PDF" onClick={() => setPreview({ data: toPdfData(c), cot: c })}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Compartir por WhatsApp" onClick={() => shareWhatsApp(c)}>
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </Button>
                      {(c.estado === "pedido_confirmado" || c.estado === "pedido_terminado") && (
                        <Button variant="ghost" size="sm" title="Descargar / reenviar comprobante" onClick={() => dispatchAprobacion(c, enviarCorreoAuto)}>
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      {auth.isSuperadmin && (
                        <>
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar cotización {c.numero}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará la cotización, pagos asociados y quedará registrada en el historial.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {!isLoading && (data ?? []).length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Sin cotizaciones aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {auth.isSuperadmin && (
        <EditarCotizacionDialog
          cot={editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["cotizaciones"] }); setEditing(null); }}
        />
      )}

      <PdfPreviewDialog
        data={preview?.data ?? null}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
        onShareWhatsApp={(d) => preview?.cot ? shareWhatsApp(preview.cot) : shareWhatsAppFromPdf(d)}
      />
    </div>
  );
}

type ItemForm = { largo: string; cantidad: string; color_id: string; tipo: Tipo };
type ItemErrors = { largo?: string; cantidad?: string; color_id?: string };
type FormErrors = {
  nombre?: string; telefono?: string; correo?: string; direccion?: string;
  precio_m2?: string; descuento?: string; pago_recibido?: string;
  responsable?: string; fecha_solicitud?: string;
  items?: ItemErrors[]; itemsGeneral?: string;
};

function calcItems(items: ItemForm[]) {
  return items.map((it) => {
    const l = Number(it.largo) || 0;
    const n = Number(it.cantidad) || 0;
    return { largo: l, cantidad: n, color_id: it.color_id, tipo: it.tipo, m2: Number((l * 1 * n).toFixed(2)) };
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9\s()-]{6,20}$/;

function validateCotizacion(
  form: { nombre: string; telefono: string; correo: string; direccion?: string; precio_m2: string; descuento?: string; pago_recibido?: string; responsable?: string; fecha_solicitud?: string },
  items: ItemForm[],
  opts: { requireResponsable?: boolean; requireFecha?: boolean; today?: string; allowFuture?: boolean } = {},
): { ok: boolean; errors: FormErrors } {
  const errors: FormErrors = {};
  const nombre = form.nombre.trim();
  if (!nombre) errors.nombre = "El nombre es obligatorio";
  else if (nombre.length > 100) errors.nombre = "Máximo 100 caracteres";
  const tel = form.telefono.trim();
  if (tel && !PHONE_RE.test(tel)) errors.telefono = "Teléfono inválido (6-20 dígitos)";
  const correo = form.correo.trim();
  if (correo) {
    if (correo.length > 255) errors.correo = "Máximo 255 caracteres";
    else if (!EMAIL_RE.test(correo)) errors.correo = "Correo inválido";
  }
  if ((form.direccion ?? "").length > 200) errors.direccion = "Máximo 200 caracteres";
  const precio = Number(form.precio_m2);
  if (!form.precio_m2 || Number.isNaN(precio) || precio <= 0) errors.precio_m2 = "Debe ser mayor a 0";
  else if (precio > 10_000_000) errors.precio_m2 = "Precio fuera de rango";
  if (form.descuento !== undefined && form.descuento !== "") {
    const d = Number(form.descuento);
    if (Number.isNaN(d) || d < 0) errors.descuento = "No puede ser negativo";
  }
  if (form.pago_recibido !== undefined && form.pago_recibido !== "") {
    const p = Number(form.pago_recibido);
    if (Number.isNaN(p) || p < 0) errors.pago_recibido = "No puede ser negativo";
  }
  if (opts.requireResponsable && !(form.responsable ?? "").trim()) errors.responsable = "Selecciona un responsable";
  if (opts.requireFecha) {
    if (!form.fecha_solicitud) errors.fecha_solicitud = "La fecha es obligatoria";
    else if (!opts.allowFuture && opts.today && form.fecha_solicitud > opts.today) errors.fecha_solicitud = "No puede ser futura";
  }
  if (!items.length) errors.itemsGeneral = "Agrega al menos una plancha";
  const itemErrs: ItemErrors[] = items.map((it) => {
    const e: ItemErrors = {};
    const l = Number(it.largo);
    if (!it.largo || Number.isNaN(l) || l <= 0) e.largo = "Largo > 0";
    else if (l > 50) e.largo = "Máximo 50 m";
    const n = Number(it.cantidad);
    if (!it.cantidad || !Number.isInteger(n) || n < 1) e.cantidad = "Mínimo 1";
    else if (n > 1000) e.cantidad = "Máximo 1000";
    if (!it.color_id) e.color_id = "Selecciona color";
    return e;
  });
  if (itemErrs.some((e) => Object.keys(e).length)) errors.items = itemErrs;
  return { ok: !Object.keys(errors).length, errors };
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive" role="alert">{msg}</p>;
}

function ItemsEditor({ items, setItems, colores, errors, generalError }: { items: ItemForm[]; setItems: (a: ItemForm[]) => void; colores: ColorOption[]; errors?: ItemErrors[]; generalError?: string }) {
  const calc = calcItems(items);
  const total = Number(calc.reduce((s, x) => s + x.m2, 0).toFixed(2));
  return (
    <div className="w-full min-w-0 space-y-3 col-span-2">
      <div className="space-y-1">
        <Label>Planchas (ancho 1 m · espesor fijo 0,4 mm)</Label>
        <p className="text-xs text-muted-foreground">Agrega cada medida en una línea independiente.</p>
      </div>
      {generalError && <p className="text-xs text-destructive" role="alert">{generalError}</p>}
      {items.map((it, i) => {
        const er = errors?.[i] ?? {};
        return (
        <div key={i} className="w-full min-w-0 space-y-3 overflow-hidden rounded-md border bg-muted/20 p-3">
          <div className="quote-mobile-grid grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_2.5rem] md:items-end">
            <div className="w-full min-w-0 space-y-1">
              <Label className="text-[10px]">Tipo</Label>
              <Select value={it.tipo} onValueChange={(v) => setItems(items.map((x, idx) => idx === i ? { ...x, tipo: v as Tipo } : x))}>
                <SelectTrigger className="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_PRODUCTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-full min-w-0 space-y-1">
              <Label className="text-[10px]">Largo (m) *</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={it.largo} aria-invalid={!!er.largo} className="w-full"
                onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, largo: e.target.value } : x))} />
              <FieldError msg={er.largo} />
            </div>
            <div className="w-full min-w-0 space-y-1">
              <Label className="text-[10px]">Cantidad *</Label>
              <Input type="number" inputMode="numeric" step="1" min="1" value={it.cantidad} aria-invalid={!!er.cantidad} className="w-full"
                onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, cantidad: e.target.value } : x))} />
              <FieldError msg={er.cantidad} />
            </div>
            <div className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-background px-3 py-2 md:block md:bg-transparent md:px-0 md:py-0">
              <div className="text-[10px] text-muted-foreground">m²</div>
              <div className="font-mono text-sm font-semibold">{calc[i].m2.toFixed(2)}</div>
              <Button type="button" variant="ghost" size="icon" disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, idx) => idx !== i))} title="Quitar" className="h-9 w-9 shrink-0 md:hidden">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <Button type="button" variant="ghost" size="icon" disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, idx) => idx !== i))} title="Quitar" className="hidden w-9 justify-self-end md:inline-flex">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="w-full min-w-0 space-y-1">
            <Label className="text-[10px]">Color *</Label>
            <Select value={it.color_id} onValueChange={(v) => setItems(items.map((x, idx) => idx === i ? { ...x, color_id: v } : x))}>
              <SelectTrigger className="h-9 w-full text-xs" aria-invalid={!!er.color_id}><SelectValue placeholder="Selecciona color" /></SelectTrigger>
              <SelectContent>
                {colores.filter((c) => c.activo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ background: c.hex }} />
                      {c.nombre}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError msg={er.color_id} />
          </div>
        </div>
      );})}
      <div className="flex w-full flex-col items-stretch justify-between gap-2 md:flex-row md:items-center">
        <Button type="button" variant="outline" size="sm" className="quote-mobile-button" onClick={() => setItems([...items, { largo: "", cantidad: "1", color_id: colores[0]?.id ?? "", tipo: "Ondulado" }])}>
          <Plus className="mr-1 h-4 w-4" /> Agregar otra plancha
        </Button>
        <div className="text-sm">Total m²: <span className="font-mono font-semibold">{total.toFixed(2)}</span></div>
      </div>
    </div>
  );
}

function EditarCotizacionDialog({
  cot, onOpenChange, onSaved,
}: { cot: (Cotizacion & { items?: Array<{ position: number; largo_m: number; cantidad_planchas: number; color_id?: string | null; tipo?: string | null }> }) | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { data: colores = [] } = useQuery({ queryKey: ["colores-admin"], queryFn: () => getColores() });
  const [form, setForm] = useState({
    nombre: "", telefono: "", correo: "", direccion: "",
    color: "", precio_m2: "0", responsable: "",
    descuento: "0", pago_recibido: "0", estado: "cotizacion_creada" as Estado,
  });
  const [items, setItems] = useState<ItemForm[]>([{ largo: "0", cantidad: "1", color_id: "", tipo: "Ondulado" }]);
  const [errors, setErrors] = useState<FormErrors>({});
  useEffect(() => {
    if (!cot) return;
    setForm({
      nombre: cot.cliente?.nombre ?? "", telefono: cot.cliente?.telefono ?? "",
      correo: cot.cliente?.correo ?? "", direccion: cot.cliente?.direccion ?? "",
      color: cot.color_nombre ?? "", precio_m2: String(cot.precio_m2),
      descuento: String(cot.descuento ?? 0), pago_recibido: String(cot.pago_recibido),
      estado: cot.estado,
      responsable: cot.responsable_nombre ?? "",
    });
    const its = (cot.items ?? []).slice().sort((a, b) => a.position - b.position);
    if (its.length) {
      setItems(its.map((it) => ({
        largo: String(it.largo_m), cantidad: String(it.cantidad_planchas),
        color_id: it.color_id ?? "", tipo: (it.tipo as Tipo) ?? "Ondulado",
      })));
    } else {
      setItems([{ largo: String(cot.largo_m), cantidad: String(cot.cantidad_planchas ?? 1), color_id: "", tipo: "Ondulado" }]);
    }
  }, [cot]);

  const itemsCalc = calcItems(items);
  const m2 = Number(itemsCalc.reduce((s, x) => s + x.m2, 0).toFixed(2));
  const total = Math.max(0, Math.round(m2 * Number(form.precio_m2) - Number(form.descuento)));
  const saldo = Math.max(0, total - Number(form.pago_recibido));

  const mut = useMutation({
    mutationFn: () => updateCotizacionFull({ data: {
      id: cot!.id,
      cliente: {
        id: cot!.cliente_id,
        nombre: form.nombre, telefono: form.telefono,
        correo: form.correo, direccion: form.direccion,
      },
      items: itemsCalc.map((it) => ({ largo_m: it.largo, cantidad_planchas: it.cantidad, color_id: it.color_id || null, tipo: it.tipo, espesor_mm: 0.4 })),
      color_nombre: form.color || null, precio_m2: Number(form.precio_m2),
      descuento: Number(form.descuento), pago_recibido: Number(form.pago_recibido),
      estado: form.estado,
      responsable_nombre: form.responsable || null,
    } }),
    onSuccess: () => { toast.success("Cotización actualizada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!cot} onOpenChange={onOpenChange}>
      <DialogContent className={QUOTE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Editar cotización {cot?.numero}</DialogTitle></DialogHeader>
        <div className="quote-mobile-grid grid w-full min-w-0 grid-cols-2 gap-3">
          <div className="w-full min-w-0 space-y-1"><Label>Nombre *</Label><Input className="w-full" value={form.nombre} aria-invalid={!!errors.nombre} onChange={(e)=>setForm({...form, nombre: e.target.value})} /><FieldError msg={errors.nombre} /></div>
          <div className="w-full min-w-0 space-y-1"><Label>Teléfono</Label><Input className="w-full" value={form.telefono} aria-invalid={!!errors.telefono} onChange={(e)=>setForm({...form, telefono: e.target.value})} /><FieldError msg={errors.telefono} /></div>
          <div className="w-full min-w-0 space-y-1"><Label>Correo</Label><Input className="w-full" type="email" value={form.correo} aria-invalid={!!errors.correo} onChange={(e)=>setForm({...form, correo: e.target.value})} /><FieldError msg={errors.correo} /></div>
          <div className="w-full min-w-0 space-y-1"><Label>Dirección</Label><Input className="w-full" value={form.direccion} aria-invalid={!!errors.direccion} onChange={(e)=>setForm({...form, direccion: e.target.value})} /><FieldError msg={errors.direccion} /></div>
          <ItemsEditor items={items} setItems={setItems} colores={colores as ColorOption[]} errors={errors.items} generalError={errors.itemsGeneral} />
          <div className="w-full min-w-0 space-y-1 col-span-2 md:col-span-1"><Label>Precio / m² *</Label><Input className="w-full" type="number" inputMode="numeric" value={form.precio_m2} aria-invalid={!!errors.precio_m2} onChange={(e)=>setForm({...form, precio_m2: e.target.value})} /><FieldError msg={errors.precio_m2} /></div>
          <div className="w-full min-w-0 space-y-1 col-span-2 md:col-span-1"><Label>Descuento (CLP)</Label><Input className="w-full" type="number" inputMode="numeric" value={form.descuento} aria-invalid={!!errors.descuento} onChange={(e)=>setForm({...form, descuento: e.target.value})} /><FieldError msg={errors.descuento} /></div>
          <div className="w-full min-w-0 space-y-1 col-span-2 md:col-span-1"><Label>Pago recibido (CLP)</Label><Input className="w-full" type="number" inputMode="numeric" value={form.pago_recibido} aria-invalid={!!errors.pago_recibido} onChange={(e)=>setForm({...form, pago_recibido: e.target.value})} /><FieldError msg={errors.pago_recibido} /></div>
          <div className="w-full min-w-0 space-y-1 col-span-2">
            <Label>Responsable interno</Label>
            <Select value={form.responsable} onValueChange={(v) => setForm({ ...form, responsable: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona responsable" /></SelectTrigger>
              <SelectContent>{PERSONAS_INTERNAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1 col-span-2">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => setForm({...form, estado: v as Estado})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{estados.map((s) => <SelectItem key={s} value={s}>{ESTADO_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 rounded-md border bg-muted/30 p-3 text-sm col-span-2">
            <div className="flex justify-between"><span>Total m²:</span><span className="font-mono">{m2.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total:</span><span className="font-mono font-semibold">{formatCLP(total)}</span></div>
            <div className="flex justify-between"><span>Saldo:</span><span className="font-mono font-semibold">{formatCLP(saldo)}</span></div>
          </div>
        </div>
        <DialogFooter className="w-full gap-2">
          <Button className="quote-mobile-button" onClick={() => {
            const v = validateCotizacion(form, items);
            setErrors(v.errors);
            if (!v.ok) { toast.error("Revisa los campos marcados"); return; }
            mut.mutate();
          }} disabled={mut.isPending} variant="hero">{mut.isPending ? "Guardando..." : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaCotizacionDialog({ onCreated, onPreview }: { onCreated: () => void; onPreview: (d: CotizacionPDF) => void }) {
  const { auth } = Route.useRouteContext();
  const isSuper = auth.isSuperadmin;
  const today = new Date().toISOString().slice(0,10);
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [form, setForm] = useState({
    nombre: "", telefono: "", correo: "", direccion: "", color: "",
    precio_m2: "7990", fecha_solicitud: today,
    responsable: PERSONAS_INTERNAS[0] as string,
  });
  const { data: colores = [] } = useQuery({ queryKey: ["colores-admin"], queryFn: () => getColores() });
  const [items, setItems] = useState<ItemForm[]>([{ largo: "", cantidad: "1", color_id: "", tipo: "Ondulado" }]);
  const [errors, setErrors] = useState<FormErrors>({});
  useEffect(() => {
    if (open && colores.length && !items[0]?.color_id) {
      setItems([{ largo: "", cantidad: "1", color_id: (colores[0] as ColorOption).id, tipo: "Ondulado" }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, colores.length]);
  const itemsCalc = calcItems(items);
  const m2Total = Number(itemsCalc.reduce((s, x) => s + x.m2, 0).toFixed(2));
  const totalCalc = Math.max(0, Math.round(m2Total * (Number(form.precio_m2) || 0)));
  const mut = useMutation({
    mutationFn: () => createCotizacionManual({ data: {
      cliente: { nombre: form.nombre, telefono: form.telefono, correo: form.correo, direccion: form.direccion },
      items: itemsCalc.map((it) => ({ largo_m: it.largo, cantidad_planchas: it.cantidad, color_id: it.color_id || null, tipo: it.tipo, espesor_mm: 0.4 })),
      color_nombre: form.color || null, precio_m2: Number(form.precio_m2),
      fecha_solicitud: isSuper ? form.fecha_solicitud : today,
      responsable_nombre: form.responsable,
    }}),
    onSuccess: (r) => {
      toast.success(`Creada ${r.numero} — abriendo vista previa...`);
      const its = itemsCalc.map((it) => {
        const col = (colores as ColorOption[]).find((c) => c.id === it.color_id);
        return { largo_m: it.largo, ancho_m: 1, cantidad_planchas: it.cantidad, metros2: it.m2, color_nombre: col?.nombre ?? null, tipo: it.tipo, espesor_mm: 0.4 };
      });
      const first = its[0] ?? { largo_m: 0, ancho_m: 1, cantidad_planchas: 0, metros2: 0, color_nombre: null, tipo: "Ondulado", espesor_mm: 0.4 };
      const pdfData: CotizacionPDF = {
        numero: r.numero,
        fecha: new Date().toISOString(),
        cliente: { nombre: form.nombre, correo: form.correo, telefono: form.telefono, direccion: form.direccion },
        largo_m: first.largo_m, ancho_m: 1, cantidad_planchas: first.cantidad_planchas, metros2: m2Total,
        items: its,
        color_nombre: form.color || null,
        precio_m2: Number(form.precio_m2),
        descuento: 0, total: totalCalc, pago_recibido: 0, saldo: totalCalc,
        estado: "Cotización creada",
        aprobador_nombre: form.responsable,
        aprobador_email: auth.email ?? "",
        aprobado_at: new Date().toISOString(),
        origen: "interno",
        creado_por_nombre: form.responsable,
        creado_por_email: auth.email,
        responsable_nombre: form.responsable,
      };
      onPreview(pdfData);
      onCreated();
      setOpen(false);
      setReviewing(false);
      setItems([{ largo: "", cantidad: "1", color_id: (colores[0] as ColorOption)?.id ?? "", tipo: "Ondulado" }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) setReviewing(false);
  }

  const itemsPreview = itemsCalc.map((it) => {
    const col = (colores as ColorOption[]).find((c) => c.id === it.color_id);
    return { ...it, color_nombre: col?.nombre ?? "—", color_hex: col?.hex ?? "#ccc" };
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild><Button variant="hero" className="w-full md:w-auto"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
      <DialogContent className={QUOTE_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle>{reviewing ? "Vista previa — confirma antes de guardar" : "Nueva cotización (interna)"}</DialogTitle>
        </DialogHeader>

        {!reviewing && (
          <>
            <div className="quote-mobile-grid grid w-full min-w-0 grid-cols-2 gap-3">
              <div className="w-full min-w-0 space-y-1"><Label>Nombre *</Label><Input className="w-full" value={form.nombre} aria-invalid={!!errors.nombre} onChange={(e)=>setForm({...form, nombre: e.target.value})} /><FieldError msg={errors.nombre} /></div>
              <div className="w-full min-w-0 space-y-1"><Label>Teléfono</Label><Input className="w-full" value={form.telefono} aria-invalid={!!errors.telefono} onChange={(e)=>setForm({...form, telefono: e.target.value})} /><FieldError msg={errors.telefono} /></div>
              <div className="w-full min-w-0 space-y-1"><Label>Correo</Label><Input className="w-full" type="email" value={form.correo} aria-invalid={!!errors.correo} onChange={(e)=>setForm({...form, correo: e.target.value})} /><FieldError msg={errors.correo} /></div>
              <div className="w-full min-w-0 space-y-1"><Label>Dirección</Label><Input className="w-full" value={form.direccion} aria-invalid={!!errors.direccion} onChange={(e)=>setForm({...form, direccion: e.target.value})} /><FieldError msg={errors.direccion} /></div>
              <ItemsEditor items={items} setItems={setItems} colores={colores as ColorOption[]} errors={errors.items} generalError={errors.itemsGeneral} />
              <div className="w-full min-w-0 space-y-1 col-span-2 md:col-span-1"><Label>Precio / m² *</Label><Input className="w-full" type="number" inputMode="numeric" value={form.precio_m2} aria-invalid={!!errors.precio_m2} onChange={(e)=>setForm({...form, precio_m2: e.target.value})} /><FieldError msg={errors.precio_m2} /></div>
              <div className="w-full min-w-0 space-y-1 col-span-2">
                <Label>Responsable interno (aparece en el PDF y el panel) *</Label>
                <Select value={form.responsable} onValueChange={(v) => setForm({ ...form, responsable: v })}>
                  <SelectTrigger aria-invalid={!!errors.responsable}><SelectValue /></SelectTrigger>
                  <SelectContent>{PERSONAS_INTERNAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError msg={errors.responsable} />
              </div>
              <div className="w-full min-w-0 space-y-1 col-span-2">
                <Label>Fecha de la solicitud * {isSuper && <span className="text-xs text-muted-foreground">(puede ser anterior)</span>}</Label>
                <Input type="date" value={form.fecha_solicitud}
                  max={isSuper ? undefined : today}
                  disabled={!isSuper}
                  aria-invalid={!!errors.fecha_solicitud}
                  onChange={(e)=>setForm({...form, fecha_solicitud: e.target.value})} />
                <FieldError msg={errors.fecha_solicitud} />
                {!isSuper && <p className="mt-1 text-[10px] text-muted-foreground">Solo el Administrador General puede registrar fechas pasadas para archivar correctamente meses anteriores.</p>}
              </div>
              <div className="quote-legal-notice w-full min-w-0 rounded-md p-3 text-xs font-medium text-foreground col-span-2">
                📌 {QUOTE_LEGAL_NOTICE}
              </div>
            </div>
            <DialogFooter className="w-full gap-2">
              <Button className="quote-mobile-button" onClick={() => {
                const v = validateCotizacion(form, items, { requireResponsable: true, requireFecha: true, today, allowFuture: isSuper });
                setErrors(v.errors);
                if (!v.ok) { toast.error("Revisa los campos marcados"); return; }
                setReviewing(true);
              }} variant="hero">Crear</Button>
            </DialogFooter>
          </>
        )}

        {reviewing && (
          <>
            <div className="w-full min-w-0 space-y-4 text-sm">
              <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Revisa los datos antes de confirmar. Si algo no está correcto, vuelve al formulario.
              </div>

              <section className="rounded-md border p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h4>
                <div className="quote-mobile-grid grid w-full min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
                  <div><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{form.nombre || "—"}</span></div>
                  <div><span className="text-muted-foreground">Teléfono:</span> {form.telefono || "—"}</div>
                  <div><span className="text-muted-foreground">Correo:</span> {form.correo || "—"}</div>
                  <div><span className="text-muted-foreground">Dirección:</span> {form.direccion || "—"}</div>
                </div>
              </section>

              <section className="rounded-md border p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planchas</h4>
                <div className="grid w-full min-w-0 grid-cols-1 gap-2">
                  {itemsPreview.map((it, i) => (
                    <div key={i} className="grid w-full min-w-0 grid-cols-2 gap-2 rounded-md bg-muted/30 p-2 text-xs">
                      <div className="col-span-2 font-semibold">#{i + 1} · {it.tipo}</div>
                      <div className="col-span-2 inline-flex min-w-0 items-center gap-1"><span className="h-3 w-3 shrink-0 rounded" style={{ background: it.color_hex }} /><span className="truncate">{it.color_nombre}</span></div>
                      <div><span className="text-muted-foreground">Largo:</span> <span className="font-mono">{it.largo.toFixed(2)} m</span></div>
                      <div><span className="text-muted-foreground">Cant.:</span> <span className="font-mono">{it.cantidad}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">m²:</span> <span className="font-mono font-semibold">{it.m2.toFixed(2)}</span></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="quote-legal-notice rounded-md p-3 text-xs font-medium text-foreground">
                📌 {QUOTE_LEGAL_NOTICE}
              </section>

              <section className="rounded-md border bg-muted/30 p-3">
                <div className="flex justify-between"><span>Total m²:</span><span className="font-mono font-semibold">{m2Total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Precio / m²:</span><span className="font-mono">{formatCLP(Number(form.precio_m2) || 0)}</span></div>
                <div className="flex justify-between text-base"><span className="font-semibold">Total:</span><span className="font-mono font-bold">{formatCLP(totalCalc)}</span></div>
              </section>

              <section className="quote-mobile-grid grid gap-2 rounded-md border p-3 md:grid-cols-2">
                <div><span className="text-muted-foreground">Responsable:</span> <span className="font-medium">{form.responsable}</span></div>
                <div><span className="text-muted-foreground">Fecha solicitud:</span> {form.fecha_solicitud}</div>
              </section>

              <p className="text-[11px] text-muted-foreground">
                Al confirmar se registrará la cotización, se descontará stock cuando corresponda según el estado de pago y se gatillará el envío de correos asociado.
              </p>
            </div>
            <DialogFooter className="w-full flex-col gap-2 sm:flex-row">
              <Button className="quote-mobile-button" variant="outline" onClick={() => setReviewing(false)} disabled={mut.isPending}>← Modificar / Volver</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="quote-mobile-button" variant="hero" disabled={mut.isPending}>{mut.isPending ? "Guardando..." : "Confirmar y Guardar"}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className={ALERT_DIALOG_CLASS}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar guardado e impacto en stock</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm">
                        <div className="rounded-md border bg-muted/40 p-2 text-xs">
                          <div><span className="text-muted-foreground">Estado inicial:</span> <span className="font-medium">Cotización creada</span></div>
                          <div><span className="text-muted-foreground">Estado de pago:</span> <span className="font-medium">Pendiente</span></div>
                        </div>
                        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-2 text-xs text-amber-900 dark:text-amber-200">
                          <strong>No se descontará stock todavía.</strong> El inventario solo se descuenta cuando la cotización pase a <em>Aceptada</em> con pago <em>Pagada Parcial</em> o <em>Pagada Completa</em>. Si se cancela o elimina, las planchas vuelven al stock.
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planchas que se reservarán para descuento futuro</div>
                          <div className="grid gap-2 text-xs">
                            {itemsPreview.map((it, i) => (
                              <div key={i} className="rounded-md border bg-background p-2">
                                <div className="font-medium">{it.tipo} · {it.color_nombre} · 0,4mm</div>
                                <div className="mt-1 flex justify-between gap-2"><span>Cantidad</span><span className="font-mono">{it.cantidad}</span></div>
                                <div className="flex justify-between gap-2"><span>m a descontar</span><span className="font-mono">{(it.largo * it.cantidad).toFixed(2)}</span></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); mut.mutate(); }} disabled={mut.isPending}>{mut.isPending ? "Guardando..." : "Sí, guardar"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
