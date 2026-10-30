import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CardActions, TransactionHistory } from "@/components/card-ledger";
import { CardImageEditor } from "@/components/card-image-editor";
import { CardManage } from "@/components/card-manage";
import { Notice } from "@/components/form-controls";
import { Breadcrumbs, CardThumb, Panel, Pnl, Skeleton } from "@/components/ui";
import { getCardDetail } from "@/lib/data";
import { formatDate, formatMoney, formatPct, formatSignedMoney, pnlTone } from "@/lib/format";
import type { CardMetrics } from "@/lib/metrics";
import type { CardInfo } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/card/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCardDetail(id);
  return { title: detail ? `${detail.card.name} #${detail.card.cardNumber}` : "Card not found" };
}

export default function CardPage({ params, searchParams }: PageProps<"/card/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <CardContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CardContent({
  params,
  searchParams,
}: Pick<PageProps<"/card/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const detail = await getCardDetail(id);
  if (!detail) notFound();
  const { card, metrics, transactions } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Vault", href: "/vault" },
            { label: card.name },
          ]}
        />
        <Link href="/vault" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to vault
        </Link>
      </div>

      {query.existing && (
        <Notice tone="success">This card was already in your vault, so the purchase was added to it.</Notice>
      )}

      <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="mx-auto w-[234px] lg:mx-0">
          <CardThumb src={card.imageUrl} alt={card.name} width={230} foil eager />
          <CardImageEditor cardId={card.id} cardName={card.name} imageUrl={card.imageUrl} />
        </div>
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardHeading card={card} />
            <CardManage card={card} transactionCount={transactions.length} />
          </div>
          <CardActions card={card} stock={metrics.quantityInStock} />
          <PerformanceTable card={card} metrics={metrics} />
        </div>
      </section>

      <TransactionHistory card={card} stock={metrics.quantityInStock} transactions={transactions} />
    </div>
  );
}

function CardHeading({ card }: { card: CardInfo }) {
  const facts = [
    { label: "Number", value: card.cardNumber },
    { label: "Rarity", value: card.rarity ?? "—" },
    { label: "Set", value: card.setName },
    { label: "Language", value: card.language },
  ];
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{card.name}</h1>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="flex gap-1.5">
            <dt className="text-ink-faint">{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Aggregated card performance, grouped into the three things a collector asks. */
function PerformanceTable({ card, metrics: m }: { card: CardInfo; metrics: CardMetrics }) {
  const groups: { title: string; rows: { label: string; value: React.ReactNode }[] }[] = [
    {
      title: "Bought",
      rows: [
        { label: "Quantity bought", value: m.quantityBought },
        { label: "Average buy price", value: formatMoney(m.averageBuyPrice) },
        { label: "Total cost", value: formatMoney(m.totalBuyCost) },
        { label: "Buy fees", value: formatMoney(m.buyFees) },
      ],
    },
    {
      title: "Sold",
      rows: [
        { label: "Quantity sold", value: m.quantitySold },
        { label: "Average sell price", value: formatMoney(m.averageSellPrice) },
        { label: "Total revenue", value: formatMoney(m.totalRevenue) },
        {
          label: "Realized profit",
          value: <span className={pnlTone(m.realizedProfit)}>{formatSignedMoney(m.realizedProfit)}</span>,
        },
        { label: "Margin", value: <span className={pnlTone(m.marginPct)}>{formatPct(m.marginPct)}</span> },
      ],
    },
    {
      title: "Holding",
      rows: [
        {
          label: "Quantity in stock",
          value: <span className={m.quantityInStock < 0 ? "text-warn" : ""}>{m.quantityInStock}</span>,
        },
        { label: "Cost basis", value: formatMoney(m.totalCostBasis) },
        {
          label: "Market price",
          value: (
            <span title={card.marketPriceUpdatedAt ? `Updated ${formatDate(card.marketPriceUpdatedAt)}` : undefined}>
              {formatMoney(card.currentMarketPrice)}
            </span>
          ),
        },
        { label: "Unrealized P&L", value: <Pnl value={m.unrealizedPnl} pct={m.unrealizedPnlPct} /> },
      ],
    },
  ];

  return (
    <Panel title="Performance">
      <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {groups.map((g) => (
          <div key={g.title} className="p-4">
            <h3 className="mb-2 text-sm font-medium text-ink-muted">{g.title}</h3>
            <dl className="space-y-1.5 font-condensed text-sm">
              {g.rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">{r.label}</dt>
                  <dd className="font-medium tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {card.marketPriceUpdatedAt && (
        <p className="border-t border-line px-4 py-2 text-xs text-ink-faint">
          Market price updated {formatDate(card.marketPriceUpdatedAt)}. Fetched prices come from TCGplayer,
          converted from USD to SGD.
        </p>
      )}
    </Panel>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading card">
      <Skeleton className="h-5 w-64" />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <Skeleton className="h-[321px] w-[230px]" />
        <div className="space-y-4">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
