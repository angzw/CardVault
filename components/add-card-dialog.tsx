"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PenLine, Plus, Search } from "lucide-react";
import { createCard, searchCatalog, type NewCardInput } from "@/app/actions";
import { Button, Field, Notice } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { CardThumb } from "@/components/ui";
import { formatMoney, todayInputValue } from "@/lib/format";
import type { TcgCardSuggestion } from "@/lib/tcg";
import { LANGUAGES } from "@/lib/types";

type Step = { kind: "search" } | { kind: "details"; source: TcgCardSuggestion | null };

export function AddCardDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "search" });

  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setStep({ kind: "search" });
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="h-4 w-4" />
        <span className="sm:hidden">Add</span>
        <span className="hidden sm:inline">Add card</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={step.kind === "search" ? "Add a card" : "Card details"}
        description={
          step.kind === "search"
            ? "Search the Pokémon TCG catalog, or enter the card yourself."
            : step.source
              ? "Check the details, then record what you paid."
              : "Enter the card as printed. You can fetch a market price later."
        }
      >
        {step.kind === "search" ? (
          <CatalogSearch
            onPick={(source) => setStep({ kind: "details", source })}
            onManual={() => setStep({ kind: "details", source: null })}
          />
        ) : (
          <CardDetailsForm
            source={step.source}
            onBack={() => setStep({ kind: "search" })}
            onCreated={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function CatalogSearch({
  onPick,
  onManual,
}: {
  onPick: (card: TcgCardSuggestion) => void;
  onManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TcgCardSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const requestId = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchCatalog(q);
      // Ignore responses that arrive after a newer search started.
      if (requestId !== latest.current) return;
      setLoading(false);
      if (res.ok) {
        setResults(res.results);
        setError(null);
      } else {
        setError(res.error);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const showResults = query.trim().length >= 2 && results !== null;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        {loading && (
          <Loader2 aria-hidden className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint" />
        )}
        <label htmlFor="catalog-search" className="sr-only">
          Search the catalog
        </label>
        <input
          id="catalog-search"
          type="search"
          autoFocus
          autoComplete="off"
          className="field-input pl-8 pr-8"
          placeholder="Card name, optionally with number — e.g. Umbreon VMAX 215"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {showResults && results.length === 0 && !loading && (
        <p className="py-6 text-center text-sm text-ink-muted">
          No catalog matches for “{query.trim()}”. Check the spelling or enter the card manually.
        </p>
      )}

      {showResults && results.length > 0 && (
        <ul aria-label="Search results" className="grid max-h-[50vh] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {results.map((card) => (
            <li key={card.apiCardId}>
              <button
                type="button"
                onClick={() => onPick(card)}
                className="flex w-full items-center gap-3 rounded-md border border-line p-2 text-left hover:border-line-strong hover:bg-raised"
              >
                <CardThumb src={card.imageUrl} alt={card.name} width={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{card.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {card.setName} · #{card.cardNumber}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">{card.rarity ?? "No rarity listed"}</span>
                </span>
                <span className="font-condensed text-sm">{formatMoney(card.marketPrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        <span className="text-ink-muted">Japanese print, graded slab or not in the catalog?</span>
        <Button variant="secondary" onClick={onManual}>
          <PenLine aria-hidden className="h-4 w-4" />
          Enter manually
        </Button>
      </div>
    </div>
  );
}

function CardDetailsForm({
  source,
  onBack,
  onCreated,
}: {
  source: TcgCardSuggestion | null;
  onBack: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: source?.name ?? "",
    cardNumber: source?.cardNumber ?? "",
    rarity: source?.rarity ?? "",
    setName: source?.setName ?? "",
    language: "English",
    imageUrl: source?.imageUrl ?? "",
    currentMarketPrice: source?.marketPrice != null ? String(source.marketPrice) : "",
  });
  const [recordBuy, setRecordBuy] = useState(true);
  const [buy, setBuy] = useState({ quantity: "1", unitPrice: "", fees: "0", date: todayInputValue(), notes: "" });
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [pending, startTransition] = useTransition();
  const fields = error?.fields ?? {};

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateBuy = (key: keyof typeof buy) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBuy((b) => ({ ...b, [key]: e.target.value }));

  function submit() {
    const input: NewCardInput = {
      apiCardId: source?.apiCardId ?? null,
      ...form,
      currentMarketPrice: form.currentMarketPrice === "" ? null : Number(form.currentMarketPrice),
      initialBuy: recordBuy
        ? {
            quantity: Number(buy.quantity),
            unitPrice: Number(buy.unitPrice),
            fees: Number(buy.fees) || 0,
            date: buy.date,
            notes: buy.notes,
          }
        : null,
    };
    startTransition(async () => {
      const res = await createCard(input);
      if (res.ok) {
        onCreated();
        router.push(`/card/${res.cardId}${res.existing ? "?existing=1" : ""}`);
      } else {
        setError({ message: res.error, fields: res.fieldErrors ?? {} });
      }
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-4">
        <div className="hidden shrink-0 sm:block">
          <CardThumb src={form.imageUrl || null} alt={form.name || "Card"} width={120} foil={Boolean(form.imageUrl)} />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <Field label="Name" htmlFor="card-name" error={fields.name} className="col-span-2">
            <input id="card-name" className="field-input" required value={form.name} onChange={update("name")} aria-invalid={Boolean(fields.name)} />
          </Field>
          <Field label="Card number" htmlFor="card-number" error={fields.cardNumber}>
            <input
              id="card-number"
              className="field-input"
              required
              placeholder="215/203"
              value={form.cardNumber}
              onChange={update("cardNumber")}
              aria-invalid={Boolean(fields.cardNumber)}
            />
          </Field>
          <Field label="Rarity" htmlFor="card-rarity">
            <input id="card-rarity" className="field-input" value={form.rarity} onChange={update("rarity")} />
          </Field>
          <Field label="Set" htmlFor="card-set" error={fields.setName}>
            <input id="card-set" className="field-input" required value={form.setName} onChange={update("setName")} aria-invalid={Boolean(fields.setName)} />
          </Field>
          <Field label="Language" htmlFor="card-language">
            <select id="card-language" className="field-input" value={form.language} onChange={update("language")}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Market price (USD)" htmlFor="card-market" error={fields.currentMarketPrice} hint={source ? "From TCGplayer via pokemontcg.io" : undefined}>
            <input
              id="card-market"
              className="field-input"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              placeholder="Optional"
              value={form.currentMarketPrice}
              onChange={update("currentMarketPrice")}
              aria-invalid={Boolean(fields.currentMarketPrice)}
            />
          </Field>
          <Field label="Image URL" htmlFor="card-image" error={fields.imageUrl}>
            <input
              id="card-image"
              className="field-input"
              type="url"
              placeholder="Optional, https://…"
              value={form.imageUrl}
              onChange={update("imageUrl")}
              aria-invalid={Boolean(fields.imageUrl)}
            />
          </Field>
        </div>
      </div>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={recordBuy}
              onChange={(e) => setRecordBuy(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-buy)]"
            />
            Record a purchase now
          </label>
        </legend>
        {recordBuy && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Quantity" htmlFor="buy-qty" error={fields["buy.quantity"]}>
              <input id="buy-qty" className="field-input" type="number" min={1} step={1} required value={buy.quantity} onChange={updateBuy("quantity")} />
            </Field>
            <Field label="Unit price" htmlFor="buy-price" error={fields["buy.unitPrice"]}>
              <input
                id="buy-price"
                className="field-input"
                type="number"
                min={0}
                step={0.01}
                required
                placeholder="0.00"
                value={buy.unitPrice}
                onChange={updateBuy("unitPrice")}
              />
            </Field>
            <Field label="Fees" htmlFor="buy-fees" error={fields["buy.fees"]}>
              <input id="buy-fees" className="field-input" type="number" min={0} step={0.01} value={buy.fees} onChange={updateBuy("fees")} />
            </Field>
            <Field label="Date" htmlFor="buy-date" error={fields["buy.date"]}>
              <input id="buy-date" className="field-input" type="date" required max={todayInputValue()} value={buy.date} onChange={updateBuy("date")} />
            </Field>
          </div>
        )}
      </fieldset>

      {error && <Notice tone="error">{error.message}</Notice>}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to search
        </Button>
        <Button type="submit" variant="primary" pending={pending}>
          Add to vault
        </Button>
      </div>
    </form>
  );
}
