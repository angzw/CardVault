import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import type { Card, Transaction } from "@/lib/generated/prisma/client";
import { computeCardMetrics, computePortfolioSummary } from "@/lib/metrics";
import type { CardInfo, RecentTransaction, TransactionRow, VaultRow } from "@/lib/types";

// better-sqlite3 is synchronous, so queries would otherwise complete during
// prerendering. `connection()` keeps every read at request time, which is what
// lets ledger changes show up immediately on every page.

function toCardInfo(card: Card): CardInfo {
  return {
    id: card.id,
    apiCardId: card.apiCardId,
    name: card.name,
    cardNumber: card.cardNumber,
    rarity: card.rarity,
    setName: card.setName,
    language: card.language,
    imageUrl: card.imageUrl,
    currentMarketPrice: card.currentMarketPrice,
    marketPriceUpdatedAt: card.marketPriceUpdatedAt?.toISOString() ?? null,
  };
}

function toTransactionRow(t: Transaction): TransactionRow {
  return {
    id: t.id,
    cardId: t.cardId,
    type: t.type,
    quantity: t.quantity,
    unitPrice: t.unitPrice,
    fees: t.fees,
    date: t.date.toISOString(),
    notes: t.notes,
  };
}

export async function getDashboardData() {
  await connection();
  const [cards, recent] = await Promise.all([
    prisma.card.findMany({ include: { transactions: true } }),
    prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: { card: true },
    }),
  ]);

  return {
    summary: computePortfolioSummary(cards),
    cardCount: cards.length,
    recent: recent.map(
      (t): RecentTransaction => ({ ...toTransactionRow(t), card: toCardInfo(t.card) }),
    ),
  };
}

export async function getVaultRows(): Promise<VaultRow[]> {
  await connection();
  const cards = await prisma.card.findMany({
    include: { transactions: true },
    orderBy: [{ name: "asc" }, { setName: "asc" }],
  });
  return cards.map((card) => ({
    ...toCardInfo(card),
    metrics: computeCardMetrics(card.transactions, card.currentMarketPrice),
  }));
}

export async function getCardDetail(id: string) {
  await connection();
  const card = await prisma.card.findUnique({
    where: { id },
    include: { transactions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] } },
  });
  if (!card) return null;
  return {
    card: toCardInfo(card),
    metrics: computeCardMetrics(card.transactions, card.currentMarketPrice),
    transactions: card.transactions.map(toTransactionRow),
  };
}
