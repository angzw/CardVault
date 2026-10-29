"use client";

import { Loader2 } from "lucide-react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-loss">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "buy" | "sell" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-canvas hover:bg-white",
  secondary: "border border-line-strong bg-raised text-ink hover:border-ink-faint",
  buy: "bg-buy text-canvas hover:brightness-110",
  sell: "bg-sell text-canvas hover:brightness-110",
  danger: "bg-loss text-canvas hover:brightness-110",
  ghost: "text-ink-muted hover:bg-raised hover:text-ink",
};

export function Button({
  variant = "secondary",
  pending = false,
  className = "",
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pending?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "warn" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-loss/40 bg-loss/10 text-loss",
    warn: "border-warn/40 bg-warn/10 text-warn",
    success: "border-gain/40 bg-gain/10 text-gain",
  }[tone];
  return (
    <div role={tone === "success" ? "status" : "alert"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}
