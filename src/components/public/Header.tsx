import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoHorizontal from "@/assets/fermaval-logo-horizontal.jpg.asset.json";
import { Menu, X } from "lucide-react";

export function PublicHeader({ linktreeUrl }: { linktreeUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoHorizontal.url} alt="FERMAVAL" className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#productos" className="text-sm font-medium text-foreground/80 hover:text-accent">Productos</a>
          <a href="#cotizador" className="text-sm font-medium text-foreground/80 hover:text-accent">Cotizar</a>
          <Link to="/mis-cotizaciones" className="text-sm font-medium text-foreground/80 hover:text-accent">Mis cotizaciones</Link>
          <a href="#ubicacion" className="text-sm font-medium text-foreground/80 hover:text-accent">Ubicación</a>
          {linktreeUrl && (
            <a href={linktreeUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-foreground/80 hover:text-accent">Linktree</a>
          )}

          {authed ? (
            <Button asChild variant="navy" size="sm"><Link to="/admin">Panel</Link></Button>
          ) : (
            <Button asChild variant="outline" size="sm"><Link to="/auth">Acceso staff</Link></Button>
          )}
        </nav>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menú">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-4">
            <a href="#productos" onClick={() => setOpen(false)} className="py-2 text-sm font-medium">Productos</a>
            <a href="#cotizador" onClick={() => setOpen(false)} className="py-2 text-sm font-medium">Cotizar</a>
            <a href="#ubicacion" onClick={() => setOpen(false)} className="py-2 text-sm font-medium">Ubicación</a>
            {linktreeUrl && <a href={linktreeUrl} target="_blank" rel="noreferrer" className="py-2 text-sm font-medium">Linktree</a>}
            {authed ? (
              <Button onClick={() => { router.navigate({ to: "/admin" }); setOpen(false); }} variant="navy" size="sm">Panel</Button>
            ) : (
              <Button onClick={() => { router.navigate({ to: "/auth" }); setOpen(false); }} variant="outline" size="sm">Acceso staff</Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter({ telefono, direccion, instagram }: { telefono?: string; direccion?: string; instagram?: string }) {
  return (
    <footer className="brand-gradient mt-24 text-primary-foreground">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-display text-3xl">FERMAVAL</h3>
          <p className="mt-2 text-sm text-primary-foreground/70">Cubiertas y Revestimientos</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-accent">Contacto</h4>
          <p className="mt-2 text-sm text-primary-foreground/80">{telefono ?? "+56 9 3012 6744"}</p>
          <p className="text-sm text-primary-foreground/80">
            <a href="mailto:fermaval.contacto@gmail.com" className="hover:text-accent">fermaval.contacto@gmail.com</a>
          </p>
          <p className="text-sm text-primary-foreground/80">{instagram ?? "@fermaval.valdivia"}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-accent">Ubicación</h4>
          <p className="mt-2 text-sm text-primary-foreground/80">{direccion ?? "Valdivia, Chile"}</p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4 text-center text-xs text-primary-foreground/50">
        © {new Date().getFullYear()} FERMAVAL. Todos los derechos reservados.
      </div>
    </footer>
  );
}
