import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoHorizontal from "@/assets/fermaval-logo-horizontal.jpg.asset.json";
import logoMark from "@/assets/fermaval-logo-transparent.png.asset.json";
import {
  LayoutDashboard, FileText, PackageCheck, Receipt, FileImage,
  TrendingUp, FileDown, Settings, Palette, LogOut, Menu, X, Search,
} from "lucide-react";


const SUPERADMIN_EMAIL = "fermaval.contacto@gmail.com";

type RoleCtx = { userId: string; isAdmin: boolean; isSuperadmin: boolean; email: string };

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async (): Promise<{ auth: RoleCtx }> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const email = data.user.email ?? "";
    const isSuperadmin = email.toLowerCase() === SUPERADMIN_EMAIL;
    return { auth: { userId: data.user.id, isAdmin, isSuperadmin, email } };
  },

  component: AuthedLayout,
});

const navAll: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/cotizaciones", label: "Cotizaciones", icon: FileText },
  { to: "/admin/pedidos", label: "Pedidos", icon: PackageCheck },
  { to: "/admin/egresos", label: "Egresos", icon: Receipt },
  { to: "/admin/boletas", label: "Boletas", icon: FileImage },
  { to: "/admin/finanzas", label: "Finanzas", icon: TrendingUp },
  { to: "/admin/reportes", label: "Reportes", icon: FileDown },
];
const navAdmin: Array<{ to: string; label: string; icon: typeof Settings }> = [
  { to: "/admin/configuracion", label: "Configuración", icon: Settings },
  { to: "/admin/colores", label: "Colores", icon: Palette },
];

function AuthedLayout() {
  const { auth } = Route.useRouteContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  useEffect(() => { setOpen(false); }, [router.state.location.pathname]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border bg-white/5 px-4">
          <Link to="/admin"><img src={logoHorizontal.url} alt="FERMAVAL" className="h-8 brightness-0 invert" /></Link>
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navAll.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.exact ?? false }}
              activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          {auth.isSuperadmin && (
            <>
              <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">Superadmin</div>
              {navAdmin.map((n) => (
                <Link key={n.to} to={n.to}
                  activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              ))}
            </>
          )}

        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60" title={auth.email}>{auth.email}</div>
          <div className="mb-2 px-2 text-xs">
            <span className="rounded bg-accent/20 px-2 py-0.5 text-accent">{auth.isSuperadmin ? "Administrador General" : auth.isAdmin ? "Administrador" : "Operador"}</span>
          </div>
          <Button onClick={signOut} variant="ghost" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <button onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <img src={logoHorizontal.url} alt="FERMAVAL" className="h-7" />
        </header>
        <main
          className="relative flex-1 p-4 md:p-8"
          style={{
            backgroundImage: `url(${logoMark.url})`,
            backgroundRepeat: "repeat",
            backgroundSize: "420px auto",
            backgroundPosition: "center",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-background/92" aria-hidden="true" />
          <div className="relative">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
