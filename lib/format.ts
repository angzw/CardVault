/** All money in the app is Singapore dollars. */
export const CURRENCY = "SGD";
const CURRENCY_SYMBOL = "S$";

const moneyFmt = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneySignedFmt = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Intl renders SGD as a bare "$"; spell it "S$" so it can't be read as USD. */
function withSymbol(fmt: Intl.NumberFormat, value: number): string {
  return fmt
    .formatToParts(value)
    .map((p) => (p.type === "currency" ? CURRENCY_SYMBOL : p.value))
    .join("");
}

const pctSigned = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

const integer = new Intl.NumberFormat("en-US");

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

export const EMPTY = "—";

export function formatMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : withSymbol(moneyFmt, value);
}

export function formatSignedMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : withSymbol(moneySignedFmt, value);
}

/** Source TCGplayer prices are quoted in US dollars. */
export function formatUsd(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : `US${usdFmt.format(value)}`;
}

export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : `${pctSigned.format(value)}%`;
}

export function formatInt(value: number): string {
  return integer.format(value);
}

/** Transaction dates are stored as UTC midnight, so always render in UTC. */
export function formatDate(value: Date | string): string {
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** `YYYY-MM-DD` for `<input type="date">`. */
export function toDateInputValue(value: Date | string): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/** Tailwind text color for a signed figure: green for gains, red for losses. */
export function pnlTone(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-ink-muted";
  return value > 0 ? "text-gain" : "text-loss";
}
