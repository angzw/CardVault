"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : "";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">This page failed to load</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {message.includes("DATABASE_URL")
          ? message
          : "The database may be unavailable. Check that migrations have run, then try again."}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-canvas"
      >
        Try again
      </button>
    </div>
  );
}
