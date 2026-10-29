/**
 * Pure calculation layer. Every holding / P&L figure in the app is derived
 * from the transaction ledger here — nothing is stored denormalized.
 *
 * Conventions:
 * - `unitPrice` never includes fees. Fees are tracked per transaction and
 *   deducted in full (buy + sell fees) from realized profit.
 * - Cost of sold units uses the weighted average buy price.
 * - Ratios whose denominator is zero are `null` (rendered as "—").
 */

export type TransactionKind = "BUY" | "SELL";

export interface LedgerEntry {
  type: TransactionKind;
  quantity: number;
  unitPrice: number;
  fees: number;
}

export interface CardMetrics {
  quantityBought: number;
  totalBuyCost: number;
  averageBuyPrice: number | null;
  quantitySold: number;
  totalRevenue: number;
  averageSellPrice: number | null;
  quantityInStock: number;
  totalCostBasis: number;
  costOfSoldUnits: number;
  buyFees: number;
  sellFees: number;
  totalFees: number;
  realizedProfit: number;
  marginPct: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
}

export interface PortfolioSummary {
  totalCapitalInvested: number;
  totalSalesRevenue: number;
  netRealizedProfit: number;
  overallRoiPct: number | null;
  activeCardsInStock: number;
  portfolioMarketValue: number;
  totalUnrealizedPnl: number;
  totalFees: number;
  /** Physical cards in stock whose card has no market price yet. */
  unpricedCardsInStock: number;
}

/** Round to cents to strip floating point noise from money values. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Returns null instead of Infinity/NaN when the denominator is zero. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !Number.isFinite(denominator)) return null;
  return numerator / denominator;
}

function pct(numerator: number, denominator: number): number | null {
  const ratio = safeDivide(numerator, denominator);
  return ratio === null ? null : ratio * 100;
}

export function computeCardMetrics(
  transactions: readonly LedgerEntry[],
  currentMarketPrice: number | null,
): CardMetrics {
  let quantityBought = 0;
  let quantitySold = 0;
  let totalBuyCost = 0;
  let totalRevenue = 0;
  let buyFees = 0;
  let sellFees = 0;

  for (const t of transactions) {
    const gross = t.quantity * t.unitPrice;
    if (t.type === "BUY") {
      quantityBought += t.quantity;
      totalBuyCost += gross;
      buyFees += t.fees;
    } else {
      quantitySold += t.quantity;
      totalRevenue += gross;
      sellFees += t.fees;
    }
  }

  const rawAvgBuy = safeDivide(totalBuyCost, quantityBought);
  const rawAvgSell = safeDivide(totalRevenue, quantitySold);
  const quantityInStock = quantityBought - quantitySold;
  // An oversold position (allowed after confirmation) holds nothing to value.
  const heldQuantity = Math.max(quantityInStock, 0);
  const costOfSoldUnits = (rawAvgBuy ?? 0) * quantitySold;
  const totalFees = buyFees + sellFees;
  const realizedProfit = totalRevenue - costOfSoldUnits - totalFees;
  const totalCostBasis = (rawAvgBuy ?? 0) * heldQuantity;

  let marketValue: number | null = null;
  let unrealizedPnl: number | null = null;
  let unrealizedPnlPct: number | null = null;
  if (currentMarketPrice !== null) {
    marketValue = currentMarketPrice * heldQuantity;
    unrealizedPnl = (currentMarketPrice - (rawAvgBuy ?? 0)) * heldQuantity;
    if (heldQuantity > 0) unrealizedPnlPct = pct(unrealizedPnl, totalCostBasis);
  }

  return {
    quantityBought,
    totalBuyCost: roundMoney(totalBuyCost),
    averageBuyPrice: rawAvgBuy === null ? null : roundMoney(rawAvgBuy),
    quantitySold,
    totalRevenue: roundMoney(totalRevenue),
    averageSellPrice: rawAvgSell === null ? null : roundMoney(rawAvgSell),
    quantityInStock,
    totalCostBasis: roundMoney(totalCostBasis),
    costOfSoldUnits: roundMoney(costOfSoldUnits),
    buyFees: roundMoney(buyFees),
    sellFees: roundMoney(sellFees),
    totalFees: roundMoney(totalFees),
    realizedProfit: roundMoney(realizedProfit),
    marginPct: pct(realizedProfit, totalRevenue),
    marketValue: marketValue === null ? null : roundMoney(marketValue),
    unrealizedPnl: unrealizedPnl === null ? null : roundMoney(unrealizedPnl),
    unrealizedPnlPct,
  };
}

export function computePortfolioSummary(
  cards: readonly {
    transactions: readonly LedgerEntry[];
    currentMarketPrice: number | null;
  }[],
): PortfolioSummary {
  let totalCapitalInvested = 0;
  let totalSalesRevenue = 0;
  let netRealizedProfit = 0;
  let activeCardsInStock = 0;
  let portfolioMarketValue = 0;
  let totalUnrealizedPnl = 0;
  let totalFees = 0;
  let unpricedCardsInStock = 0;

  for (const card of cards) {
    const m = computeCardMetrics(card.transactions, card.currentMarketPrice);
    totalCapitalInvested += m.totalBuyCost + m.buyFees;
    totalSalesRevenue += m.totalRevenue;
    netRealizedProfit += m.realizedProfit;
    totalFees += m.totalFees;
    const held = Math.max(m.quantityInStock, 0);
    activeCardsInStock += held;
    if (m.marketValue === null) unpricedCardsInStock += held;
    portfolioMarketValue += m.marketValue ?? 0;
    totalUnrealizedPnl += m.unrealizedPnl ?? 0;
  }

  return {
    totalCapitalInvested: roundMoney(totalCapitalInvested),
    totalSalesRevenue: roundMoney(totalSalesRevenue),
    netRealizedProfit: roundMoney(netRealizedProfit),
    overallRoiPct: pct(netRealizedProfit, totalCapitalInvested),
    activeCardsInStock,
    portfolioMarketValue: roundMoney(portfolioMarketValue),
    totalUnrealizedPnl: roundMoney(totalUnrealizedPnl),
    totalFees: roundMoney(totalFees),
    unpricedCardsInStock,
  };
}

/**
 * Stock level that would result from adding, replacing or removing a ledger
 * entry. Used to warn before a change pushes a card's stock below zero.
 */
export function stockAfterChange(
  ledger: readonly (Pick<LedgerEntry, "type" | "quantity"> & { id: string })[],
  change: {
    add?: Pick<LedgerEntry, "type" | "quantity">;
    replaceId?: string;
    removeId?: string;
  },
): number {
  const skip = change.replaceId ?? change.removeId;
  let stock = 0;
  for (const t of ledger) {
    if (t.id === skip) continue;
    stock += t.type === "BUY" ? t.quantity : -t.quantity;
  }
  if (change.add) {
    stock += change.add.type === "BUY" ? change.add.quantity : -change.add.quantity;
  }
  return stock;
}
