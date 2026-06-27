import { jsPDF } from "jspdf";
import { formatCLP, formatDate, TIPO_GASTO_LABEL } from "@/lib/format";

export type LataItem = { descripcion: string; cantidad: number; color: string };

export type ComprobanteEgreso = {
  id: string;
  tipo: keyof typeof TIPO_GASTO_LABEL;
  descripcion: string;
  monto: number;
  fecha: string;
  solicitado_por: string | null;
  boleta_subida_por: string | null;
  estado: string;
  decidido_at: string | null;
  aprobador_nombre: string;
  aprobador_email: string;
  latas?: LataItem[] | null;
};

const BRAND = "FERMAVAL";
const PRIMARY: [number, number, number] = [180, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

export function buildComprobantePDF(c: ComprobanteEgreso): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(BRAND, 15, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Comprobante de Solicitud Aceptada", W - 15, 14, { align: "right" });

  // Watermark
  doc.setTextColor(240, 200, 200);
  doc.setFontSize(72);
  doc.setFont("helvetica", "bold");
  doc.text("FERMAVAL", W / 2, 170, { align: "center", angle: 30 });

  // Body
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Solicitud de Egreso Aprobada", 15, 40);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, 44, W - 15, 44);

  const short = c.id.slice(0, 8).toUpperCase();
  const rows: Array<[string, string]> = [
    ["ID de la solicitud", `SE-${short}`],
    ["Fecha de la solicitud", formatDate(c.fecha)],
    ["Tipo de gasto", TIPO_GASTO_LABEL[c.tipo] ?? c.tipo],
    ["Descripción", c.descripcion],
    ["Monto", formatCLP(c.monto)],
    ["Solicitado por", c.solicitado_por ?? "—"],
    ["Responsable de boleta", c.boleta_subida_por ?? "—"],
    ["Estado", c.estado.toUpperCase()],
    ["Aprobado por", `${c.aprobador_nombre} (${c.aprobador_email})`],
    ["Fecha de aprobación", c.decidido_at ? new Date(c.decidido_at).toLocaleString("es-CL") : "—"],
  ];

  let y = 56;
  doc.setFontSize(11);
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(label, 15, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(value), W - 90);
    doc.text(lines, 75, y);
    y += Math.max(7, lines.length * 6);
  });

  // Detalle de latas (color por lata)
  const latas = c.latas ?? [];
  if (latas.length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...MUTED);
    doc.text("Detalle de latas", 15, y); y += 5;
    doc.setFontSize(10); doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text("#", 15, y); doc.text("Descripción", 22, y);
    doc.text("Cant.", 130, y); doc.text("Color", 150, y);
    y += 2; doc.setDrawColor(220, 220, 220); doc.line(15, y, W - 15, y); y += 5;
    doc.setFont("helvetica", "normal");
    latas.forEach((l, i) => {
      doc.text(String(i + 1), 15, y);
      doc.text(String(l.descripcion).slice(0, 70), 22, y);
      doc.text(String(l.cantidad), 130, y);
      doc.text(String(l.color), 150, y);
      y += 6;
    });
    y += 2;
  }


  // Footer
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 270, W - 15, 270);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Documento generado automáticamente por el sistema FERMAVAL.", 15, 278);
  doc.text(`Emitido: ${new Date().toLocaleString("es-CL")}`, 15, 283);

  return doc;
}

export function downloadComprobantePDF(c: ComprobanteEgreso) {
  const doc = buildComprobantePDF(c);
  const short = c.id.slice(0, 8).toUpperCase();
  doc.save(`Comprobante-SE-${short}.pdf`);
}
