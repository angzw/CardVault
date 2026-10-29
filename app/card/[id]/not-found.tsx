import Link from "next/link";

export default function CardNotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">Card not found</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been removed, or the link is wrong.</p>
      <Link href="/vault" className="mt-6 inline-block rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-canvas">
        Go to vault
      </Link>
    </div>
  );
}
