import { Suspense } from "react";
import Link from "next/link";
import { AddCardDialog } from "@/components/add-card-dialog";
import { NavLinks } from "@/components/nav-links";
import { NAV_LINKS } from "@/lib/nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span aria-hidden className="foil block h-5 w-[15px] rounded-[3px] p-[1.5px]">
            <span className="block h-full w-full rounded-[2px] bg-canvas" />
          </span>
          <span className="text-[15px]">CardVault</span>
        </Link>
        {/* Active-link highlighting reads the URL, which streams in after the static shell. */}
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
        <div className="ml-auto">
          <AddCardDialog />
        </div>
      </div>
    </header>
  );
}

function NavLinksFallback() {
  return (
    <nav aria-label="Main" className="flex items-center gap-1 text-sm">
      {NAV_LINKS.map(({ href, label }) => (
        <Link key={href} href={href} className="rounded-md px-2.5 py-1.5 text-ink-muted hover:text-ink">
          {label}
        </Link>
      ))}
    </nav>
  );
}
