export const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatCLP(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return CLP.format(Math.round(Number.isFinite(v) ? v : 0));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(dt);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(dt);
}

export const ESTADO_LABEL: Record<string, string> = {
  cotizacion_creada: "Cotización creada",
  esperando_pago: "Esperando pago",
  pago_parcial: "Pago parcial recibido",
  pedido_confirmado: "Pedido confirmado",
  pedido_terminado: "Pedido terminado",
  rechazada: "Rechazada",
};

export const TIPO_GASTO_LABEL: Record<string, string> = {
  materiales: "Materiales",
  transporte: "Transporte",
  herramientas: "Herramientas",
  servicios: "Servicios",
  otros: "Otros",
};
