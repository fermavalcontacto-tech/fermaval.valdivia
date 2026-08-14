import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, MessageCircle, Printer, Share2, X } from "lucide-react";
import { cotizacionPdfBlobUrl, cotizacionPdfFilename, downloadCotizacionPDF, printCotizacionPDF, shareCotizacionPDF, type CotizacionPDF } from "@/lib/cotizacion-pdf";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCLP } from "@/lib/format";

type Props = {
  data: CotizacionPDF | null;
  onOpenChange: (open: boolean) => void;
  onShareWhatsApp?: (data: CotizacionPDF) => void;
};

export function PdfPreviewDialog({ data, onOpenChange, onShareWhatsApp }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [conMargen, setConMargen] = useState(false);
  const open = !!data;
  const isMobile = useIsMobile();

  /** Datos efectivos: agrega (o no) el anexo interno de margen por plancha. */
  const doc = useMemo<CotizacionPDF | null>(
    () => (data ? { ...data, mostrar_margen: conMargen } : null),
    [data, conMargen],
  );

  useEffect(() => {
    if (!doc) { setUrl(null); return; }
    const u = cotizacionPdfBlobUrl(doc);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [doc]);

  async function handleDownload(d: CotizacionPDF) {
    try {
      await downloadCotizacionPDF(d);
      toast.success(`Descargando ${cotizacionPdfFilename(d)}`);
    } catch {
      toast.error("No se pudo descargar el PDF. Intenta con \"Compartir\".");
    }
  }
  async function handleShare(d: CotizacionPDF) {
    const ok = await shareCotizacionPDF(d);
    if (!ok) await handleDownload(d);
  }

  const title = useMemo(() => data ? `Vista previa — Cotización ${data.numero}` : "", [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isMobile ? (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-accent" /> Cotizacion-{data?.numero}.pdf
            </div>
            {data && (
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Cliente</dt><dd>{data.cliente?.nombre || "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Total m²</dt><dd>{Number(data.metros2).toFixed(2)} m²</dd></div>
                <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatCLP(Number(data.total))}</dd></div>
              </dl>
            )}
            <div className="mt-4 grid gap-2">
              {data && (
                <Button variant="hero" size="lg" onClick={() => void handleDownload(data)}>
                  <Download className="mr-1 h-4 w-4" /> Descargar PDF
                </Button>
              )}
              {data && (
                <Button variant="outline" size="lg" onClick={() => void handleShare(data)}>
                  <Share2 className="mr-1 h-4 w-4" /> Compartir archivo
                </Button>
              )}
              {data && (
                <Button variant="outline" size="lg" onClick={() => printCotizacionPDF(data)}>
                  <Printer className="mr-1 h-4 w-4" /> Imprimir
                </Button>
              )}
              {data && onShareWhatsApp && (
                <Button variant="outline" size="lg" onClick={() => onShareWhatsApp(data)}>
                  <MessageCircle className="mr-1 h-4 w-4 text-emerald-600" /> Compartir por WhatsApp
                </Button>
              )}
              {url && (
                <Button variant="outline" size="lg" onClick={() => window.open(url, "_blank", "noopener")}>
                  <ExternalLink className="mr-1 h-4 w-4" /> Abrir PDF
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[70vh] w-full overflow-hidden rounded-md border bg-muted/30">
            {url ? (
              <iframe src={url} title="Vista previa PDF" className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Generando PDF…</div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-1 h-4 w-4" /> Cerrar
          </Button>
          {!isMobile && data && (
            <Button variant="outline" onClick={() => printCotizacionPDF(data)}>
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
          )}
          {!isMobile && data && onShareWhatsApp && (
            <Button variant="outline" onClick={() => onShareWhatsApp(data)}>
              <MessageCircle className="mr-1 h-4 w-4 text-emerald-600" /> Compartir por WhatsApp
            </Button>
          )}
          {!isMobile && data && (
            <Button variant="hero" onClick={() => void handleDownload(data)}>
              <Download className="mr-1 h-4 w-4" /> Descargar PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

