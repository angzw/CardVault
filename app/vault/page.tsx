import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs, Panel, Skeleton } from "@/components/ui";
import { VaultTable } from "@/components/vault-table";
import { getVaultRows } from "@/lib/data";

export const metadata: Metadata = { title: "Vault" };

export default function VaultPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Vault" }]} />
      <h1 className="mb-5 text-xl font-semibold tracking-tight">Vault</h1>
      <Panel>
        <Suspense fallback={<VaultSkeleton />}>
          <VaultContent />
        </Suspense>
      </Panel>
    </div>
  );
}

async function VaultContent() {
  const rows = await getVaultRows();
  return <VaultTable rows={rows} />;
}

function VaultSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading vault">
      <Skeleton className="h-9 w-full max-w-sm" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
