import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ImageOff } from "lucide-react";
import type { TransactionKind } from "@/lib/metrics";
import { formatPct, formatSignedMoney, pnlTone } from "@/lib/format";

const OPTIMIZED_IMAGE_HOSTS = new Set(["images.pokemontcg.io"]);

function canOptimize(src: string) {
  try {
    return OPTIMIZED_IMAGE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/** Card art at the 63:88 trading card ratio, with a placeholder when missing. */
export function CardThumb({
  src,
  alt,
  width = 36,
  foil = false,
  eager = false,
}: {
  src: string | null;
  alt: string;
  width?: number;
  foil?: boolean;
  eager?: boolean;
}) {
  const height = Math.round((width * 88) / 63);
  const art = src ? (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      unoptimized={!canOptimize(src)}
      className="block bg-raised object-cover"
      style={{ width, height }}
    />
  ) : (
    <span
      role="img"
      aria-label={`${alt} (no image)`}
      className="flex items-center justify-center rounded-[3px] border border-dashed border-line-strong bg-raised text-ink-faint"
      style={{ width, height }}
    >
      <ImageOff className="h-1/3 w-1/3" strokeWidth={1.5} />
    </span>
  );
  if (foil) return <span className="foil inline-block">{art}</span>;
  return <span className="inline-block overflow-hidden rounded-[3px]">{art}</span>;
}

export function TypeBadge({ type }: { type: TransactionKind }) {
  const isBuy = type === "BUY";
  return (
    <span
      className={`inline-flex min-w-11 justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${
        isBuy ? "bg-buy/12 text-buy ring-1 ring-buy/30" : "bg-sell/12 text-sell ring-1 ring-sell/30"
      }`}
    >
      {isBuy ? "Buy" : "Sell"}
    </span>
  );
}

/** Signed money with optional percentage, colored by direction. */
export function Pnl({ value, pct }: { value: number | null; pct?: number | null }) {
  return (
    <span className={pnlTone(value)}>
      {formatSignedMoney(value)}
      {pct !== undefined && (
        <span className="ml-1.5 text-[0.85em] opacity-80">{formatPct(pct)}</span>
      )}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 text-ink-faint" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-raised ${className}`} />;
}
