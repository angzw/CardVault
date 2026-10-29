"use client";

import { useEffect, useState, useTransition } from "react";
import { Minus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { deleteTransaction, fetchMarketPrice } from "@/app/actions";
import { Button, Notice } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { TransactionModal, type TransactionModalMode } from "@/components/transaction-modal";
import { EmptyState, Panel, TypeBadge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { CardInfo, TransactionRow } from "@/lib/types";

type Flash = { tone: "success" | "error"; text: string } | null;

function useFlash() {
  const [flash, setFlash] = useState<Flash>(null);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(timer);
  }, [flash]);
  return [flash, setFlash] as const;
}

export function CardActions({ card, stock }: { card: CardInfo; stock: number }) {
  const [mode, setMode] = useState<TransactionModalMode | null>(null);
  const [flash, setFlash] = useFlash();
  const [fetching, startFetch] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="buy" onClick={() => setMode({ kind: "create", type: "BUY" })}>
          <Plus aria-hidden className="h-4 w-4" />
          Add
        </Button>
        <Button
          variant="sell"
          onClick={() => setMode({ kind: "create", type: "SELL" })}
        >
          <Minus aria-hidden className="h-4 w-4" />
          Sell
        </Button>
        <Button
          pending={fetching}
          onClick={() =>
            startFetch(async () => {
              const res = await fetchMarketPrice(card.id);
              setFlash(
                res.ok
                  ? { tone: "success", text: res.message ?? "Market price updated." }
                  : { tone: "error", text: res.error },
              );
            })
          }
        >
          {!fetching && <RefreshCw aria-hidden className="h-4 w-4" />}
          {fetching ? "Fetching price…" : "Fetch market price"}
        </Button>
      </div>
      {flash && <Notice tone={flash.tone}>{flash.text}</Notice>}
      {mode && (
        <TransactionModal
          cardId={card.id}
          cardName={card.name}
          stock={stock}
          mode={mode}
          onClose={() => setMode(null)}
          onDone={(message) => {
            setMode(null);
            setFlash({ tone: "success", text: message });
          }}
        />
      )}
    </div>
  );
}

export function TransactionHistory({
  card,
  stock,
  transactions,
}: {
  card: CardInfo;
  stock: number;
  transactions: TransactionRow[];
}) {
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleting, setDeleting] = useState<TransactionRow | null>(null);
  const [flash, setFlash] = useFlash();

  return (
    <Panel
      title={
        <>
          Transaction history <span className="ml-1 font-normal text-ink-faint">{transactions.length}</span>
        </>
      }
    >
      {flash && (
        <div className="px-4 pt-3">
          <Notice tone={flash.tone}>{flash.text}</Notice>
        </div>
      )}
      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet">Use Add to record your first purchase of this card.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="num">Quantity</th>
                <th className="num">Unit price</th>
                <th className="num">Fees</th>
                <th className="num">Total amount</th>
                <th>Notes</th>
                <th className="text-right!">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const gross = t.quantity * t.unitPrice;
                const total = t.type === "BUY" ? gross + t.fees : gross - t.fees;
                return (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      <TypeBadge type={t.type} />
                    </td>
                    <td className="num">{t.quantity}</td>
                    <td className="num">{formatMoney(t.unitPrice)}</td>
                    <td className="num text-ink-muted">{formatMoney(t.fees)}</td>
                    <td className={`num font-medium ${t.type === "BUY" ? "text-buy" : "text-sell"}`}>
                      {formatMoney(total)}
                    </td>
                    <td className="max-w-56 truncate text-ink-muted" title={t.notes ?? undefined}>
                      {t.notes}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => setEditing(t)}
                          className="rounded p-1.5 text-ink-muted hover:bg-line hover:text-ink"
                          aria-label={`Edit ${t.type === "BUY" ? "buy" : "sale"} on ${formatDate(t.date)}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(t)}
                          className="rounded p-1.5 text-ink-muted hover:bg-loss/15 hover:text-loss"
                          aria-label={`Delete ${t.type === "BUY" ? "buy" : "sale"} on ${formatDate(t.date)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TransactionModal
          cardId={card.id}
          cardName={card.name}
          stock={stock}
          mode={{ kind: "edit", transaction: editing }}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setFlash({ tone: "success", text: message });
          }}
        />
      )}
      {deleting && (
        <DeleteTransactionModal
          transaction={deleting}
          onClose={() => setDeleting(null)}
          onDone={(message) => {
            setDeleting(null);
            setFlash({ tone: "success", text: message });
          }}
        />
      )}
    </Panel>
  );
}

function DeleteTransactionModal({
  transaction,
  onClose,
  onDone,
}: {
  transaction: TransactionRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<{ text: string; needsConfirmation: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const label = transaction.type === "BUY" ? "buy" : "sale";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete this ${label}?`}
      description={`${transaction.quantity} × ${formatMoney(transaction.unitPrice)} on ${formatDate(transaction.date)}`}
    >
      <p className="text-sm text-ink-muted">
        Stock, averages and profit for this card will be recalculated. This can&apos;t be undone.
      </p>
      {error && (
        <div className="mt-3">
          <Notice tone={error.needsConfirmation ? "warn" : "error"}>{error.text}</Notice>
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
              const res = await deleteTransaction(transaction.id, error?.needsConfirmation ?? false);
              if (res.ok) onDone(res.message ?? "Deleted.");
              else setError({ text: res.error, needsConfirmation: "needsConfirmation" in res });
            })
          }
        >
          <Trash2 aria-hidden className="h-4 w-4" />
          {error?.needsConfirmation ? "Delete anyway" : `Delete ${label}`}
        </Button>
      </div>
    </Modal>
  );
}
