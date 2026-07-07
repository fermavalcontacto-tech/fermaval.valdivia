// Núcleo compartido de la lógica de cotización.
// Cliente (público) y Admin usan EXACTAMENTE estas mismas funciones y constantes.
// No importar server-only aquí: este módulo puede correr en ambos lados.

import { z } from "zod";

export const ANCHO_FIJO_M = 1;
export const ESPESOR_FIJO_MM = 0.4;

// Tipos de fabricación oficiales ofrecidos en el cotizador público.
// El color NO es una variante del tipo: las bobinas se administran por color
// y se usan en cualquier máquina según el pedido. Cotizaciones antiguas con
// tipos legacy (Trapezoidal, Minionda, PV6, Teja Continua/Colonial/Española)
// siguen visibles en el admin porque `cotizacion_items.tipo` es texto libre.
export const TIPOS_PRODUCTO = [
  "Ondulado",
  "PV8",
  "PV8 Invertido",
  "Microondulado",
  "6V",
  "PV4",
  "Lata Lisa",
] as const;
export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];

export const TipoEnum = z.enum(TIPOS_PRODUCTO);

export const ItemInputSchema = z.object({
  largo_m: z.number().positive().max(1000),
  cantidad_planchas: z.number().int().positive().max(10000),
  color_id: z.string().uuid().nullable().optional(),
  tipo: TipoEnum.optional().default("Ondulado"),
  espesor_mm: z.number().optional().default(ESPESOR_FIJO_MM),
});
export type ItemInput = z.infer<typeof ItemInputSchema>;

export type ItemCalc = {
  largo_m: number;
  ancho_m: number;
  cantidad_planchas: number;
  metros2: number;
  color_id: string | null;
  color_nombre: string | null;
  tipo: TipoProducto;
  espesor_mm: number;
};

type DbClientLike = { from: (table: string) => any };

/**
 * Fuente única de cálculo de líneas. Usada por:
 *  - createPublicQuote (cliente)
 *  - createCotizacionManual (admin)
 *  - updateCotizacionFull (admin)
 */
export async function buildItemsCalc(
  supabase: DbClientLike,
  items: ItemInput[],
): Promise<ItemCalc[]> {
  const colorIds = Array.from(
    new Set(items.map((i) => i.color_id).filter((x): x is string => !!x)),
  );
  const colorNames = new Map<string, string>();
  if (colorIds.length) {
    const { data: cols } = await supabase
      .from("colores")
      .select("id, nombre")
      .in("id", colorIds);
    for (const c of (cols ?? [])) colorNames.set(c.id, c.nombre);
  }

  return items.map((it) => {
    const tipo = (it.tipo ?? "Ondulado") as TipoProducto;
    const espesor = Number(it.espesor_mm ?? ESPESOR_FIJO_MM);
    const cid = it.color_id ?? null;
    return {
      largo_m: it.largo_m,
      ancho_m: ANCHO_FIJO_M,
      cantidad_planchas: it.cantidad_planchas,
      metros2: Number((it.largo_m * ANCHO_FIJO_M * it.cantidad_planchas).toFixed(2)),
      color_id: cid,
      color_nombre: cid ? (colorNames.get(cid) ?? null) : null,
      tipo,
      espesor_mm: espesor,
    };
  });
}

export function sumMetros2(items: Pick<ItemCalc, "metros2">[]): number {
  return Number(items.reduce((s, x) => s + x.metros2, 0).toFixed(2));
}

export function calcTotal(metros2: number, precio_m2: number, descuento = 0): number {
  return Math.max(0, Math.round(metros2 * precio_m2 - descuento));
}

export const QUOTE_FALLBACK_ERROR_MESSAGE = "No se pudo generar la cotización. Por favor intenta nuevamente.";
export const LEGACY_VARIANT_ERROR_PATTERN = /(?:no\s+existe\s+variante|variante\s+de\s+stock|producto_variantes|variante_id|ensure_variant|fetch_or_create_variant|stock\s+para)/i;

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

export function isLegacyVariantStockError(error: unknown): boolean {
  return LEGACY_VARIANT_ERROR_PATTERN.test(errorMessage(error));
}

export function publicQuoteErrorMessage(error: unknown): string {
  if (isLegacyVariantStockError(error)) return QUOTE_FALLBACK_ERROR_MESSAGE;
  const message = errorMessage(error);
  if (LEGACY_VARIANT_ERROR_PATTERN.test(message)) return QUOTE_FALLBACK_ERROR_MESSAGE;
  return message || QUOTE_FALLBACK_ERROR_MESSAGE;
}
