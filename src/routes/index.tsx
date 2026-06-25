import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getPublicConfig } from "@/lib/public.functions";
import { PublicHeader, PublicFooter } from "@/components/public/Header";
import { CotizadorForm } from "@/components/public/CotizadorForm";
import { Button } from "@/components/ui/button";
import { formatCLP } from "@/lib/format";
import logoSquare from "@/assets/fermaval-logo.png.asset.json";
import logoFull from "@/assets/fermaval-logo-full.jpg.asset.json";
import productos from "@/assets/fermaval-productos.png.asset.json";
import { MapPin, Clock, ExternalLink } from "lucide-react";

const cfgQuery = queryOptions({
  queryKey: ["public-config"],
  queryFn: () => getPublicConfig(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FERMAVAL — Cotizador de cubiertas en Valdivia" },
      { name: "description", content: "Fabricación de planchas y cubiertas en Valdivia. Cotiza online: $7.990 por m². Entrega en 72 horas." },
      { property: "og:title", content: "FERMAVAL — Cubiertas y Revestimientos" },
      { property: "og:description", content: "Cotiza online tus cubiertas. $7.990 / m². Entrega en 72 h." },
      { property: "og:image", content: productos.url },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cfgQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(cfgQuery);
  const cfg = data.cfg!;
  const colores = data.colores;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader linktreeUrl={cfg.linktree_url} />

      {/* HERO */}
      <section className="industrial-stripes relative overflow-hidden border-b border-border">
        <div className="container mx-auto grid gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" /> Fabricación en Valdivia
            </span>
            <h1 className="mt-4 font-display text-5xl leading-none text-primary sm:text-6xl md:text-7xl">
              CUBIERTAS<br/>Y REVESTIMIENTOS<br/>
              <span className="text-accent">DE CALIDAD INDUSTRIAL</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-muted-foreground">
              Planchas prepintadas onduladas, PV4, PV8, 6V, microonduladas y lisas. Cotiza online en segundos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg"><a href="#cotizador">Cotizar ahora</a></Button>
              {cfg.linktree_url && (
                <Button asChild variant="outline" size="lg">
                  <a href={cfg.linktree_url} target="_blank" rel="noreferrer">
                    Linktree <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            <div className="mt-10 flex items-center gap-6 border-t border-border pt-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Desde</div>
                <div className="font-display text-4xl text-primary">{formatCLP(Number(cfg.precio_m2))}<span className="text-base text-muted-foreground"> / m²</span></div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-accent" /> Entrega máximo 72 h
              </div>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent blur-2xl" />
            <img src={cfg.hero_url || productos.url} alt="Productos FERMAVAL" className="relative max-h-[520px] w-auto rounded-lg object-contain shadow-2xl" />
          </div>
        </div>
      </section>

      {/* PRODUCTOS / COLORES */}
      <section id="productos" className="container mx-auto px-4 py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Nuestros productos</div>
            <h2 className="font-display text-4xl text-primary md:text-5xl">COLORES DISPONIBLES</h2>
          </div>
          <p className="hidden max-w-sm text-sm text-muted-foreground md:block">
            Imágenes referenciales de color. Consulta por otros colores.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {colores.map((c) => (
            <div key={c.id} className="group overflow-hidden rounded-lg border border-border bg-card transition hover:border-accent/50 hover:shadow-xl">
              {c.imagen_url ? (
                <img src={c.imagen_url} alt={c.nombre} className="h-56 w-full object-cover" />
              ) : (
                <div className="h-56 w-full" style={{ background: `linear-gradient(135deg, ${c.hex}, color-mix(in oklab, ${c.hex} 70%, black))` }} />
              )}
              <div className="flex items-center justify-between bg-primary p-4 text-primary-foreground">
                <div>
                  <div className="font-display text-xl">{c.nombre.toUpperCase()}</div>
                  <div className="text-xs text-primary-foreground/60">0,4 mm · Exterior</div>
                </div>
                <span className="h-10 w-10 rounded border-2 border-primary-foreground/20" style={{ background: c.hex }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COTIZADOR */}
      <section id="cotizador" className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Cotizador instantáneo</div>
            <h2 className="mt-1 font-display text-4xl text-primary md:text-5xl">CALCULA TU PEDIDO</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Ingresa medidas, elige color y obtén tu cotización al instante. {cfg.info_comercial}
            </p>
          </div>
          <div className="mx-auto max-w-3xl">
            <CotizadorForm precio={Number(cfg.precio_m2)} colores={colores} />
          </div>
        </div>
      </section>

      {/* UBICACIÓN */}
      <section id="ubicacion" className="container mx-auto px-4 py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Visítanos</div>
            <h2 className="mt-1 font-display text-4xl text-primary md:text-5xl">FÁBRICA EN VALDIVIA</h2>
            <p className="mt-4 text-muted-foreground">{cfg.direccion}</p>
            <p className="text-muted-foreground">Tel: {cfg.telefono}</p>
            <p className="text-muted-foreground">
              Correo: <a href="mailto:fermaval.contacto@gmail.com" className="underline hover:text-accent">fermaval.contacto@gmail.com</a>
            </p>
            <div className="mt-6">
              <Button asChild variant="hero">
                <a href={cfg.mapa_url} target="_blank" rel="noreferrer">
                  <MapPin className="mr-1 h-4 w-4" /> Cómo llegar
                </a>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border-2 border-border shadow-lg">
            <iframe
              src={cfg.mapa_embed}
              title="Mapa FERMAVAL"
              className="h-80 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* MARCA */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="container mx-auto flex flex-col items-center px-4 text-center">
          <img
            src={logoFull.url}
            alt="FERMAVAL — Cubiertas y Revestimientos"
            className="h-56 w-auto md:h-72"
            loading="lazy"
          />
          <p className="mt-6 max-w-xl text-sm text-muted-foreground">
            Fabricación local en Valdivia. Calidad industrial, precios justos y entrega rápida.
          </p>
        </div>
      </section>

      <PublicFooter telefono={cfg.telefono} direccion={cfg.direccion} instagram={cfg.instagram} />
      <a href="#" aria-hidden className="sr-only"><img src={logoSquare.url} alt="" /></a>
    </div>
  );
}
