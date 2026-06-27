import { jsPDF } from "jspdf";
import { formatCLP, formatDate } from "@/lib/format";

export type CotizacionItem = {
  largo_m: number;
  ancho_m: number;
  cantidad_planchas: number;
  metros2: number;
};

export type CotizacionPDF = {
  numero: string;
  fecha: string;
  cliente: { nombre: string; correo: string; telefono: string; direccion: string };
  largo_m: number;
  ancho_m: number;
  cantidad_planchas?: number;
  metros2: number;
  items?: CotizacionItem[];
  color_nombre: string | null;
  precio_m2: number;
  descuento: number;
  total: number;
  pago_recibido: number;
  saldo: number;
  estado: string;
  aprobador_nombre: string;
  aprobador_email: string;
  aprobado_at: string;
  creado_por_nombre?: string;
  creado_por_email?: string;
  origen?: string;
};


const PRIMARY: [number, number, number] = [180, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

function header(doc: jsPDF, title: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FERMAVAL", 15, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, W - 15, 14, { align: "right" });
  doc.setTextColor(240, 200, 200);
  doc.setFontSize(72);
  doc.setFont("helvetica", "bold");
  doc.text("FERMAVAL", W / 2, 170, { align: "center", angle: 30 });
}

function footer(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 270, W - 15, 270);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Documento generado automáticamente por el sistema FERMAVAL.", 15, 278);
  doc.text(`Emitido: ${new Date().toLocaleString("es-CL")}`, 15, 283);
}

function rows(doc: jsPDF, startY: number, items: Array<[string, string]>) {
  const W = doc.internal.pageSize.getWidth();
  let y = startY;
  doc.setFontSize(11);
  items.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(label, 15, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(value), W - 90);
    doc.text(lines, 75, y);
    y += Math.max(7, lines.length * 6);
  });
  return y;
}

export function buildCotizacionPDF(c: CotizacionPDF): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  header(doc, "Cotización Aprobada");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Cotización ${c.numero}`, 15, 40);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, 44, W - 15, 44);
  let y = rows(doc, 56, [
    ["Fecha", formatDate(c.fecha)],
    ["Cliente", c.cliente.nombre],
    ["Correo", c.cliente.correo],
    ["Teléfono", c.cliente.telefono],
    ["Dirección", c.cliente.direccion],
    ["Color", c.color_nombre ?? "—"],
    ["Precio / m²", formatCLP(c.precio_m2)],
  ]);
  // Tabla de medidas
  const items: CotizacionItem[] = (c.items && c.items.length
    ? c.items
    : [{ largo_m: c.largo_m, ancho_m: c.ancho_m, cantidad_planchas: c.cantidad_planchas ?? 1, metros2: c.metros2 }]);
  y += 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...MUTED);
  doc.text("Medidas", 15, y); y += 5;
  doc.setFontSize(10); doc.setTextColor(20, 20, 20);
  const headers = ["#", "Largo (m)", "Ancho (m)", "Cantidad", "m²"];
  const colsX = [15, 30, 65, 100, 140];
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => doc.text(h, colsX[i], y));
  y += 2; doc.setDrawColor(220, 220, 220); doc.line(15, y, W - 15, y); y += 5;
  doc.setFont("helvetica", "normal");
  items.forEach((it, i) => {
    doc.text(String(i + 1), colsX[0], y);
    doc.text(Number(it.largo_m).toFixed(2), colsX[1], y);
    doc.text("1 (estándar)", colsX[2], y);
    doc.text(String(it.cantidad_planchas), colsX[3], y);
    doc.text(Number(it.metros2).toFixed(2), colsX[4], y);
    y += 6;
  });
  doc.setFont("helvetica", "bold");
  doc.text("Total m²", colsX[3], y); doc.text(c.metros2.toFixed(2), colsX[4], y); y += 8;

  const totalPlanchas = items.reduce((s, it) => s + Number(it.cantidad_planchas || 0), 0);
  y = rows(doc, y, [
    ["Total planchas", String(totalPlanchas)],
    ["Descuento", formatCLP(c.descuento)],
    ["Total", formatCLP(c.total)],
  ]);
  y += 2;
  doc.setDrawColor(220, 220, 220); doc.line(15, y, W - 15, y); y += 6;
  doc.setFontSize(9); doc.setTextColor(...MUTED);
  const origenTxt = c.origen === "interno" ? "Perfil interno" : c.origen === "cliente" ? "Cliente" : (c.origen ?? "—");
  doc.text(`Origen: ${origenTxt}`, 15, y);
  if (c.creado_por_email || c.creado_por_nombre) {
    doc.text(`Creada por: ${c.creado_por_nombre ?? ""}${c.creado_por_email ? ` (${c.creado_por_email})` : ""}`, 15, y + 5);
  }
  footer(doc);
  return doc;
}


export function buildPagoPDF(c: CotizacionPDF): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  header(doc, "Comprobante de Pago");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Comprobante de pago ${c.numero}`, 15, 40);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, 44, W - 15, 44);
  const pct = c.total > 0 ? Math.round((c.pago_recibido / c.total) * 100) : 0;
  rows(doc, 56, [
    ["Cotización", c.numero],
    ["Cliente", c.cliente.nombre],
    ["Total cotización", formatCLP(c.total)],
    ["Pago recibido", `${formatCLP(c.pago_recibido)} (${pct}%)`],
    ["Saldo pendiente", formatCLP(c.saldo)],
    ["Estado", c.estado.toUpperCase()],
    ["Aprobado por", `${c.aprobador_nombre} (${c.aprobador_email})`],
    ["Fecha de aprobación", c.aprobado_at ? new Date(c.aprobado_at).toLocaleString("es-CL") : "—"],
  ]);
  footer(doc);
  return doc;
}

function pdfToBase64(doc: jsPDF): string {
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1] ?? "";
}

export function pdfsForCotizacion(c: CotizacionPDF) {
  return {
    cotizacionBase64: pdfToBase64(buildCotizacionPDF(c)),
    pagoBase64: pdfToBase64(buildPagoPDF(c)),
  };
}

export function downloadCotizacionPDF(c: CotizacionPDF) {
  buildCotizacionPDF(c).save(`Cotizacion-${c.numero}.pdf`);
}
export function downloadPagoPDF(c: CotizacionPDF) {
  buildPagoPDF(c).save(`Comprobante-Pago-${c.numero}.pdf`);
}
