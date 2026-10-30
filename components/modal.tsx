"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Native <dialog> wrapper: focus trapping, Escape-to-close and the backdrop
 * come from the browser. Render it conditionally or toggle `open`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-2rem)] rounded-xl border border-line-strong bg-panel p-0 text-ink shadow-2xl shadow-black/50 ${
        size === "lg" ? "max-w-3xl" : "max-w-md"
      }`}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="font-semibold">
                {title}
              </h2>
              {description && <div className="mt-0.5 text-sm text-ink-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 rounded-md p-1.5 text-ink-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
