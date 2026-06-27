import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { listEmpleados, crearEmpleado, eliminarEmpleado, resetPasswordEmpleado } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, KeyRound, UserPlus, ShieldCheck } from "lucide-react";

const q = queryOptions({ queryKey: ["empleados"], queryFn: () => listEmpleados() });

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isSuperadmin) throw redirect({ to: "/admin" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: UsuariosPage,
});

function UsuariosPage() {
  const qc = useQueryClient();
  const { data } = useQuery(q);
  const [form, setForm] = useState({ email: "", password: "", nombre: "" });

  const crear = useMutation({
    mutationFn: () => crearEmpleado({ data: form }),
    onSuccess: () => {
      toast.success("Empleado creado con perfil estándar");
      setForm({ email: "", password: "", nombre: "" });
      qc.invalidateQueries({ queryKey: ["empleados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: (p: { user_id: string; email: string }) => eliminarEmpleado({ data: p }),
    onSuccess: () => { toast.success("Empleado eliminado"); qc.invalidateQueries({ queryKey: ["empleados"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: (p: { user_id: string; password: string }) => resetPasswordEmpleado({ data: p }),
    onSuccess: () => toast.success("Contraseña actualizada"),
    onError: (e: Error) => toast.error(e.message),
  });

  function handleReset(user_id: string) {
    const password = window.prompt("Nueva contraseña (mínimo 8 caracteres):", "");
    if (!password) return;
    if (password.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    reset.mutate({ user_id, password });
  }

  const ready = form.email.includes("@") && form.password.length >= 8;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-primary">GESTIÓN DE EMPLEADOS</h1>
        <p className="text-sm text-muted-foreground">Solo el Administrador General puede crear o eliminar perfiles del equipo.</p>
      </div>

      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-accent" />
          <h2 className="font-display text-2xl text-primary">Nuevo empleado</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          El nuevo perfil hereda automáticamente el mismo nivel de acceso que los administradores estándar del equipo.
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>Nombre (opcional)</Label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Juan Pérez" />
          </div>
          <div className="md:col-span-1">
            <Label>Correo</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="empleado@fermaval.cl" />
          </div>
          <div className="md:col-span-1">
            <Label>Contraseña temporal</Label>
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mín. 8 caracteres" />
          </div>
          <div className="flex items-end md:col-span-1">
            <Button onClick={() => crear.mutate()} disabled={!ready || crear.isPending} variant="hero" className="w-full">
              {crear.isPending ? "Creando..." : "Crear empleado"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h2 className="font-display text-2xl text-primary">Equipo actual</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2 pr-3">Correo</th><th className="pr-3">Perfil</th><th className="pr-3">Creado</th><th className="pr-3">Último acceso</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="pr-3">
                    {u.is_superadmin ? (
                      <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">Administrador General</span>
                    ) : u.roles.includes("admin") ? (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Administrador (estándar)</span>
                    ) : (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{u.roles.join(", ") || "Sin rol"}</span>
                    )}
                  </td>
                  <td className="pr-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("es-CL")}</td>
                  <td className="pr-3 text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("es-CL") : "—"}</td>
                  <td className="text-right">
                    {!u.is_superadmin && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleReset(u.id)} disabled={reset.isPending}>
                          <KeyRound className="mr-1 h-3 w-3" /> Reset
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          if (window.confirm(`¿Eliminar a ${u.email}? Esta acción es irreversible.`)) {
                            eliminar.mutate({ user_id: u.id, email: u.email });
                          }
                        }} disabled={eliminar.isPending}>
                          <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sin empleados aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
