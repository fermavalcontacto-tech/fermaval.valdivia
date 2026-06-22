import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { getConfig, updateConfig } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const q = queryOptions({ queryKey: ["config"], queryFn: () => getConfig() });

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAdmin) throw redirect({ to: "/admin" });
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
    </div>
  );
}
