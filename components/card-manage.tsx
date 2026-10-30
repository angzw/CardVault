"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCard, updateCardDetails } from "@/app/actions";
import { Button, Field, Notice } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { SetNameInput } from "@/components/set-name-input";
import { LANGUAGES, type CardInfo } from "@/lib/types";

export function CardManage({ card, transactionCount }: { card: CardInfo; transactionCount: number }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button
          variant="ghost"
          onClick={() => {
            setFlash(null);
            setDialog("edit");
          }}
        >
          <Pencil aria-hidden className="h-4 w-4" />
          Edit details
        </Button>
        <Button variant="ghost" className="hover:text-loss" onClick={() => setDialog("delete")}>
          <Trash2 aria-hidden className="h-4 w-4" />
          Delete card
        </Button>
      </div>
      {flash && (
        <p role="status" className="text-xs text-gain">
          {flash}
        </p>
      )}
      {dialog === "edit" && (
        <EditDetailsDialog
          card={card}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setFlash(message);
          }}
        />
      )}
      {dialog === "delete" && (
        <DeleteCardDialog card={card} transactionCount={transactionCount} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function EditDetailsDialog({
  card,
  onClose,
  onDone,
}: {
  card: CardInfo;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: card.name,
    cardNumber: card.cardNumber,
    rarity: card.rarity ?? "",
    setName: card.setName,
    language: card.language,
    currentMarketPrice: card.currentMarketPrice === null ? "" : String(card.currentMarketPrice),
  });
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [pending, startTransition] = useTransition();
  const fields = error?.fields ?? {};
  // Keep a language that was saved before the current list existed selectable.
  const languages: string[] = LANGUAGES.includes(card.language as (typeof LANGUAGES)[number])
    ? [...LANGUAGES]
    : [card.language, ...LANGUAGES];

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    startTransition(async () => {
      const res = await updateCardDetails(card.id, {
        ...form,
        currentMarketPrice: form.currentMarketPrice === "" ? null : Number(form.currentMarketPrice),
      });
      if (res.ok) onDone(res.message ?? "Saved.");
      else setError({ message: res.error, fields: "fieldErrors" in res ? (res.fieldErrors ?? {}) : {} });
    });
  }

  return (
    <Modal open onClose={onClose} title="Edit card details" description="Fix the name, number, set or other details.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="edit-name" error={fields.name} className="col-span-2">
            <input
              id="edit-name"
              className="field-input"
              required
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              aria-invalid={Boolean(fields.name)}
            />
          </Field>
          <Field label="Card number" htmlFor="edit-number" error={fields.cardNumber}>
            <input
              id="edit-number"
              className="field-input"
              required
              value={form.cardNumber}
              onChange={(e) => set("cardNumber")(e.target.value)}
              aria-invalid={Boolean(fields.cardNumber)}
            />
          </Field>
          <Field label="Rarity" htmlFor="edit-rarity">
            <input id="edit-rarity" className="field-input" value={form.rarity} onChange={(e) => set("rarity")(e.target.value)} />
          </Field>
          <Field label="Set" htmlFor="edit-set" error={fields.setName} className="col-span-2" hint="Pick an existing set or type a new one">
            <SetNameInput id="edit-set" value={form.setName} onChange={set("setName")} invalid={Boolean(fields.setName)} />
          </Field>
          <Field label="Language" htmlFor="edit-language">
            <select id="edit-language" className="field-input" value={form.language} onChange={(e) => set("language")(e.target.value)}>
              {languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Market price (SGD)" htmlFor="edit-market" error={fields.currentMarketPrice} hint="Leave empty if unknown">
            <input
              id="edit-market"
              className="field-input"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              value={form.currentMarketPrice}
              onChange={(e) => set("currentMarketPrice")(e.target.value)}
              aria-invalid={Boolean(fields.currentMarketPrice)}
            />
          </Field>
        </div>

        {error && <Notice tone="error">{error.message}</Notice>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" pending={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteCardDialog({
  card,
  transactionCount,
  onClose,
}: {
  card: CardInfo;
  transactionCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${card.name}?`}
      description={`#${card.cardNumber} · ${card.setName} · ${card.language}`}
    >
      <p className="text-sm text-ink-muted">
        {transactionCount === 0
          ? "This card has no transactions."
          : `Its ${transactionCount} ${transactionCount === 1 ? "transaction" : "transactions"} will be deleted too, and your dashboard totals will change.`}{" "}
        This can&apos;t be undone.
      </p>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          pending={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteCard(card.id);
              if (res.ok) {
                onClose();
                router.push("/vault");
              } else {
                setError(res.error);
              }
            })
          }
        >
          <Trash2 aria-hidden className="h-4 w-4" />
          Delete card
        </Button>
      </div>
    </Modal>
  );
}
