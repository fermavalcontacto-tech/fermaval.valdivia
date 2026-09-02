/**
 * Folio correlativo único para cotizaciones (admin y portal público).
 * Usa el contador de la base de datos: FV-00001, FV-00002, ...
 */
type RpcClient = { rpc: (fn: "nextval_quote") => Promise<{ data: unknown; error: unknown }> };

export function formatQuoteNumber(seq: number): string {
  return "FV-" + String(seq).padStart(5, "0");
}

export async function nextQuoteNumber(client: RpcClient): Promise<string> {
  let lastErr: unknown = null;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await client.rpc("nextval_quote");
    if (!error && data != null) return formatQuoteNumber(Number(data));
    lastErr = error;
  }
  console.error("[nextQuoteNumber] no se pudo obtener el folio", lastErr);
  throw new Error("No se pudo generar el número de cotización. Intenta nuevamente.");
}

/** true cuando el error de insert corresponde a folio duplicado */
export function isDuplicateNumeroError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === "23505" || /numero/i.test(e.message ?? "") && /duplicat|unique/i.test(e.message ?? "");
}
