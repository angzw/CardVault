"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { stockAfterChange, roundMoney, type TransactionKind } from "@/lib/metrics";
import {
  findTcgMatch,
  getTcgCard,
  searchTcgCards,
  TcgApiError,
  type TcgCardSuggestion,
} from "@/lib/tcg";
import type { ActionResult } from "@/lib/types";

// Server Actions are public POST endpoints, so every input is re-validated
// here regardless of what the client-side forms already checked.

export interface TransactionInput {
  type: TransactionKind;
  quantity: number;
  unitPrice: number;
  fees: number;
  /** `YYYY-MM-DD` */
  date: string;
  notes?: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; fieldErrors: Record<string, string> };

const MAX_MONEY = 10_000_000;
const MAX_QUANTITY = 100_000;

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  // Allow "today" in any timezone, but not genuinely future dates.
  if (date.getTime() > Date.now() + 36 * 60 * 60 * 1000) return null;
  return date;
}

function parseTransaction(input: unknown) {
  const raw = (input ?? {}) as Partial<Record<keyof TransactionInput, unknown>>;
  const fieldErrors: Record<string, string> = {};

  const type = raw.type === "BUY" || raw.type === "SELL" ? raw.type : null;
  if (!type) fieldErrors.type = "Choose buy or sell.";

  const quantity = Number(raw.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    fieldErrors.quantity = "Enter a whole number of cards, 1 or more.";
  }

  const unitPrice = Number(raw.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_MONEY) {
    fieldErrors.unitPrice = "Enter a price of $0.00 or more.";
  }

  const fees = raw.fees === "" || raw.fees === undefined ? 0 : Number(raw.fees);
  if (!Number.isFinite(fees) || fees < 0 || fees > MAX_MONEY) {
    fieldErrors.fees = "Enter fees of $0.00 or more.";
  }

  const date = parseDate(raw.date);
  if (!date) fieldErrors.date = "Enter a valid date that isn't in the future.";

  const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 500) : "";

  if (Object.keys(fieldErrors).length > 0 || !type || !date) {
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors } as const;
  }
  return {
    ok: true,
    value: {
      type,
      quantity,
      unitPrice: roundMoney(unitPrice),
      fees: roundMoney(fees),
      date,
      notes: notes || null,
    },
  } as const;
}

function oversellWarning(resultingStock: number): ActionResult {
  return {
    ok: false,
    needsConfirmation: true,
    resultingStock,
    error: `This would take stock to ${resultingStock}. Record it anyway?`,
  };
}

function refreshAll() {
  revalidatePath("/", "layout");
}

function tcgErrorMessage(error: unknown): string {
  return error instanceof TcgApiError
    ? error.message
    : "Something went wrong talking to pokemontcg.io. Try again.";
}

export async function recordTransaction(
  cardId: string,
  input: TransactionInput,
  confirmNegativeStock = false,
): Promise<ActionResult> {
  const parsed = parseTransaction(input);
  if (!parsed.ok) return parsed;

  const card = await prisma.card.findUnique({
    where: { id: String(cardId) },
    include: { transactions: { select: { id: true, type: true, quantity: true } } },
  });
  if (!card) return { ok: false, error: "This card no longer exists." };

  const resultingStock = stockAfterChange(card.transactions, { add: parsed.value });
  if (parsed.value.type === "SELL" && resultingStock < 0 && !confirmNegativeStock) {
    return oversellWarning(resultingStock);
  }

  await prisma.transaction.create({ data: { cardId: card.id, ...parsed.value } });
  refreshAll();
  return {
    ok: true,
    message: `Recorded ${parsed.value.type === "BUY" ? "buy" : "sale"} of ${parsed.value.quantity}.`,
  };
}

export async function updateTransaction(
  transactionId: string,
  input: TransactionInput,
  confirmNegativeStock = false,
): Promise<ActionResult> {
  const parsed = parseTransaction(input);
  if (!parsed.ok) return parsed;

  const existing = await prisma.transaction.findUnique({ where: { id: String(transactionId) } });
  if (!existing) return { ok: false, error: "This transaction no longer exists." };

  const ledger = await prisma.transaction.findMany({
    where: { cardId: existing.cardId },
    select: { id: true, type: true, quantity: true },
  });
  const resultingStock = stockAfterChange(ledger, { replaceId: existing.id, add: parsed.value });
  if (resultingStock < 0 && !confirmNegativeStock) return oversellWarning(resultingStock);

  await prisma.transaction.update({ where: { id: existing.id }, data: parsed.value });
  refreshAll();
  return { ok: true, message: "Transaction updated." };
}

export async function deleteTransaction(
  transactionId: string,
  confirmNegativeStock = false,
): Promise<ActionResult> {
  const existing = await prisma.transaction.findUnique({ where: { id: String(transactionId) } });
  if (!existing) return { ok: false, error: "This transaction no longer exists." };

  const ledger = await prisma.transaction.findMany({
    where: { cardId: existing.cardId },
    select: { id: true, type: true, quantity: true },
  });
  const resultingStock = stockAfterChange(ledger, { removeId: existing.id });
  if (resultingStock < 0 && !confirmNegativeStock) return oversellWarning(resultingStock);

  await prisma.transaction.delete({ where: { id: existing.id } });
  refreshAll();
  return { ok: true, message: "Transaction deleted." };
}

export async function fetchMarketPrice(cardId: string): Promise<ActionResult> {
  const card = await prisma.card.findUnique({ where: { id: String(cardId) } });
  if (!card) return { ok: false, error: "This card no longer exists." };

  let match: TcgCardSuggestion | null;
  try {
    match = card.apiCardId ? await getTcgCard(card.apiCardId) : await findTcgMatch(card);
  } catch (error) {
    return { ok: false, error: tcgErrorMessage(error) };
  }
  if (!match) {
    return {
      ok: false,
      error: "No matching card found on pokemontcg.io. Check the name, number and set.",
    };
  }
  if (match.marketPrice === null) {
    return { ok: false, error: "pokemontcg.io has no TCGplayer market price for this card yet." };
  }

  await prisma.card.update({
    where: { id: card.id },
    data: {
      currentMarketPrice: roundMoney(match.marketPrice),
      marketPriceUpdatedAt: new Date(),
      // Link manually entered cards once a match is found, and backfill art.
      apiCardId: card.apiCardId ?? match.apiCardId,
      imageUrl: card.imageUrl ?? match.imageUrl,
      rarity: card.rarity ?? match.rarity,
    },
  });
  refreshAll();
  return { ok: true, message: `Market price updated to $${match.marketPrice.toFixed(2)}.` };
}

export async function searchCatalog(
  query: string,
): Promise<{ ok: true; results: TcgCardSuggestion[] } | { ok: false; error: string }> {
  const q = String(query ?? "").trim().slice(0, 100);
  if (q.length < 2) return { ok: true, results: [] };
  try {
    return { ok: true, results: await searchTcgCards(q) };
  } catch (error) {
    return { ok: false, error: tcgErrorMessage(error) };
  }
}

export interface NewCardInput {
  apiCardId?: string | null;
  name: string;
  cardNumber: string;
  rarity?: string | null;
  setName: string;
  language: string;
  imageUrl?: string | null;
  currentMarketPrice?: number | null;
  /** Optional first purchase recorded together with the card. */
  initialBuy?: Omit<TransactionInput, "type"> | null;
}

function parseNewCard(input: unknown): Parsed<Omit<NewCardInput, "initialBuy">> {
  const raw = (input ?? {}) as Partial<Record<keyof NewCardInput, unknown>>;
  const text = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const fieldErrors: Record<string, string> = {};

  const name = text(raw.name);
  const cardNumber = text(raw.cardNumber, 30);
  const setName = text(raw.setName);
  const language = text(raw.language, 40) || "English";
  if (!name) fieldErrors.name = "Enter the card name.";
  if (!cardNumber) fieldErrors.cardNumber = "Enter the card number.";
  if (!setName) fieldErrors.setName = "Enter the set name.";

  const imageUrl = text(raw.imageUrl, 500) || null;
  if (imageUrl && !/^https:\/\/\S+$/.test(imageUrl)) fieldErrors.imageUrl = "Use an https:// image URL.";

  let currentMarketPrice: number | null = null;
  if (raw.currentMarketPrice !== null && raw.currentMarketPrice !== undefined && raw.currentMarketPrice !== "") {
    const price = Number(raw.currentMarketPrice);
    if (!Number.isFinite(price) || price < 0 || price > MAX_MONEY) {
      fieldErrors.currentMarketPrice = "Enter a price of $0.00 or more.";
    } else {
      currentMarketPrice = roundMoney(price);
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  return {
    ok: true,
    value: {
      apiCardId: text(raw.apiCardId, 60) || null,
      name,
      cardNumber,
      rarity: text(raw.rarity, 60) || null,
      setName,
      language,
      imageUrl,
      currentMarketPrice,
    },
  };
}

export type CreateCardResult =
  | { ok: true; cardId: string; existing: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Creates a card (and optionally its first BUY). The caller navigates to it. */
export async function createCard(input: NewCardInput): Promise<CreateCardResult> {
  const parsedCard = parseNewCard(input);
  if (!parsedCard.ok) return parsedCard;

  let initialBuy = null;
  if (input?.initialBuy) {
    const parsedBuy = parseTransaction({ ...input.initialBuy, type: "BUY" });
    if (!parsedBuy.ok) {
      return {
        ok: false,
        error: parsedBuy.error,
        fieldErrors: Object.fromEntries(
          Object.entries(parsedBuy.fieldErrors).map(([k, v]) => [`buy.${k}`, v]),
        ),
      };
    }
    initialBuy = parsedBuy.value;
  }

  const { apiCardId, language } = parsedCard.value;
  // Same printing + language already in the vault: add to it instead of duplicating.
  const existing = apiCardId
    ? await prisma.card.findFirst({ where: { apiCardId, language } })
    : null;

  const card =
    existing ??
    (await prisma.card.create({
      data: {
        ...parsedCard.value,
        marketPriceUpdatedAt: parsedCard.value.currentMarketPrice !== null ? new Date() : null,
      },
    }));

  if (initialBuy) {
    await prisma.transaction.create({ data: { cardId: card.id, ...initialBuy } });
  }

  refreshAll();
  return { ok: true, cardId: card.id, existing: existing !== null };
}
