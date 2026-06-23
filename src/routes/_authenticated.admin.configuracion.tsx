import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { getConfig, updateConfig, listConfigAudit, limpiarDatosPrueba } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";


const q = queryOptions({ queryKey: ["config"], queryFn: () => getConfig() });
const qAudit = queryOptions({ queryKey: ["config-audit"], queryFn: () => listConfigAudit() });

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isSuperadmin) throw redirect({ to: "/admin" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ConfiguracionPage,
});


function ConfiguracionPage() {
  const qc = useQueryClient();
  const { data } = useQuery(q);
  const [form, setForm] = useState({
    precio_m2: "7990", hero_titulo: "", hero_subtitulo: "", info_comercial: "",
    linktree_url: "", mapa_url: "", mapa_embed: "", telefono: "", direccion: "", instagram: "",
    logo_url: "", hero_url: "",
  });
  useEffect(() => {
    if (data) {
      setForm({
        precio_m2: String(data.precio_m2), hero_titulo: data.hero_titulo, hero_subtitulo: data.hero_subtitulo,
        info_comercial: data.info_comercial, linktree_url: data.linktree_url, mapa_url: data.mapa_url,
        mapa_embed: data.mapa_embed, telefono: data.telefono, direccion: data.direccion, instagram: data.instagram,
        logo_url: data.logo_url ?? "", hero_url: data.hero_url ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateConfig({ data: {
      ...form, precio_m2: Number(form.precio_m2),
      logo_url: form.logo_url || null, hero_url: form.hero_url || null,
    } }),
    onSuccess: () => { toast.success("Configuración guardada"); qc.invalidateQueries({ queryKey: ["config"] }); qc.invalidateQueries({ queryKey: ["public-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function f(k: keyof typeof form) {
    return { value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">CONFIGURACIÓN DEL SITIO</h1>
        <p className="text-sm text-muted-foreground">Solo el administrador general puede editar</p>
      </div>
      <Card className="grid gap-4 p-6 md:grid-cols-2">
        <div><Label>Precio por m² (CLP)</Label><Input type="number" {...f("precio_m2")} /></div>
        <div><Label>Teléfono</Label><Input {...f("telefono")} /></div>
        <div><Label>Dirección</Label><Input {...f("direccion")} /></div>
        <div><Label>Instagram</Label><Input {...f("instagram")} /></div>
        <div><Label>Linktree URL</Label><Input {...f("linktree_url")} /></div>
        <div><Label>Mapa (link)</Label><Input {...f("mapa_url")} /></div>
        <div className="md:col-span-2"><Label>Mapa (embed URL)</Label><Input {...f("mapa_embed")} /></div>
        <div className="md:col-span-2"><Label>Título hero</Label><Input {...f("hero_titulo")} /></div>
        <div className="md:col-span-2"><Label>Subtítulo hero</Label><Input {...f("hero_subtitulo")} /></div>
        <div className="md:col-span-2"><Label>Mensaje comercial (entrega)</Label><Textarea {...f("info_comercial")} /></div>
        <div><Label>Logo URL</Label><Input {...f("logo_url")} placeholder="https://..." /></div>
        <div><Label>Hero imagen URL</Label><Input {...f("hero_url")} placeholder="https://..." /></div>
        <div className="md:col-span-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} variant="hero">{save.isPending ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
      </Card>
      <HerramientasPrueba />
      <AuditLogCard />
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

