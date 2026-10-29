import { Suspense } from "react";
import Link from "next/link";
import { CardThumb, EmptyState, Panel, Skeleton, TypeBadge } from "@/components/ui";
import { getDashboardData } from "@/lib/data";
import { formatDate, formatInt, formatMoney, formatPct, formatSignedMoney, pnlTone } from "@/lib/format";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const { summary, recent, cardCount } = await getDashboardData();

  return (
    <>
      <KpiStrip summary={summary} />

      <Panel
        title="Recent transactions"
        actions={
          <Link href="/vault" className="text-sm text-ink-muted hover:text-ink">
            Open vault
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState title={cardCount === 0 ? "Nothing tracked yet" : "No transactions yet"}>
            Use Add card in the header to log your first purchase.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Image</span>
                  </th>
                  <th>Card</th>
                  <th>Number</th>
                  <th>Rarity</th>
                  <th>Set</th>
                  <th>Language</th>
                  <th>Type</th>
                  <th className="num">Quantity</th>
                  <th className="num">Unit price</th>
                  <th className="num">Fees</th>
                  <th className="num">Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="w-12 py-1.5!">
                      <CardThumb src={t.card.imageUrl} alt={t.card.name} width={30} />
                    </td>
                    <td>
                      <Link href={`/card/${t.card.id}`} className="font-medium hover:text-buy hover:underline">
                        {t.card.name}
                      </Link>
                    </td>
                    <td>{t.card.cardNumber}</td>
                    <td className="text-ink-muted">{t.card.rarity ?? "—"}</td>
                    <td>{t.card.setName}</td>
                    <td className="text-ink-muted">{t.card.language}</td>
                    <td>
                      <TypeBadge type={t.type} />
                    </td>
                    <td className="num">{t.quantity}</td>
                    <td className="num">{formatMoney(t.unitPrice)}</td>
                    <td className="num text-ink-muted">{formatMoney(t.fees)}</td>
                    <td className="num text-ink-muted">{formatDate(t.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

type Summary = Awaited<ReturnType<typeof getDashboardData>>["summary"];

/**
 * Portfolio market value leads; the other five figures sit beside it as one
 * segmented strip, read left to right like a ticker.
 */
function KpiStrip({ summary }: { summary: Summary }) {
  const unrealizedTone = pnlTone(summary.totalUnrealizedPnl);
  const metrics = [
    { label: "Capital invested", value: formatMoney(summary.totalCapitalInvested), note: "All buys incl. fees" },
    { label: "Sales revenue", value: formatMoney(summary.totalSalesRevenue), note: "Gross, before fees" },
    {
      label: "Net realized profit",
      value: formatSignedMoney(summary.netRealizedProfit),
      tone: pnlTone(summary.netRealizedProfit),
      note: `After ${formatMoney(summary.totalFees)} in fees`,
    },
    {
      label: "Overall ROI",
      value: formatPct(summary.overallRoiPct),
      tone: pnlTone(summary.overallRoiPct),
      note: "Realized profit ÷ capital",
    },
    { label: "Cards in stock", value: formatInt(summary.activeCardsInStock), note: "Physical copies held" },
  ];

  return (
    <section
      aria-label="Portfolio summary"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-[minmax(280px,1.3fr)_repeat(5,minmax(0,1fr))]"
    >
      <div className="relative col-span-2 bg-panel p-5 lg:col-span-1">
        <span aria-hidden className="foil-bar absolute inset-y-0 left-0 w-[3px]" />
        <p className="text-sm text-ink-muted">Portfolio market value</p>
        <p className="mt-1 font-condensed text-4xl font-semibold tracking-tight">
          {formatMoney(summary.portfolioMarketValue)}
        </p>
        <p className="mt-1.5 text-sm">
          <span className={unrealizedTone}>{formatSignedMoney(summary.totalUnrealizedPnl)}</span>
          <span className="text-ink-muted"> unrealized</span>
          {summary.unpricedCardsInStock > 0 && (
            <span className="block text-xs text-warn">
              {summary.unpricedCardsInStock} {summary.unpricedCardsInStock === 1 ? "card has" : "cards have"} no market price
            </span>
          )}
        </p>
      </div>
      <dl className="contents">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-col justify-between gap-2 bg-panel p-4 last:col-span-2 lg:last:col-span-1"
          >
            <dt className="text-sm text-ink-muted">{m.label}</dt>
            <dd>
              <span className={`block font-condensed text-2xl font-semibold tracking-tight ${m.tone ?? ""}`}>
                {m.value}
              </span>
              <span className="mt-0.5 block text-xs text-ink-faint">{m.note}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
