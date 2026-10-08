/** Análisis de Precio Unitario (APU): costo neto por m² = material + mano de obra + otros. */
export function costoApuTotal(a: { costo_material: number; mano_obra: number; otros_costos: number }) {
  return Number(a.costo_material || 0) + Number(a.mano_obra || 0) + Number(a.otros_costos || 0);
}

/** Venta neta de una línea: usa precio por metro lineal si existe, si no precio por m². */
export function ventaNetaLinea(l: {
  metros2: number; largo_m: number; cantidad_planchas: number;
  precio_m2: number | null; precio_ml: number | null; precio_m2_cot?: number | null;
}) {
  if (l.precio_ml != null && Number(l.precio_ml) > 0) {
    return Number(l.largo_m) * Number(l.cantidad_planchas) * Number(l.precio_ml);
  }
  const p = Number(l.precio_m2 ?? l.precio_m2_cot ?? 0);
  return Number(l.metros2) * p;
}

/** Utilidad real de una línea = venta neta − costo APU × m². */
export function utilidadLineaApu(ventaNeta: number, metros2: number, costoM2: number) {
  return Math.round(ventaNeta - Number(metros2) * Number(costoM2));
}
