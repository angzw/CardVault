import "server-only";
import { roundMoney } from "@/lib/metrics";

/**
 * USD → SGD conversion for TCGplayer prices, which are quoted in US dollars.
 * Uses the ECB reference rate from Frankfurter (no API key). Set USD_SGD_RATE
 * to pin a fixed rate instead.
 */

const FX_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=SGD";
const CACHE_MS = 6 * 60 * 60 * 1000;

export interface FxRate {
  rate: number;
  /** Date the rate applies to (YYYY-MM-DD), or "fixed" for USD_SGD_RATE. */
  asOf: string;
}

let cached: { value: FxRate; fetchedAt: number } | null = null;

export class FxError extends Error {}

export async function getUsdToSgd(): Promise<FxRate> {
  const pinned = Number(process.env.USD_SGD_RATE);
  if (process.env.USD_SGD_RATE && Number.isFinite(pinned) && pinned > 0) {
    return { rate: pinned, asOf: "fixed" };
  }
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;

  try {
    const res = await fetch(FX_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as { date?: string; rates?: { SGD?: number } };
    const rate = body.rates?.SGD;
    if (typeof rate !== "number" || !(rate > 0)) throw new Error("missing SGD rate");
    const value = { rate, asOf: body.date ?? new Date().toISOString().slice(0, 10) };
    cached = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    // A slightly stale rate beats failing the whole price refresh.
    if (cached) return cached.value;
    throw new FxError("Couldn't get the USD→SGD exchange rate. Try again, or set USD_SGD_RATE in .env.");
  }
}

export function usdToSgd(usd: number, fx: FxRate): number {
  return roundMoney(usd * fx.rate);
}
