import { describe, expect, it } from "vitest";
import {
  computeCardMetrics,
  computePortfolioSummary,
  stockAfterChange,
  type LedgerEntry,
} from "./metrics";

const buy = (quantity: number, unitPrice: number, fees = 0): LedgerEntry => ({
  type: "BUY",
  quantity,
  unitPrice,
  fees,
});
const sell = (quantity: number, unitPrice: number, fees = 0): LedgerEntry => ({
  type: "SELL",
  quantity,
  unitPrice,
  fees,
});

describe("computeCardMetrics", () => {
  it("returns zeros and nulls for a card with no transactions", () => {
    const m = computeCardMetrics([], null);
    expect(m.quantityBought).toBe(0);
    expect(m.quantitySold).toBe(0);
    expect(m.quantityInStock).toBe(0);
    expect(m.averageBuyPrice).toBeNull();
    expect(m.averageSellPrice).toBeNull();
    expect(m.totalCostBasis).toBe(0);
    expect(m.realizedProfit).toBe(0);
    expect(m.marginPct).toBeNull();
    expect(m.unrealizedPnl).toBeNull();
    expect(m.unrealizedPnlPct).toBeNull();
  });

  it("computes weighted average buy price across multiple buys", () => {
    const m = computeCardMetrics([buy(2, 100), buy(1, 160)], null);
    expect(m.quantityBought).toBe(3);
    expect(m.totalBuyCost).toBe(360);
    expect(m.averageBuyPrice).toBe(120);
    expect(m.quantityInStock).toBe(3);
    expect(m.totalCostBasis).toBe(360);
  });

  it("computes sell side, realized profit and margin using average cost", () => {
    // avg buy = 120; sell 2 @ 200 with 10 sell fee; 5 buy fee
    const m = computeCardMetrics(
      [buy(2, 100, 5), buy(1, 160), sell(2, 200, 10)],
      null,
    );
    expect(m.quantitySold).toBe(2);
    expect(m.totalRevenue).toBe(400);
    expect(m.averageSellPrice).toBe(200);
    expect(m.quantityInStock).toBe(1);
    expect(m.costOfSoldUnits).toBe(240);
    expect(m.totalFees).toBe(15);
    // 400 - 240 - 15
    expect(m.realizedProfit).toBe(145);
    expect(m.marginPct).toBeCloseTo(36.25);
    expect(m.totalCostBasis).toBe(120);
  });

  it("computes unrealized P&L against current market price", () => {
    const m = computeCardMetrics([buy(4, 50), sell(1, 80)], 75);
    expect(m.quantityInStock).toBe(3);
    expect(m.unrealizedPnl).toBe(75);
    expect(m.unrealizedPnlPct).toBe(50);
    expect(m.marketValue).toBe(225);
  });

  it("guards division by zero when cost is zero", () => {
    const m = computeCardMetrics([buy(2, 0)], 10);
    expect(m.averageBuyPrice).toBe(0);
    expect(m.unrealizedPnl).toBe(20);
    expect(m.unrealizedPnlPct).toBeNull();
  });

  it("guards margin when revenue is zero", () => {
    const m = computeCardMetrics([buy(1, 10), sell(1, 0, 1)], null);
    expect(m.totalRevenue).toBe(0);
    expect(m.realizedProfit).toBe(-11);
    expect(m.marginPct).toBeNull();
  });

  it("does not report unrealized P&L when nothing is in stock", () => {
    const m = computeCardMetrics([buy(1, 10), sell(1, 20)], 30);
    expect(m.quantityInStock).toBe(0);
    expect(m.unrealizedPnl).toBe(0);
    expect(m.marketValue).toBe(0);
  });

  it("rounds away floating point noise to cents", () => {
    const m = computeCardMetrics([buy(3, 0.1), buy(3, 0.2)], null);
    expect(m.totalBuyCost).toBe(0.9);
    expect(m.averageBuyPrice).toBe(0.15);
  });

  it("tolerates oversold positions without negative cost basis", () => {
    const m = computeCardMetrics([buy(1, 10), sell(2, 20)], 15);
    expect(m.quantityInStock).toBe(-1);
    expect(m.totalCostBasis).toBe(0);
    expect(m.marketValue).toBe(0);
    expect(m.unrealizedPnl).toBe(0);
  });
});

describe("computePortfolioSummary", () => {
  it("returns zeros and null ROI for an empty portfolio", () => {
    const s = computePortfolioSummary([]);
    expect(s.totalCapitalInvested).toBe(0);
    expect(s.totalSalesRevenue).toBe(0);
    expect(s.netRealizedProfit).toBe(0);
    expect(s.overallRoiPct).toBeNull();
    expect(s.activeCardsInStock).toBe(0);
    expect(s.portfolioMarketValue).toBe(0);
  });

  it("aggregates every card's ledger", () => {
    const s = computePortfolioSummary([
      { transactions: [buy(2, 100, 5), sell(1, 150, 3)], currentMarketPrice: 120 },
      { transactions: [buy(3, 20)], currentMarketPrice: null },
    ]);
    // capital = 200 + 5 + 60
    expect(s.totalCapitalInvested).toBe(265);
    expect(s.totalSalesRevenue).toBe(150);
    // card1 realized = 150 - 100 - 8 = 42; card2 = 0
    expect(s.netRealizedProfit).toBe(42);
    expect(s.overallRoiPct).toBeCloseTo((42 / 265) * 100);
    expect(s.activeCardsInStock).toBe(4);
    // only priced holdings count toward market value
    expect(s.portfolioMarketValue).toBe(120);
    expect(s.totalFees).toBe(8);
    expect(s.unpricedCardsInStock).toBe(3);
  });
});

describe("stockAfterChange", () => {
  const ledger = [
    { id: "a", ...buy(3, 10) },
    { id: "b", ...sell(1, 20) },
  ];

  it("applies a new entry", () => {
    expect(stockAfterChange(ledger, { add: sell(5, 1) })).toBe(-3);
  });

  it("replaces an edited entry", () => {
    expect(stockAfterChange(ledger, { replaceId: "a", add: buy(1, 10) })).toBe(0);
  });

  it("removes a deleted entry", () => {
    expect(stockAfterChange(ledger, { removeId: "a" })).toBe(-1);
  });
});
