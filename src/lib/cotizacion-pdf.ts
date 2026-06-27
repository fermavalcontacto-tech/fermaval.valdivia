import { jsPDF } from "jspdf";
import { formatCLP, formatDate } from "@/lib/format";
import logoAsset from "@/assets/fermaval-logo-horizontal.jpg.asset.json";
const logoUrl = (logoAsset as { url: string }).url;

export type CotizacionItem = {
  largo_m: number;
  ancho_m: number;
  cantidad_planchas: number;
  metros2: number;
  color_nombre?: string | null;
  tipo?: string | null;
  espesor_mm?: number | null;
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
  responsable_nombre?: string | null;
};

const NAVY: [number, number, number] = [20, 40, 80];
const NAVY_DARK: [number, number, number] = [12, 26, 56];
const GREY_DARK: [number, number, number] = [55, 65, 81];
const GREY: [number, number, number] = [120, 128, 140];
const GREY_LIGHT: [number, number, number] = [225, 228, 234];
const ZEBRA: [number, number, number] = [247, 248, 250];
const BLACK: [number, number, number] = [17, 24, 39];
const ALERT_BG: [number, number, number] = [253, 246, 230];
const ALERT_BORDER: [number, number, number] = [202, 138, 4];
const ALERT_TEXT: [number, number, number] = [120, 80, 0];

const EMPRESA = {
  razon: "FERMAVAL Cubiertas y Revestimientos",
  rut: "RUT: 77.339.375-3",
  direccion: "Ruta T-505, Sector Vuelta La Culebra, Parcela #8, Valdivia",
  telefono: "+56 9 0000 0000",
  email: "fermaval.contacto@gmail.com",
};

const BANCO = {
  empresa: "FERMAVAL SPA",
  rut: "77.339.375-3",
  banco: "Santander",
  tipo: "Cuenta Corriente (Cta. Cte.)",
  cuenta: "81530840",
  correo: "fermavalspa@gmail.com",
};

const LEGAL_TITLE = "Nota sobre el retiro de materiales";
const LEGAL_BODY =
  "Por razones de seguridad y cumplimiento legal, solo se despacharán productos en vehículos que cuenten con las dimensiones adecuadas para su traslado. Recuerde que el retiro de planchas de zinc debe cumplir con la normativa chilena vigente (Decreto 158 MOP), la cual prohíbe que la carga sobresalga más de 2 metros de la carrocería.";

let LOGO_DATA: string | null = null;
let LOGO_W = 0;
let LOGO_H = 0;
(function preloadLogo() {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      LOGO_DATA = canvas.toDataURL("image/jpeg", 0.92);
      LOGO_W = img.naturalWidth;
      LOGO_H = img.naturalHeight;
    } catch {
      LOGO_DATA = null;
    }
  };
  img.src = logoUrl;
})();

function drawLogo(doc: jsPDF, x: number, y: number, maxW: number, maxH: number) {
  if (LOGO_DATA && LOGO_W && LOGO_H) {
    const ratio = LOGO_W / LOGO_H;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    try {
      doc.addImage(LOGO_DATA, "JPEG", x, y, w, h);
      return;
    } catch { /* fallthrough */ }
  }
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, maxW, maxH, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("FERMAVAL", x + maxW / 2, y + maxH / 2 + 1, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text("Cubiertas y Revestimientos", x + maxW / 2, y + maxH / 2 + 5, { align: "center" });
}

function drawLetterhead(doc: jsPDF, docTitle: string, numero: string) {
  const W = doc.internal.pageSize.getWidth();
  drawLogo(doc, 15, 12, 55, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY_DARK);
  doc.text(EMPRESA.razon, W - 15, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY_DARK);
  [EMPRESA.rut, EMPRESA.direccion, `Tel: ${EMPRESA.telefono}`, EMPRESA.email]
    .forEach((t, i) => doc.text(t, W - 15, 20 + i * 4.2, { align: "right" }));
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(15, 40, W - 15, 40);
  doc.setDrawColor(...GREY_LIGHT);
  doc.setLineWidth(0.2);
  doc.line(15, 41.2, W - 15, 41.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY_DARK);
  doc.text(docTitle.toUpperCase(), 15, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(`N° ${numero}`, W - 15, 50, { align: "right" });
  doc.setTextColor(245, 247, 250);
  doc.setFontSize(70);
  doc.setFont("helvetica", "bold");
  doc.text("FERMAVAL", W / 2, 170, { align: "center", angle: 30 });
}

function drawFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(15, H - 22, W - 15, H - 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text("Términos: Validez 7 días corridos. Pago: 50% al confirmar pedido, saldo contra entrega. Precios en CLP.", W / 2, H - 17, { align: "center" });
  doc.text(`${EMPRESA.razon}  ·  ${EMPRESA.email}  ·  ${EMPRESA.telefono}`, W / 2, H - 12, { align: "center" });
  doc.setTextColor(...GREY_LIGHT);
  doc.setFontSize(7);
  doc.text(`Documento generado el ${new Date().toLocaleString("es-CL")}`, W / 2, H - 7, { align: "center" });
}

function infoBlock(doc: jsPDF, x: number, y: number, w: number, title: string, rows: Array<[string, string]>): number {
  doc.setFillColor(...NAVY_DARK);
  doc.rect(x, y, w, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), x + 2.5, y + 4.2);

  doc.setDrawColor(...GREY_LIGHT);
  doc.setLineWidth(0.2);
  const bodyH = rows.length * 5.2 + 4;
  doc.rect(x, y + 6, w, bodyH, "S");

  let cy = y + 10.5;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY_DARK);
    doc.text(k, x + 2.5, cy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
    const lines = doc.splitTextToSize(String(v), w - 32);
    doc.text(lines, x + 28, cy);
    cy += 5.2;
  });
  return y + 6 + bodyH;
}

function drawNewPageIfNeeded(doc: jsPDF, y: number, needed: number): number {
  const H = doc.internal.pageSize.getHeight();
  if (y + needed > H - 30) {
    doc.addPage();
    drawLetterhead(doc, "Cotización Comercial (cont.)", "—");
    return 58;
  }
  return y;
}

function drawBankBlock(doc: jsPDF, y: number): number {
  const W = doc.internal.pageSize.getWidth();
  y = drawNewPageIfNeeded(doc, y, 50);
  doc.setFillColor(240, 245, 252);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, y, W - 30, 44, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY_DARK);
  doc.text("DATOS PARA TRANSFERENCIA", 20, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  const rows = [
    ["Empresa:", BANCO.empresa],
    ["RUT:", BANCO.rut],
    ["Banco:", BANCO.banco],
    ["Tipo de cuenta:", BANCO.tipo],
    ["N° de cuenta:", BANCO.cuenta],
    ["Correo:", BANCO.correo],
  ];
  rows.forEach((r, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const x = 22 + col * ((W - 40) / 2);
    const yy = y + 13 + row * 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREY_DARK);
    doc.text(r[0], x, yy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
    doc.text(r[1], x + 28, yy);
  });
  return y + 50;
}

function drawLegalBlock(doc: jsPDF, y: number): number {
  const W = doc.internal.pageSize.getWidth();
  const padding = 5;
  const bodyLines = doc.splitTextToSize(LEGAL_BODY, W - 30 - padding * 2);
  const h = 10 + bodyLines.length * 4.2 + padding;
  y = drawNewPageIfNeeded(doc, y, h + 6);
  doc.setFillColor(...ALERT_BG);
  doc.setDrawColor(...ALERT_BORDER);
  doc.setLineWidth(0.6);
  doc.roundedRect(15, y, W - 30, h, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ALERT_TEXT);
  doc.text(`⚠  ${LEGAL_TITLE.toUpperCase()}`, 15 + padding, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 50, 20);
  doc.text(bodyLines, 15 + padding, y + 12);
  return y + h + 6;
}

export function buildCotizacionPDF(c: CotizacionPDF): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  drawLetterhead(doc, "Cotización Comercial", c.numero);

  const fechaEmision = c.fecha ? new Date(c.fecha) : new Date();
  const fechaValidez = new Date(fechaEmision);
  fechaValidez.setDate(fechaValidez.getDate() + 7);

  const isInterno = c.origen === "interno";
  const responsable = c.responsable_nombre ?? c.creado_por_nombre ?? c.aprobador_nombre ?? "Equipo FERMAVAL";

  const blockY = 58;
  const blockW = (W - 30 - 6) / 2;
  const endA = infoBlock(doc, 15, blockY, blockW, "Datos del cliente", [
    ["Cliente:", c.cliente.nombre || "—"],
    ["Correo:", c.cliente.correo || "—"],
    ["Teléfono:", c.cliente.telefono || "—"],
    ["Dirección:", c.cliente.direccion || "—"],
  ]);
  const endB = infoBlock(doc, 15 + blockW + 6, blockY, blockW, "Datos del documento", [
    ["N° cotización:", c.numero],
    ["Fecha emisión:", formatDate(fechaEmision.toISOString())],
    ["Válido hasta:", formatDate(fechaValidez.toISOString())],
    ["Responsable:", responsable],
  ]);

  let y = Math.max(endA, endB) + 8;

  const items: CotizacionItem[] = c.items && c.items.length
    ? c.items
    : [{ largo_m: c.largo_m, ancho_m: c.ancho_m, cantidad_planchas: c.cantidad_planchas ?? 1, metros2: c.metros2, color_nombre: c.color_nombre }];

  const cols = [
    { x: 15, w: 10, label: "#", align: "left" as const },
    { x: 25, w: 80, label: "Descripción", align: "left" as const },
    { x: 105, w: 18, label: "Cant.", align: "right" as const },
    { x: 123, w: 32, label: "Precio Unit.", align: "right" as const },
    { x: 155, w: 40, label: "Total", align: "right" as const },
  ];
  const tableX = 15;
  const tableW = W - 30;

  doc.setFillColor(...NAVY_DARK);
  doc.rect(tableX, y, tableW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  cols.forEach((col) => {
    const tx = col.align === "right" ? col.x + col.w - 2 : col.x + 2;
    doc.text(col.label, tx, y + 4.8, { align: col.align });
  });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  const rowH = 9;
  items.forEach((it, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(tableX, y, tableW, rowH, "F");
    }
    const tipoTxt = it.tipo ?? "Ondulado";
    const espesorTxt = `${(it.espesor_mm ?? 0.4)} mm`;
    const desc =
      `${tipoTxt} · ${espesorTxt}` +
      (it.color_nombre ? ` · ${it.color_nombre}` : "") +
      `\nPlancha ${Number(it.largo_m).toFixed(2)} m × 1.00 m  ·  ${Number(it.metros2).toFixed(2)} m²`;
    const cant = `${it.cantidad_planchas}`;
    const subtotal = Number(it.metros2) * c.precio_m2;
    doc.setTextColor(...GREY_DARK);
    doc.text(String(i + 1), cols[0].x + 2, y + 5.5);
    doc.setTextColor(...BLACK);
    const descLines = doc.splitTextToSize(desc, cols[1].w - 2);
    doc.text(descLines, cols[1].x + 2, y + 4);
    doc.text(cant, cols[2].x + cols[2].w - 2, y + 5.5, { align: "right" });
    doc.text(formatCLP(c.precio_m2), cols[3].x + cols[3].w - 2, y + 5.5, { align: "right" });
    doc.text(formatCLP(subtotal), cols[4].x + cols[4].w - 2, y + 5.5, { align: "right" });
    y += rowH;
  });

  doc.setDrawColor(...GREY_LIGHT);
  doc.setLineWidth(0.2);
  doc.rect(tableX, y - items.length * rowH - 7, tableW, items.length * rowH + 7, "S");

  y += 4;

  const subtotal = items.reduce((s, it) => s + Number(it.metros2) * c.precio_m2, 0);
  const neto = Math.max(0, subtotal - (c.descuento || 0));
  const iva = Math.round(neto * 0.19);
  const totalConIva = neto + iva;
  const totalsX = W - 95;
  const totalsW = 80;

  const totRows: Array<[string, string, boolean]> = [
    ["Subtotal", formatCLP(subtotal), false],
    ["Descuento", `- ${formatCLP(c.descuento || 0)}`, false],
    ["Neto", formatCLP(neto), false],
    ["IVA 19%", formatCLP(iva), false],
    ["TOTAL", formatCLP(totalConIva), true],
  ];
  totRows.forEach(([k, v, strong]) => {
    if (strong) {
      doc.setFillColor(...NAVY);
      doc.rect(totalsX, y, totalsW, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(k, totalsX + 3, y + 6);
      doc.text(v, totalsX + totalsW - 3, y + 6, { align: "right" });
      y += 9;
    } else {
      doc.setDrawColor(...GREY_LIGHT);
      doc.line(totalsX, y + 6.5, totalsX + totalsW, y + 6.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...GREY_DARK);
      doc.text(k, totalsX + 3, y + 5);
      doc.setTextColor(...BLACK);
      doc.text(v, totalsX + totalsW - 3, y + 5, { align: "right" });
      y += 7;
    }
  });

  y += 8;

  // Validez 7 días
  y = drawNewPageIfNeeded(doc, y, 18);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 253);
  doc.roundedRect(15, y, W - 30, 14, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY_DARK);
  doc.text("VALIDEZ DE LA COTIZACIÓN", 20, y + 5.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY_DARK);
  doc.text("Esta cotización tiene una validez de 7 días corridos desde la fecha de emisión.", 20, y + 10);
  y += 20;

  // Datos bancarios (solo si origen interno)
  if (isInterno) {
    y = drawBankBlock(doc, y);
  }

  // Cláusula legal obligatoria
  y = drawLegalBlock(doc, y);

  // Firmas
  const H = doc.internal.pageSize.getHeight();
  const sigY = Math.min(y + 6, H - 35);
  const sigW = 70;
  doc.setDrawColor(...GREY_DARK);
  doc.setLineWidth(0.3);
  doc.line(25, sigY, 25 + sigW, sigY);
  doc.line(W - 25 - sigW, sigY, W - 25, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY_DARK);
  doc.text("Aceptación del Cliente", 25 + sigW / 2, sigY + 4, { align: "center" });
  doc.text(`Responsable: ${responsable}`, W - 25 - sigW / 2, sigY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text("Nombre / RUT / Fecha", 25 + sigW / 2, sigY + 8, { align: "center" });
  doc.text("Firma y Timbre FERMAVAL", W - 25 - sigW / 2, sigY + 8, { align: "center" });

  drawFooter(doc);
  return doc;
}

export function buildPagoPDF(c: CotizacionPDF): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  drawLetterhead(doc, "Comprobante de Pago", c.numero);

  const pct = c.total > 0 ? Math.round((c.pago_recibido / c.total) * 100) : 0;
  const blockW = W - 30;
  let y = 60;
  y = infoBlock(doc, 15, y, blockW, "Datos del cliente", [
    ["Cliente:", c.cliente.nombre || "—"],
    ["Correo:", c.cliente.correo || "—"],
    ["Cotización:", c.numero],
  ]);
  y += 6;
  y = infoBlock(doc, 15, y, blockW, "Detalle del pago", [
    ["Total cotización:", formatCLP(c.total)],
    ["Pago recibido:", `${formatCLP(c.pago_recibido)}  (${pct}%)`],
    ["Saldo pendiente:", formatCLP(c.saldo)],
    ["Estado:", c.estado.toUpperCase()],
    ["Responsable:", c.responsable_nombre ?? c.aprobador_nombre],
    ["Aprobado por:", `${c.aprobador_nombre} ${c.aprobador_email ? `(${c.aprobador_email})` : ""}`],
    ["Fecha aprobación:", c.aprobado_at ? new Date(c.aprobado_at).toLocaleString("es-CL") : "—"],
  ]);

  drawFooter(doc);
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

export function cotizacionPdfBlobUrl(c: CotizacionPDF): string {
  const blob = buildCotizacionPDF(c).output("blob");
  return URL.createObjectURL(blob);
}
