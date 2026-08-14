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

// Acepta números o strings con coma/punto ("10,5" o "10.5"): se normaliza a Number.
const decimalFromInput = z.preprocess(
  (v) => (typeof v === "string" ? Number(v.trim().replace(",", ".")) : v),
  z.number(),
);

export const ItemInputSchema = z.object({
  largo_m: decimalFromInput.pipe(z.number().positive().max(1000)),
  cantidad_planchas: z.number().int().positive().max(10000),
  color_id: z.string().uuid().nullable().optional(),
  tipo: TipoEnum.optional().default("Ondulado"),
  espesor_mm: z.number().optional().default(ESPESOR_FIJO_MM),
  // Precio por m² específico de esta línea (ajuste manual del administrador).
  // Si no viene, se usa el precio del tipo y, en última instancia, el precio general.
  precio_m2: decimalFromInput.pipe(z.number().min(0).max(100_000_000)).nullable().optional(),
  // Bobina (lote de proveedor) preferida para consumir el stock de esta línea.
  bobina_id: z.string().uuid().nullable().optional(),
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
  precio_m2: number;
  bobina_id: string | null;
};


type DbClientLike = { from: (table: string) => any };

/** Precios base por tipo de plancha, leídos de `precios_tipo`. */
export type PreciosPorTipo = Partial<Record<string, number>>;

export async function fetchPreciosPorTipo(supabase: DbClientLike): Promise<PreciosPorTipo> {
  const map: PreciosPorTipo = {};
  try {
    const { data } = await supabase.from("precios_tipo").select("tipo, precio_m2");
    for (const row of (data ?? [])) {
      const precio = Number(row.precio_m2);
      if (Number.isFinite(precio) && precio > 0) map[row.tipo as string] = precio;
    }
  } catch {
    // Sin precios por tipo se usa el precio general: nunca bloquea la cotización.
  }
  return map;
}

/** Precio por m² efectivo de una línea: precio manual → precio del tipo → precio general. */
export function resolvePrecioItem(
  item: { tipo?: string | null; precio_m2?: number | null },
  precios: PreciosPorTipo,
  precioBase: number,
): number {
  const manual = Number(item.precio_m2);
  if (Number.isFinite(manual) && manual > 0) return manual;
  const porTipo = precios[(item.tipo ?? "Ondulado") as string];
  if (Number.isFinite(Number(porTipo)) && Number(porTipo) > 0) return Number(porTipo);
  return precioBase;
}

/**
 * Fuente única de cálculo de líneas. Usada por:
 *  - createPublicQuote (cliente)
 *  - createCotizacionManual (admin)
 *  - updateCotizacionFull (admin)
 */
export async function buildItemsCalc(
  supabase: DbClientLike,
  items: ItemInput[],
  opts: { precioBase?: number; precios?: PreciosPorTipo } = {},
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

  const precios = opts.precios ?? await fetchPreciosPorTipo(supabase);
  const precioBase = Number(opts.precioBase ?? 0);

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
      precio_m2: resolvePrecioItem({ tipo, precio_m2: it.precio_m2 ?? null }, precios, precioBase),
      bobina_id: it.bobina_id ?? null,

    };
  });
}

export function sumMetros2(items: Pick<ItemCalc, "metros2">[]): number {
  return Number(items.reduce((s, x) => s + x.metros2, 0).toFixed(2));
}

/** Suma de subtotales (m² × precio por m² de cada línea). */
export function sumSubtotales(items: Pick<ItemCalc, "metros2" | "precio_m2">[]): number {
  return items.reduce((s, x) => s + x.metros2 * Number(x.precio_m2 || 0), 0);
}

/** Total de la cotización a partir de las líneas, con descuento aplicado. */
export function calcTotalItems(
  items: Pick<ItemCalc, "metros2" | "precio_m2">[],
  descuento = 0,
): number {
  return Math.max(0, Math.round(sumSubtotales(items) - descuento));
}

/** Precio por m² representativo de la cotización (para compatibilidad de la cabecera). */
export function precioPromedio(
  items: Pick<ItemCalc, "metros2" | "precio_m2">[],
  fallback = 0,
): number {
  const m2 = items.reduce((s, x) => s + x.metros2, 0);
  if (m2 <= 0) return fallback;
  return Math.round(sumSubtotales(items) / m2);
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

// ── Mensajes de validación legibles ──────────────────────────────────────────
// Convierte errores de Zod (objeto ZodError o el JSON crudo que Zod imprime en
// `error.message`) en un texto corto en español. Evita que aparezcan bloques
// rojos con JSON técnico en el Portal del Cliente o en el Panel Administrativo.

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre o razón social",
  giro: "Giro o actividad",
  rut: "RUT",
  telefono: "Teléfono",
  correo: "Correo",
  direccion: "Dirección",
  largo_m: "Largo (m)",
  cantidad_planchas: "Cantidad",
  precio_m2: "Precio por m²",
  descuento: "Descuento",
  pago_recibido: "Pago recibido",
  color_id: "Color",
  tipo: "Tipo",
  items: "Planchas",
  stock_m: "Stock (m)",
};

type ZodIssueLike = { code?: string; message?: string; path?: (string | number)[]; validation?: string };

function issueText(issue: ZodIssueLike): string {
  const key = [...(issue.path ?? [])].reverse().find((p) => typeof p === "string" && FIELD_LABELS[p]) as string | undefined;
  const label = key ? FIELD_LABELS[key] : undefined;
  if (issue.validation === "email" || issue.code === "invalid_string") return label ? `${label} inválido` : "Dato inválido";
  if (issue.code === "too_small") return label ? `${label} inválido o incompleto` : "Falta completar un campo";
  if (issue.code === "too_big") return label ? `${label} excede el máximo permitido` : "Valor demasiado grande";
  if (issue.code === "invalid_type") return label ? `${label} es obligatorio` : "Falta completar un campo";
  return label ? `${label} inválido` : (issue.message ?? "Dato inválido");
}

function parseZodIssues(error: unknown): ZodIssueLike[] | null {
  const candidate = (error && typeof error === "object" && Array.isArray((error as { issues?: unknown }).issues))
    ? (error as { issues: ZodIssueLike[] }).issues
    : null;
  if (candidate) return candidate;
  const raw = errorMessage(error).trim();
  if (!raw.startsWith("[") && !raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.issues) ? parsed.issues : null;
    if (!arr || !arr.length) return null;
    if (!arr.some((i: ZodIssueLike) => i && (i.code || i.message))) return null;
    return arr as ZodIssueLike[];
  } catch {
    return null;
  }
}

/** Mensaje corto en español para cualquier error (Zod o normal). */
export function friendlyValidationMessage(error: unknown, fallback = QUOTE_FALLBACK_ERROR_MESSAGE): string {
  const issues = parseZodIssues(error);
  if (issues) {
    const texts = Array.from(new Set(issues.map(issueText))).slice(0, 3);
    return texts.length ? texts.join(" · ") : fallback;
  }
  const message = errorMessage(error).trim();
  if (!message || message.startsWith("[") || message.startsWith("{")) return fallback;
  return message;
}

export function publicQuoteErrorMessage(error: unknown): string {
  if (isLegacyVariantStockError(error)) return QUOTE_FALLBACK_ERROR_MESSAGE;
  const message = errorMessage(error);
  if (LEGACY_VARIANT_ERROR_PATTERN.test(message)) return QUOTE_FALLBACK_ERROR_MESSAGE;
  return friendlyValidationMessage(error);
}


// ── Entrada numérica decimal (compatible con punto y coma, y con todos los teclados móviles) ──
// Un solo lugar define cómo se sanitiza y se parsea un número decimal escrito por el usuario,
// tanto en el Portal del Cliente como en el Panel Administrativo.

/** Props recomendadas para cualquier input decimal (abre teclado numérico con "." y "," en iOS/Android). */
export const DECIMAL_INPUT_PROPS = {
  type: "text" as const,
  inputMode: "decimal" as const,
  autoComplete: "off" as const,
  pattern: "[0-9]*[.,]?[0-9]*",
};

/** Props para enteros (cantidades). */
export const INTEGER_INPUT_PROPS = {
  type: "text" as const,
  inputMode: "numeric" as const,
  autoComplete: "off" as const,
  pattern: "[0-9]*",
};

/**
 * Limpia lo que escribe el usuario sin romper la escritura:
 * mantiene dígitos y un único separador decimal (el primero que se escribió, "." o ",").
 * Nunca elimina los decimales ni convierte "3.5" en "35".
 */
export function sanitizeDecimalInput(raw: string): string {
  const only = (raw ?? "").replace(/[^0-9.,]/g, "");
  const firstSep = only.search(/[.,]/);
  if (firstSep === -1) return only;
  const sep = only[firstSep] as string;
  const head = only.slice(0, firstSep);
  const tail = only.slice(firstSep + 1).replace(/[.,]/g, "");
  return `${head}${sep}${tail}`;
}

/** Igual que sanitizeDecimalInput pero solo dígitos (enteros). */
export function sanitizeIntegerInput(raw: string): string {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

/** Convierte a número aceptando "." o "," como separador decimal. Devuelve `fallback` si no es válido. */
export function parseDecimal(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const s = String(value ?? "").trim().replace(",", ".");
  if (s === "" || s === "." ) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

/** true si el texto representa un número decimal válido (acepta "." y ","). */
export function isValidDecimal(value: unknown): boolean {
  const s = String(value ?? "").trim().replace(",", ".");
  if (s === "") return false;
  return /^\d*\.?\d*$/.test(s) && Number.isFinite(Number(s));
}

// ── RUT del cliente ──────────────────────────────────────────────────────────
// Se guarda SIEMPRE sin puntos y con guión antes del dígito verificador: 12345678-9.
// Es opcional: vacío es válido en el Portal del Cliente y en el Panel Administrativo.

/** Deja solo dígitos y K, en mayúscula (uso interno). */
function rutRaw(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^0-9K]/g, "");
}

/** Sanitiza mientras el usuario escribe: quita puntos/espacios y agrega el guión. */
export function sanitizeRutInput(value: unknown): string {
  const raw = rutRaw(value).slice(0, 9);
  if (raw.length <= 1) return raw;
  return `${raw.slice(0, -1)}-${raw.slice(-1)}`;
}

/** Formato final almacenado: sin puntos, con guión. Vacío si no se informó. */
export function formatRut(value: unknown): string {
  return sanitizeRutInput(value);
}

/** Valida el RUT con módulo 11. Vacío se considera válido (campo opcional). */
export function isValidRut(value: unknown): boolean {
  const raw = rutRaw(value);
  if (raw === "") return true;
  if (raw.length < 8 || raw.length > 9) return false;
  const body = raw.slice(0, -1);
  const dv = raw.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return dv === expected;
}

export const RUT_INVALID_MESSAGE = "RUT inválido (ej: 12345678-5)";

/** Schema Zod reutilizable: opcional, normalizado y validado. */
export const RutSchema = z
  .string()
  .trim()
  .max(20)
  .transform((v) => formatRut(v))
  .refine((v) => isValidRut(v), RUT_INVALID_MESSAGE)
  .optional()
  .default("");

/** IVA chileno: 19%. El total guardado en la cotización es NETO. */
export const IVA_RATE = 0.19;

/** Devuelve el desglose neto / IVA / bruto a partir de un monto neto. */
export function ivaBreakdown(neto: number): { neto: number; iva: number; bruto: number } {
  const base = Math.max(0, Math.round(Number(neto) || 0));
  const iva = Math.round(base * IVA_RATE);
  return { neto: base, iva, bruto: base + iva };
}

/** Neto a partir de un valor bruto (con IVA incluido). */
export function netoFromBruto(bruto: number): number {
  const b = Math.max(0, Number(bruto) || 0);
  return Math.round(b / (1 + IVA_RATE));
}

/** Bruto (con IVA) a partir de un valor neto. */
export function brutoFromNeto(neto: number): number {
  return ivaBreakdown(neto).bruto;
}

/** Modo de precio visible para el cliente. */
export type PrecioClienteModo = "neto" | "bruto";

export function normalizePrecioModo(v: unknown): PrecioClienteModo {
  return v === "bruto" ? "bruto" : "neto";
}

/** Etiqueta corta según el modo de precio visible. */
export function precioModoLabel(modo: PrecioClienteModo): string {
  return modo === "bruto" ? "IVA incluido" : "neto";
}

/** Valor a mostrar al cliente según el modo configurado. */
export function precioParaCliente(neto: number, modo: PrecioClienteModo): number {
  return modo === "bruto" ? brutoFromNeto(neto) : Math.round(Math.max(0, Number(neto) || 0));
}

/** Margen por m²: ganancia en $ y % sobre el precio neto de venta. */
export function margenM2(precioNetoM2: number, costoNetoM2: number): { ganancia: number; pct: number | null } {
  const precio = Number(precioNetoM2) || 0;
  const costo = Number(costoNetoM2) || 0;
  const ganancia = precio - costo;
  return { ganancia, pct: precio > 0 ? (ganancia / precio) * 100 : null };
}

export function formatPct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}


// ============= BOBINAS (lotes de proveedor) =============
/** Ancho útil de la bobina en metros: 1 metro lineal = 1 m². */
export const ANCHO_UTIL_M = 1;
/** Merma estándar por bobina comprada (1%). */
export const MERMA_BOBINA = 0.01;

/** Metros defectuosos válidos (no negativos, nunca más de lo comprado). */
export function metrosDefectuososValidos(metrosComprados: number, defectuosos = 0): number {
  const m = Number(metrosComprados);
  const d = Number(defectuosos);
  if (!Number.isFinite(m) || m <= 0) return 0;
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Number(Math.min(d, m).toFixed(2));
}

/** Metros realmente utilizables: comprados − 1% de merma − metros defectuosos. */
export function metrosUtiles(metrosComprados: number, defectuosos = 0): number {
  const m = Number(metrosComprados);
  if (!Number.isFinite(m) || m <= 0) return 0;
  const d = metrosDefectuososValidos(m, defectuosos);
  return Number(Math.max(m * (1 - MERMA_BOBINA) - d, 0).toFixed(2));
}

/** Metros (y m², ancho útil = 1 m) que se pierden por bobina: merma + defectuosos. */
export function perdidaBobina(metrosComprados: number, defectuosos = 0): number {
  const m = Number(metrosComprados);
  if (!Number.isFinite(m) || m <= 0) return 0;
  const d = metrosDefectuososValidos(m, defectuosos);
  return Number((m * MERMA_BOBINA + d).toFixed(2));
}

/** Costo neto por m² de una bobina: valor pagado / metros útiles. */
export function costoM2Bobina(valorTotal: number, metrosComprados: number, defectuosos = 0): number {
  const utiles = metrosUtiles(metrosComprados, defectuosos);
  const valor = Number(valorTotal);
  if (!utiles || !Number.isFinite(valor)) return 0;
  return Number((valor / utiles).toFixed(2));
}


export type BobinaSaldo = {
  id: string;
  proveedor: string;
  color_id: string | null;
  color_nombre: string | null;
  saldo_m: number;
  costo_m2: number;
  fecha_ingreso: string;
};

/** Bobinas del color indicado, ordenadas FIFO (la más antigua primero). */
export function bobinasDeColor(bobinas: BobinaSaldo[], colorId: string | null | undefined): BobinaSaldo[] {
  if (!colorId) return [];
  return bobinas
    .filter((b) => b.color_id === colorId)
    .sort((a, b) => (a.fecha_ingreso < b.fecha_ingreso ? -1 : a.fecha_ingreso > b.fecha_ingreso ? 1 : 0));
}

/** Sugerencia FIFO: primera bobina del color con saldo suficiente; si no hay, la más antigua con saldo. */
export function sugerenciaFifo(
  bobinas: BobinaSaldo[],
  colorId: string | null | undefined,
  metros: number,
): BobinaSaldo | null {
  const list = bobinasDeColor(bobinas, colorId).filter((b) => b.saldo_m > 0);
  return list.find((b) => b.saldo_m >= metros) ?? list[0] ?? null;
}

export type StockLineaEstado = {
  /** true cuando los metros pedidos exceden el saldo de la bobina asignada. */
  excede: boolean;
  faltante: number;
  saldo: number;
  bobina: BobinaSaldo | null;
};

/** Estado de stock de una línea contra la bobina asignada (o la sugerencia FIFO). */
export function evaluarStockLinea(
  bobinas: BobinaSaldo[],
  colorId: string | null | undefined,
  metros: number,
  bobinaId?: string | null,
): StockLineaEstado {
  const need = Number(metros) || 0;
  const asignada = bobinaId ? bobinas.find((b) => b.id === bobinaId) ?? null : null;
  const bobina = asignada ?? sugerenciaFifo(bobinas, colorId, need);
  const saldo = bobina ? Number(bobina.saldo_m) : 0;
  const faltante = Number(Math.max(0, need - saldo).toFixed(2));
  return { excede: need > 0 && faltante > 0, faltante, saldo, bobina };
}
