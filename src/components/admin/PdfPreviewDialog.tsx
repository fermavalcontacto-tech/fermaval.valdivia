import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, MessageCircle, X } from "lucide-react";
import { cotizacionPdfBlobUrl, downloadCotizacionPDF, type CotizacionPDF } from "@/lib/cotizacion-pdf";

type Props = {
  data: CotizacionPDF | null;
  onOpenChange: (open: boolean) => void;
  onShareWhatsApp?: (data: CotizacionPDF) => void;
};

export function PdfPreviewDialog({ data, onOpenChange, onShareWhatsApp }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const open = !!data;

  useEffect(() => {
    if (!data) { setUrl(null); return; }
    const u = cotizacionPdfBlobUrl(data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data]);

  const title = useMemo(() => data ? `Vista previa — Cotización ${data.numero}` : "", [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] w-full overflow-hidden rounded-md border bg-muted/30">
          {url ? (
            <iframe src={url} title="Vista previa PDF" className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Generando PDF…</div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-1 h-4 w-4" /> Cerrar
          </Button>
          {data && onShareWhatsApp && (
            <Button variant="outline" onClick={() => onShareWhatsApp(data)}>
              <MessageCircle className="mr-1 h-4 w-4 text-emerald-600" /> Compartir por WhatsApp
            </Button>
          )}
          {data && (
            <Button variant="hero" onClick={() => downloadCotizacionPDF(data)}>
              <Download className="mr-1 h-4 w-4" /> Descargar PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
