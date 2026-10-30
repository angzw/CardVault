"use client";

import { useEffect, useId, useState } from "react";
import { listSetNames } from "@/app/actions";

/**
 * Set name text input that suggests the sets already in the vault, so a card
 * isn't filed under a typo (e.g. "47") by accident. Any new name is allowed.
 */
export function SetNameInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const listId = useId();
  const [sets, setSets] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    listSetNames()
      .then((names) => {
        if (!cancelled) setSets(names);
      })
      // Suggestions are a convenience; the field still works without them.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <input
        id={id}
        className="field-input"
        required
        autoComplete="off"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
      <datalist id={listId}>
        {sets.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
