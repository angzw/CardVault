"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ImageOff, ImagePlus, Trash2 } from "lucide-react";
import { updateCardImage } from "@/app/actions";
import { Button, Field, Notice } from "@/components/form-controls";
import { Modal } from "@/components/modal";

const PREVIEW_WIDTH = 150;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 88) / 63);

export function CardImageEditor({
  cardId,
  cardName,
  imageUrl,
}: {
  cardId: string;
  cardName: string;
  imageUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <div className="mt-2 flex flex-col items-center gap-2 lg:items-stretch">
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          setFlash(null);
          setOpen(true);
        }}
      >
        <ImagePlus aria-hidden className="h-4 w-4" />
        {imageUrl ? "Change image" : "Add image"}
      </Button>
      {flash && (
        <p role="status" className="text-center text-xs text-gain">
          {flash}
        </p>
      )}
      {open && (
        <ImageDialog
          cardId={cardId}
          cardName={cardName}
          imageUrl={imageUrl}
          onClose={() => setOpen(false)}
          onDone={(message) => {
            setOpen(false);
            setFlash(message);
          }}
        />
      )}
    </div>
  );
}

function ImageDialog({
  cardId,
  cardName,
  imageUrl,
  onClose,
  onDone,
}: {
  cardId: string;
  cardName: string;
  imageUrl: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [url, setUrl] = useState(imageUrl ?? "");
  // Track which URL failed so editing the field clears the warning.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = url.trim();
  const looksValid = /^https:\/\/\S+$/.test(trimmed);
  const broken = brokenUrl === trimmed;

  function save(value: string) {
    startTransition(async () => {
      const res = await updateCardImage(cardId, value);
      if (res.ok) onDone(res.message ?? "Saved.");
      else setError(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={imageUrl ? "Change image" : "Add image"} description={cardName}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(trimmed);
        }}
      >
        <div className="flex gap-4">
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong bg-canvas text-ink-faint"
            style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
          >
            {looksValid && !broken ? (
              <Image
                key={trimmed}
                src={trimmed}
                alt={`Preview of ${cardName}`}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                unoptimized
                className="h-full w-full object-cover"
                onError={() => setBrokenUrl(trimmed)}
              />
            ) : (
              <ImageOff aria-hidden className="h-8 w-8" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Field
              label="Image URL"
              htmlFor="image-url"
              error={error ?? undefined}
              hint="Paste a direct link to the image, starting with https://"
            >
              <input
                id="image-url"
                type="url"
                className="field-input"
                placeholder="https://…"
                autoFocus
                value={url}
                aria-invalid={Boolean(error)}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
              />
            </Field>
            {broken && (
              <Notice tone="warn">
                This link didn&apos;t load as an image. Check it opens the picture itself, not a web page.
              </Notice>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {imageUrl ? (
            <Button type="button" variant="ghost" className="text-loss hover:text-loss" disabled={pending} onClick={() => save("")}>
              <Trash2 aria-hidden className="h-4 w-4" />
              Remove image
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" pending={pending} disabled={!looksValid || trimmed === (imageUrl ?? "")}>
              Save image
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
