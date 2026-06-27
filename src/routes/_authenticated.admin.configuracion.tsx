import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { getConfig, updateConfig, listConfigAudit, limpiarDatosPrueba } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const q = queryOptions({ queryKey: ["config"], queryFn: () => getConfig() });
const qAudit = queryOptions({ queryKey: ["config-audit"], queryFn: () => listConfigAudit() });

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isSuperadmin) throw redirect({ to: "/admin" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ConfiguracionPage,
});

type FieldCfg = { label: string; visible: boolean; required: boolean };
type FormFields = { nombre: FieldCfg; telefono: FieldCfg; correo: FieldCfg; direccion: FieldCfg };
const DEFAULT_FIELDS: FormFields = {
  nombre: { label: "Nombre", visible: true, required: true },
  telefono: { label: "Teléfono", visible: true, required: true },
  correo: { label: "Correo", visible: true, required: true },
  direccion: { label: "Dirección", visible: true, required: true },
};

type FormState = {
  precio_m2: string;
  hero_titulo: string; hero_subtitulo: string;
  hero_h1_linea1: string; hero_h1_linea2: string; hero_h1_linea3: string;
  marca_texto: string; productos_titulo: string; cotizador_titulo: string;
  info_comercial: string;
  linktree_url: string; mapa_url: string; mapa_embed: string;
  telefono: string; direccion: string; instagram: string;
  logo_url: string; hero_url: string;
  form_fields: FormFields;
};

function ConfiguracionPage() {
  const qc = useQueryClient();
  const { data } = useQuery(q);
  const [form, setForm] = useState<FormState>({
    precio_m2: "7990",
    hero_titulo: "", hero_subtitulo: "",
    hero_h1_linea1: "", hero_h1_linea2: "", hero_h1_linea3: "",
    marca_texto: "", productos_titulo: "", cotizador_titulo: "",
    info_comercial: "",
    linktree_url: "", mapa_url: "", mapa_embed: "",
    telefono: "", direccion: "", instagram: "",
    logo_url: "", hero_url: "",
    form_fields: DEFAULT_FIELDS,
  });
  useEffect(() => {
    if (data) {
      const ff = (data.form_fields as Partial<FormFields> | null) ?? null;
      setForm({
        precio_m2: String(data.precio_m2),
        hero_titulo: data.hero_titulo, hero_subtitulo: data.hero_subtitulo,
        hero_h1_linea1: data.hero_h1_linea1, hero_h1_linea2: data.hero_h1_linea2, hero_h1_linea3: data.hero_h1_linea3,
        marca_texto: data.marca_texto, productos_titulo: data.productos_titulo, cotizador_titulo: data.cotizador_titulo,
        info_comercial: data.info_comercial,
        linktree_url: data.linktree_url, mapa_url: data.mapa_url, mapa_embed: data.mapa_embed,
        telefono: data.telefono, direccion: data.direccion, instagram: data.instagram,
        logo_url: data.logo_url ?? "", hero_url: data.hero_url ?? "",
        form_fields: {
          nombre: { ...DEFAULT_FIELDS.nombre, ...(ff?.nombre ?? {}) },
          telefono: { ...DEFAULT_FIELDS.telefono, ...(ff?.telefono ?? {}) },
          correo: { ...DEFAULT_FIELDS.correo, ...(ff?.correo ?? {}) },
          direccion: { ...DEFAULT_FIELDS.direccion, ...(ff?.direccion ?? {}) },
        },
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateConfig({ data: {
      ...form, precio_m2: Number(form.precio_m2),
      logo_url: form.logo_url || null, hero_url: form.hero_url || null,
    } }),
    onSuccess: () => {
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["public-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  type StrKey = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState];
  function f(k: StrKey) {
    return { value: form[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) };
  }
  function setField(k: keyof FormFields, patch: Partial<FieldCfg>) {
    setForm({ ...form, form_fields: { ...form.form_fields, [k]: { ...form.form_fields[k], ...patch } } });
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">CMS — CONFIGURACIÓN DEL SITIO</h1>
        <p className="text-sm text-muted-foreground">Edita textos e imágenes de la página pública. Solo el administrador general.</p>
      </div>

      {/* Textos del hero y secciones */}
      <Card className="p-6">
        <h2 className="mb-4 font-display text-2xl text-primary">CONTENIDO DE LA LANDING</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label>Título hero — línea 1</Label><Input {...f("hero_h1_linea1")} /></div>
          <div><Label>Título hero — línea 2</Label><Input {...f("hero_h1_linea2")} /></div>
          <div><Label>Título hero — línea 3 (acento)</Label><Input {...f("hero_h1_linea3")} /></div>
          <div className="md:col-span-3"><Label>Subtítulo hero (descripción corta)</Label><Textarea rows={2} {...f("hero_subtitulo")} /></div>
          <div><Label>Título sección productos</Label><Input {...f("productos_titulo")} /></div>
          <div><Label>Título sección cotizador</Label><Input {...f("cotizador_titulo")} /></div>
          <div><Label>Hero título (interno / SEO)</Label><Input {...f("hero_titulo")} /></div>
          <div className="md:col-span-3"><Label>Mensaje comercial (entrega)</Label><Textarea {...f("info_comercial")} /></div>
          <div className="md:col-span-3"><Label>Texto de marca (sección final)</Label><Textarea rows={2} {...f("marca_texto")} /></div>
        </div>
      </Card>

      {/* Imágenes */}
      <Card className="p-6">
        <h2 className="mb-4 font-display text-2xl text-primary">IMÁGENES</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ImageField label="Logo" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} folder="logos" />
          <ImageField label="Imagen Hero" value={form.hero_url} onChange={(v) => setForm({ ...form, hero_url: v })} folder="hero" />
        </div>
      </Card>

      {/* Datos de contacto y enlaces */}
      <Card className="grid gap-4 p-6 md:grid-cols-2">
        <h2 className="md:col-span-2 font-display text-2xl text-primary">CONTACTO Y ENLACES</h2>
        <div><Label>Precio por m² (CLP)</Label><Input type="number" {...f("precio_m2")} /></div>
        <div><Label>Teléfono</Label><Input {...f("telefono")} /></div>
        <div><Label>Dirección</Label><Input {...f("direccion")} /></div>
        <div><Label>Instagram</Label><Input {...f("instagram")} /></div>
        <div><Label>Linktree URL</Label><Input {...f("linktree_url")} /></div>
        <div><Label>Mapa (link)</Label><Input {...f("mapa_url")} /></div>
        <div className="md:col-span-2"><Label>Mapa (embed URL)</Label><Input {...f("mapa_embed")} /></div>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} variant="hero" size="lg" className="shadow-2xl">
          {save.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      <HerramientasPrueba />
      <AuditLogCard />
    </div>
  );
}

function ImageField({ label, value, onChange, folder }: { label: string; value: string; onChange: (v: string) => void; folder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Selecciona una imagen"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5 MB"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("web-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      // Bucket is private — use a long-lived signed URL (10 years)
      const { data: signed, error: sErr } = await supabase.storage.from("web-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("No se pudo firmar la URL");
      onChange(signed.signedUrl);
      toast.success("Imagen subida — recuerda guardar cambios");

    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
          {value ? <img src={value} alt={label} className="h-full w-full object-contain" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
        </div>
        <div className="flex-1 space-y-2">
          <Input placeholder="https://..." value={value} onChange={(e) => onChange(e.target.value)} />
          <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }} />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
              <Upload className="mr-1 h-4 w-4" /> {busy ? "Subiendo..." : "Subir nueva"}
            </Button>
            {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>Quitar</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HerramientasPrueba() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [opts, setOpts] = useState({ cotizaciones: true, boletas: true, egresos: true });
  const mut = useMutation({
    mutationFn: () => limpiarDatosPrueba({ data: { confirmacion: "CONFIRMAR", ...opts } }),
    onSuccess: (r) => {
      toast.success(`Limpieza completa: ${JSON.stringify(r)}`);
      setConfirm("");
      qc.invalidateQueries({ queryKey: ["cotizaciones"] });
      qc.invalidateQueries({ queryKey: ["boletas"] });
      qc.invalidateQueries({ queryKey: ["config-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ready = confirm === "CONFIRMAR" && (opts.cotizaciones || opts.boletas || opts.egresos);
  return (
    <Card className="border-destructive/40 p-6">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="font-display text-2xl text-destructive">HERRAMIENTAS DE PRUEBAS</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Limpia datos de demostración antes del lanzamiento. Esta acción es irreversible y queda registrada en el historial.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={opts.cotizaciones} onCheckedChange={(v) => setOpts({ ...opts, cotizaciones: v })} />
          Cotizaciones y pagos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={opts.boletas} onCheckedChange={(v) => setOpts({ ...opts, boletas: v })} />
          Boletas y archivos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={opts.egresos} onCheckedChange={(v) => setOpts({ ...opts, egresos: v })} />
          Solicitudes de egreso
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label>Escribe "CONFIRMAR" para habilitar</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="CONFIRMAR" />
        </div>
        <Button
          variant="destructive"
          disabled={!ready || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Limpiando..." : "Eliminar datos de prueba"}
        </Button>
      </div>
    </Card>
  );
}

function AuditLogCard() {
  const { data } = useQuery(qAudit);
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-primary">REGISTRO DE CAMBIOS</h2>
          <p className="text-xs text-muted-foreground">Últimas 100 modificaciones de configuración y colores</p>
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
            <tr><th className="py-2 pr-3">Fecha</th><th className="pr-3">Usuario</th><th className="pr-3">Entidad</th><th className="pr-3">Cambio</th><th className="pr-3">Antes</th><th>Después</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString("es-CL")}</td>
                <td className="pr-3">{r.user_email}</td>
                <td className="pr-3">{r.entidad}</td>
                <td className="pr-3">{r.cambio}</td>
                <td className="pr-3 max-w-[200px] truncate" title={r.valor_antes ?? ""}>{r.valor_antes ?? "—"}</td>
                <td className="max-w-[200px] truncate" title={r.valor_despues ?? ""}>{r.valor_despues ?? "—"}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sin cambios registrados aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
