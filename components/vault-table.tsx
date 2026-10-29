"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { CardThumb, EmptyState, Pnl } from "@/components/ui";
import { formatInt, formatMoney, formatSignedMoney, pnlTone } from "@/lib/format";
import type { VaultRow } from "@/lib/types";

type SortKey = "name" | "stock" | "avgBuy" | "costBasis" | "market" | "pnl";

const SORTERS: Record<SortKey, (r: VaultRow) => number | string> = {
  name: (r) => r.name.toLowerCase(),
  stock: (r) => r.metrics.quantityInStock,
  avgBuy: (r) => r.metrics.averageBuyPrice ?? -Infinity,
  costBasis: (r) => r.metrics.totalCostBasis,
  market: (r) => r.currentMarketPrice ?? -Infinity,
  pnl: (r) => r.metrics.unrealizedPnl ?? -Infinity,
};

type SortState = { key: SortKey; dir: 1 | -1 };

function SortHeader({
  k,
  label,
  sort,
  onSort,
  numeric = true,
}: {
  k: SortKey;
  label: string;
  sort: SortState;
  onSort: (next: SortState) => void;
  numeric?: boolean;
}) {
  const active = sort.key === k;
  const Icon = sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={numeric ? "num" : undefined} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        // Numbers default to largest-first, names to A–Z.
        onClick={() => onSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : numeric ? -1 : 1 })}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        {active && <Icon aria-hidden className="h-3 w-3" />}
      </button>
    </th>
  );
}

export function VaultTable({ rows }: { rows: VaultRow[] }) {
  const [query, setQuery] = useState("");
  const [setName, setSetName] = useState("");
  const [language, setLanguage] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sort, setSort] = useState<SortState>({ key: "name", dir: 1 });
  const deferredQuery = useDeferredValue(query);

  const sets = useMemo(() => [...new Set(rows.map((r) => r.setName))].sort(), [rows]);
  const languages = useMemo(() => [...new Set(rows.map((r) => r.language))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const result = rows.filter(
      (r) =>
        (!inStockOnly || r.metrics.quantityInStock > 0) &&
        (!setName || r.setName === setName) &&
        (!language || r.language === language) &&
        (!q || r.name.toLowerCase().includes(q) || r.cardNumber.toLowerCase().includes(q)),
    );
    const getter = SORTERS[sort.key];
    return result.sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [rows, deferredQuery, setName, language, inStockOnly, sort]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          stock: acc.stock + Math.max(r.metrics.quantityInStock, 0),
          costBasis: acc.costBasis + r.metrics.totalCostBasis,
          marketValue: acc.marketValue + (r.metrics.marketValue ?? 0),
          pnl: acc.pnl + (r.metrics.unrealizedPnl ?? 0),
        }),
        { stock: 0, costBasis: 0, marketValue: 0, pnl: 0 },
      ),
    [filtered],
  );

  const filtersActive = query !== "" || setName !== "" || language !== "";

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <label htmlFor="vault-search" className="sr-only">
            Search by card name or number
          </label>
          <input
            id="vault-search"
            type="search"
            className="field-input pl-8"
            placeholder="Search name or number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="vault-set" className="sr-only">
            Set
          </label>
          <select id="vault-set" className="field-input w-auto min-w-40" value={setName} onChange={(e) => setSetName(e.target.value)}>
            <option value="">All sets</option>
            {sets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label htmlFor="vault-language" className="sr-only">
            Language
          </label>
          <select
            id="vault-language"
            className="field-input w-auto min-w-32"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSetName("");
                setLanguage("");
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-ink-muted hover:text-ink"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Which cards to show"
          className="grid grid-cols-2 rounded-md border border-line-strong bg-canvas p-0.5 text-sm lg:ml-auto"
        >
          {[
            { value: true, label: "In stock only" },
            { value: false, label: "All cards ever owned" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={inStockOnly === opt.value}
              onClick={() => setInStockOnly(opt.value)}
              className={`rounded px-3 py-1.5 whitespace-nowrap ${
                inStockOnly === opt.value ? "bg-raised font-medium text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState title="Your vault is empty">Use Add card in the header to start tracking.</EmptyState>
        ) : (
          <EmptyState title="No cards match these filters">
            {inStockOnly ? "Try “All cards ever owned” or clear the search." : "Try a different search or clear the filters."}
          </EmptyState>
        )
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Image</span>
                </th>
                <SortHeader k="name" label="Card" numeric={false} sort={sort} onSort={setSort} />
                <th>Number</th>
                <th>Rarity</th>
                <th>Set</th>
                <th>Language</th>
                <SortHeader k="stock" label="In stock" sort={sort} onSort={setSort} />
                <SortHeader k="avgBuy" label="Avg buy" sort={sort} onSort={setSort} />
                <SortHeader k="costBasis" label="Cost basis" sort={sort} onSort={setSort} />
                <SortHeader k="market" label="Market price" sort={sort} onSort={setSort} />
                <SortHeader k="pnl" label="Unrealized P&L" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={r.metrics.quantityInStock <= 0 ? "text-ink-muted" : undefined}>
                  <td className="w-12 py-1.5!">
                    <CardThumb src={r.imageUrl} alt={r.name} width={30} />
                  </td>
                  <td>
                    <Link href={`/card/${r.id}`} className="font-medium text-ink hover:text-buy hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.cardNumber}</td>
                  <td className="text-ink-muted">{r.rarity ?? "—"}</td>
                  <td>{r.setName}</td>
                  <td className="text-ink-muted">{r.language}</td>
                  <td className={`num font-medium ${r.metrics.quantityInStock < 0 ? "text-warn" : ""}`}>
                    {r.metrics.quantityInStock}
                  </td>
                  <td className="num">{formatMoney(r.metrics.averageBuyPrice)}</td>
                  <td className="num">{formatMoney(r.metrics.totalCostBasis)}</td>
                  <td className="num">{formatMoney(r.currentMarketPrice)}</td>
                  <td className="num">
                    {r.metrics.quantityInStock > 0 ? (
                      <Pnl value={r.metrics.unrealizedPnl} pct={r.metrics.unrealizedPnlPct} />
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td colSpan={6} className="border-t border-line-strong text-ink-muted">
                  {filtered.length} {filtered.length === 1 ? "card" : "cards"} shown
                </td>
                <td className="num border-t border-line-strong">{formatInt(totals.stock)}</td>
                <td className="border-t border-line-strong" />
                <td className="num border-t border-line-strong">{formatMoney(totals.costBasis)}</td>
                <td className="num border-t border-line-strong text-ink-muted">{formatMoney(totals.marketValue)}</td>
                <td className={`num border-t border-line-strong ${pnlTone(totals.pnl)}`}>
                  {formatSignedMoney(totals.pnl)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
