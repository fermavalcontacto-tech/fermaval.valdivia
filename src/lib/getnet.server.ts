/**
 * Getnet Chile Web Checkout — servicio compartido.
 * Motor PlacetoPay (login + secretKey + SHA-256). NO OAuth.
 * Nunca loguear secretKey/login.
 */
import { createHash, randomBytes } from "crypto";

export function getnetEndpoint(): string {
  const base = process.env.GETNET_API_URL?.replace(/\/$/, "");
  if (base) return `${base}/api/session`;
  return process.env.GETNET_ENDPOINT ?? "https://checkout.test.getnet.cl/api/session";
}

export function buildGetnetAuth(login: string, secretKey: string) {
  const nonceBytes = randomBytes(16);
  const nonceB64 = nonceBytes.toString("base64");
  const seed = new Date().toISOString();
  const hash = createHash("sha256")
    .update(Buffer.concat([nonceBytes, Buffer.from(seed + secretKey, "utf8")]))
    .digest();
  return { login, tranKey: hash.toString("base64"), nonce: nonceB64, seed };
}

export type GetnetSessionResponse = {
  status?: { status?: string; message?: string; date?: string; reason?: string };
  request?: {
    payment?: { reference?: string; amount?: { currency?: string; total?: number } };
    expiration?: string;
  };
  payment?: Array<{
    status?: { status?: string; date?: string; message?: string; reason?: string };
    amount?: {
      from?: { currency?: string; total?: number };
      to?: { currency?: string; total?: number };
    };
    receipt?: string | number;
    reference?: string;
    authorization?: string;
    paymentMethod?: string;
    processingDate?: string;
  }>;
};

/**
 * Consulta autoritativa del estado de una sesión Getnet por requestId.
 * Devuelve el JSON completo. El caller decide qué hacer con `status.status`
 * y con `payment[]` (montos aprobados).
 */
export async function fetchGetnetSession(
  requestId: number | string,
  login: string,
  secretKey: string,
): Promise<GetnetSessionResponse | null> {
  try {
    const url = `${getnetEndpoint().replace(/\/$/, "")}/${encodeURIComponent(String(requestId))}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth: buildGetnetAuth(login, secretKey) }),
    });
    if (!res.ok) return null;
    return (await res.json()) as GetnetSessionResponse;
  } catch {
    return null;
  }
}

/**
 * Extrae total aprobado (suma de pagos APPROVED).
 */
export function totalApproved(resp: GetnetSessionResponse | null): number {
  if (!resp?.payment?.length) return 0;
  return resp.payment
    .filter((p) => p.status?.status === "APPROVED")
    .reduce(
      (acc, p) => acc + Math.round(Number(p.amount?.to?.total ?? p.amount?.from?.total ?? 0)),
      0,
    );
}

/**
 * Mapea el estado bruto de Getnet al vocabulario interno.
 */
export function mapGetnetStatus(raw: string | undefined | null): string {
  if (!raw) return "Pendiente";
  const s = raw.toUpperCase();
  if (s === "APPROVED") return "Pagado";
  if (s === "PENDING") return "Pendiente";
  if (s === "REJECTED" || s === "FAILED") return "Rechazado";
  if (s === "EXPIRED") return "Expirado";
  if (s === "REFUNDED") return "Reembolsado";
  if (s === "ANULLED" || s === "ANNULLED") return "Anulado";
  return raw;
}

/**
 * Log de eventos Getnet — jamás incluir credenciales.
 */
export function getnetLog(event: string, data: Record<string, unknown> = {}) {
  console.log(`[getnet] ${event}`, JSON.stringify(data));
}
