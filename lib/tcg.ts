import "server-only";

/**
 * Pokémon TCG API (https://pokemontcg.io) helper. Used to auto-complete new
 * cards and refresh TCGplayer market prices. The API works without a key;
 * set POKEMONTCG_API_KEY for higher rate limits.
 */

const API_BASE = "https://api.pokemontcg.io/v2";
const SELECT_FIELDS = "id,name,number,rarity,set,images,tcgplayer";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

/** Variant preference when a card has several TCGplayer price entries. */
const PRICE_VARIANT_ORDER = [
  "holofoil",
  "normal",
  "reverseHolofoil",
  "1stEditionHolofoil",
  "unlimitedHolofoil",
  "1stEditionNormal",
  "unlimited",
  "1stEdition",
] as const;

interface ApiPrice {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
}

export interface ApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: { id: string; name: string; series?: string; releaseDate?: string };
  images?: { small?: string; large?: string };
  tcgplayer?: { url?: string; updatedAt?: string; prices?: Record<string, ApiPrice> };
}

/** Flattened, serializable shape handed to the UI. */
export interface TcgCardSuggestion {
  apiCardId: string;
  name: string;
  cardNumber: string;
  rarity: string | null;
  setName: string;
  releaseDate: string | null;
  imageUrl: string | null;
  /** TCGplayer market price, in US dollars as quoted by the API. */
  marketPriceUsd: number | null;
  priceVariant: string | null;
}

export class TcgApiError extends Error {}

async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.POKEMONTCG_API_KEY;
  if (apiKey) headers["X-Api-Key"] = apiKey;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status === 404) throw new TcgApiError("Card not found on pokemontcg.io.");
      // The public API intermittently returns 5xx/429; those are worth retrying.
      if (res.status >= 500 || res.status === 429) {
        lastError = new TcgApiError(`pokemontcg.io responded with ${res.status}.`);
      } else if (!res.ok) {
        throw new TcgApiError(`pokemontcg.io responded with ${res.status}.`);
      } else {
        return (await res.json()) as T;
      }
    } catch (error) {
      // Non-retryable API answers (404, 4xx) surface immediately; network
      // errors and timeouts get another attempt.
      if (error instanceof TcgApiError) throw error;
      lastError = error;
    }
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  if (lastError instanceof TcgApiError) throw lastError;
  throw new TcgApiError("Could not reach pokemontcg.io. Check your connection and try again.");
}

export function pickMarketPrice(card: ApiCard): { price: number | null; variant: string | null } {
  const prices = card.tcgplayer?.prices;
  if (!prices) return { price: null, variant: null };
  const ordered = [
    ...PRICE_VARIANT_ORDER.filter((v) => v in prices),
    ...Object.keys(prices).filter((v) => !(PRICE_VARIANT_ORDER as readonly string[]).includes(v)),
  ];
  for (const variant of ordered) {
    const p = prices[variant];
    const price = p?.market ?? p?.mid ?? null;
    if (typeof price === "number") return { price, variant };
  }
  return { price: null, variant: null };
}

export function toSuggestion(card: ApiCard): TcgCardSuggestion {
  const { price, variant } = pickMarketPrice(card);
  return {
    apiCardId: card.id,
    name: card.name,
    cardNumber: card.number,
    rarity: card.rarity ?? null,
    setName: card.set.name,
    releaseDate: card.set.releaseDate ?? null,
    imageUrl: card.images?.small ?? card.images?.large ?? null,
    marketPriceUsd: price,
    priceVariant: variant,
  };
}

/** Escape a value for the API's Lucene-like query syntax. */
function quote(value: string): string {
  return `"${value.replace(/["\\]/g, "")}"`;
}

/**
 * Free-text search. Tokens that look like a card number ("4", "215/203",
 * "SWSH050") filter by number; everything else matches the name.
 */
export function buildSearchQuery(input: string): string | null {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const nameParts: string[] = [];
  let number: string | null = null;
  for (const token of tokens) {
    const numberMatch = token.match(/^#?([A-Za-z]{0,6}\d+[A-Za-z]?)(?:\/\w+)?$/);
    if (numberMatch && /\d/.test(token) && number === null && tokens.length > 1) {
      number = numberMatch[1];
    } else {
      nameParts.push(token);
    }
  }
  const name = nameParts.join(" ").replace(/["\\*]/g, "");
  if (!name && !number) return null;
  const clauses: string[] = [];
  if (name) clauses.push(`name:${quote(`${name}*`)}`);
  if (number) clauses.push(`number:${quote(number)}`);
  return clauses.join(" ");
}

export async function searchTcgCards(input: string, pageSize = 24): Promise<TcgCardSuggestion[]> {
  const q = buildSearchQuery(input);
  if (!q) return [];
  const res = await request<{ data: ApiCard[] }>("/cards", {
    q,
    pageSize: String(pageSize),
    orderBy: "-set.releaseDate",
    select: SELECT_FIELDS,
  });
  return res.data.map(toSuggestion);
}

export async function getTcgCard(apiCardId: string): Promise<TcgCardSuggestion> {
  const res = await request<{ data: ApiCard }>(`/cards/${encodeURIComponent(apiCardId)}`, {
    select: SELECT_FIELDS,
  });
  return toSuggestion(res.data);
}

/** Best-effort lookup for a card that was entered manually (no apiCardId). */
export async function findTcgMatch(card: {
  name: string;
  cardNumber: string;
  setName: string;
}): Promise<TcgCardSuggestion | null> {
  const number = card.cardNumber.split("/")[0].trim();
  const res = await request<{ data: ApiCard[] }>("/cards", {
    q: `name:${quote(card.name)} number:${quote(number)}`,
    pageSize: "10",
    select: SELECT_FIELDS,
  });
  const matches = res.data.map(toSuggestion);
  const sameSet = matches.find((m) => m.setName.toLowerCase() === card.setName.toLowerCase());
  return sameSet ?? (matches.length === 1 ? matches[0] : null);
}
