import type { CardMetrics, TransactionKind } from "./metrics";

/** Serializable card master fields passed from server to client components. */
export interface CardInfo {
  id: string;
  apiCardId: string | null;
  name: string;
  cardNumber: string;
  rarity: string | null;
  setName: string;
  language: string;
  imageUrl: string | null;
  currentMarketPrice: number | null;
  marketPriceUpdatedAt: string | null;
}

export interface TransactionRow {
  id: string;
  cardId: string;
  type: TransactionKind;
  quantity: number;
  unitPrice: number;
  fees: number;
  /** ISO timestamp (UTC midnight of the transaction day). */
  date: string;
  notes: string | null;
}

export interface VaultRow extends CardInfo {
  metrics: CardMetrics;
}

export interface RecentTransaction extends TransactionRow {
  card: CardInfo;
}

/** Result shape returned by every mutating server action. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | { ok: false; needsConfirmation: true; resultingStock: number; error: string };

export const LANGUAGES = [
  "English",
  "Japanese",
  "Korean",
  "Simplified Chinese (China)",
  "Traditional Chinese (Taiwan / Hong Kong)",
  "French",
  "German",
  "Italian",
  "Spanish",
  "Portuguese",
] as const;
