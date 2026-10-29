"use client";

import { useState, useTransition } from "react";
import { recordTransaction, updateTransaction, type TransactionInput } from "@/app/actions";
import { Button, Field, Notice } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { formatMoney, toDateInputValue, todayInputValue } from "@/lib/format";
import type { TransactionKind } from "@/lib/metrics";
import type { ActionResult, TransactionRow } from "@/lib/types";

export type TransactionModalMode =
  | { kind: "create"; type: TransactionKind }
  | { kind: "edit"; transaction: TransactionRow };

export function TransactionModal({
  cardId,
  cardName,
  stock,
  mode,
  onClose,
  onDone,
}: {
  cardId: string;
  cardName: string;
  /** Current quantity in stock, for the oversell hint. */
  stock: number;
  mode: TransactionModalMode;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const editing = mode.kind === "edit" ? mode.transaction : null;
  const [type, setType] = useState<TransactionKind>(editing?.type ?? (mode.kind === "create" ? mode.type : "BUY"));
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1));
  const [unitPrice, setUnitPrice] = useState(editing ? String(editing.unitPrice) : "");
  const [fees, setFees] = useState(editing ? String(editing.fees) : "0");
  const [date, setDate] = useState(editing ? toDateInputValue(editing.date) : todayInputValue());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const isBuy = type === "BUY";
  const qty = Number(quantity) || 0;
  const gross = qty * (Number(unitPrice) || 0);
  const feeValue = Number(fees) || 0;
  const total = isBuy ? gross + feeValue : gross - feeValue;
  // When editing, the stock shown should exclude the transaction being edited.
  const baseStock = editing ? stock - (editing.type === "BUY" ? editing.quantity : -editing.quantity) : stock;
  const projectedStock = baseStock + (isBuy ? qty : -qty);
  const needsConfirmation = result !== null && !result.ok && "needsConfirmation" in result;
  const fieldErrors = result && !result.ok && "fieldErrors" in result ? result.fieldErrors ?? {} : {};

  function submit(confirmNegativeStock: boolean) {
    const input: TransactionInput = { type, quantity: qty, unitPrice: Number(unitPrice), fees: feeValue, date, notes };
    startTransition(async () => {
      const res = editing
        ? await updateTransaction(editing.id, input, confirmNegativeStock)
        : await recordTransaction(cardId, input, confirmNegativeStock);
      if (res.ok) {
        onDone(res.message ?? "Saved.");
      } else {
        setResult(res);
      }
    });
  }

  const title = editing ? "Edit transaction" : isBuy ? "Record a buy" : "Record a sale";
  const submitLabel = editing ? "Save changes" : isBuy ? "Record buy" : "Record sale";

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={
        <>
          {cardName} · {stock} in stock
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(needsConfirmation);
        }}
      >
        {editing && (
          <fieldset>
            <legend className="mb-1 text-sm text-ink-muted">Type</legend>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-line-strong bg-canvas p-1 text-sm">
              {(["BUY", "SELL"] as const).map((t) => (
                <label
                  key={t}
                  className={`cursor-pointer rounded px-3 py-1.5 text-center font-medium has-focus-visible:outline-2 has-focus-visible:outline-buy ${
                    type === t ? (t === "BUY" ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell") : "text-ink-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => {
                      setType(t);
                      setResult(null);
                    }}
                    className="sr-only"
                  />
                  {t === "BUY" ? "Buy" : "Sell"}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="tx-quantity" error={fieldErrors.quantity}>
            <input
              id="tx-quantity"
              className="field-input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              value={quantity}
              aria-invalid={Boolean(fieldErrors.quantity)}
              onChange={(e) => {
                setQuantity(e.target.value);
                setResult(null);
              }}
            />
          </Field>
          <Field label="Unit price (USD)" htmlFor="tx-price" error={fieldErrors.unitPrice}>
            <input
              id="tx-price"
              className="field-input"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              required
              placeholder="0.00"
              value={unitPrice}
              aria-invalid={Boolean(fieldErrors.unitPrice)}
              onChange={(e) => setUnitPrice(e.target.value)}
              autoFocus={!editing}
            />
          </Field>
          <Field label="Fees (USD)" htmlFor="tx-fees" error={fieldErrors.fees} hint="Shipping, platform, grading">
            <input
              id="tx-fees"
              className="field-input"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={fees}
              aria-invalid={Boolean(fieldErrors.fees)}
              onChange={(e) => setFees(e.target.value)}
            />
          </Field>
          <Field label="Date" htmlFor="tx-date" error={fieldErrors.date}>
            <input
              id="tx-date"
              className="field-input"
              type="date"
              required
              max={todayInputValue()}
              value={date}
              aria-invalid={Boolean(fieldErrors.date)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes (optional)" htmlFor="tx-notes">
          <input
            id="tx-notes"
            className="field-input"
            maxLength={500}
            placeholder="Seller, condition, order number…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <dl className="grid grid-cols-2 gap-y-1 rounded-md bg-canvas px-3 py-2.5 text-sm">
          <dt className="text-ink-muted">{isBuy ? "Total paid" : "Net proceeds"}</dt>
          <dd className={`text-right font-medium ${isBuy ? "text-buy" : "text-sell"}`}>{formatMoney(total)}</dd>
          <dt className="text-ink-muted">Stock after</dt>
          <dd className={`text-right font-medium ${projectedStock < 0 ? "text-warn" : ""}`}>{projectedStock}</dd>
        </dl>

        {!isBuy && projectedStock < 0 && !needsConfirmation && (
          <Notice tone="warn">
            You only have {Math.max(baseStock, 0)} in stock. You&apos;ll be asked to confirm.
          </Notice>
        )}
        {result && !result.ok && (
          <Notice tone={needsConfirmation ? "warn" : "error"}>{result.error}</Notice>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={needsConfirmation ? "danger" : isBuy ? "buy" : "sell"}
            pending={pending}
          >
            {needsConfirmation ? `${submitLabel} anyway` : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
