# CardVault

A dark-mode inventory and P&L tracker for Pokémon TCG collectors. Log buys and sales, and every figure (stock, average cost, realized and unrealized profit, ROI) is recalculated from the transaction ledger. Market prices come from TCGplayer via the [Pokémon TCG API](https://pokemontcg.io).

All amounts are in **Singapore dollars (S$)**. TCGplayer quotes prices in US dollars, so fetched prices are converted to SGD using the daily ECB reference rate from [Frankfurter](https://frankfurter.dev).

Requirements: [`docs/requirements.md`](docs/requirements.md)

## Quick start

Requires **Node.js 20.19+, 22.12+ or 24+** (Prisma 7 does not support Node 23). `.nvmrc` pins 24.

```bash
npm install          # also generates the Prisma client
cp .env.example .env # skip if .env already exists
npm run setup        # apply migrations, generate client, load demo data
npm run dev          # http://localhost:3000
```

`npm run db:seed` resets the database to the demo data at any time. `npm run db:reset` empties it instead. **Both delete all cards and transactions.**

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests for the calculation layer (Vitest) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run db:migrate` | Create and apply a migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Replace all data with the demo set |
| `npm run db:reset` | Wipe the database to an empty vault (asks for confirmation) |
| `npm run db:studio` | Browse the database in Prisma Studio |

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `file:./prisma/dev.db` for SQLite |
| `POKEMONTCG_API_KEY` | No | Raises pokemontcg.io rate limits. The API works without a key. |
| `USD_SGD_RATE` | No | Pins the USD→SGD rate (e.g. `1.28`). Empty uses the live ECB rate, cached for 6 hours. |

## Pages

- **`/` Dashboard**: portfolio market value, capital invested, sales revenue, net realized profit, ROI, cards in stock, and the last 10 transactions.
- **`/vault` Vault**: every card with stock, average buy price, cost basis, market price and unrealized P&L. Live search by name or number, set and language filters, an *In stock only* / *All cards ever owned* toggle, and sortable columns.
- **`/card/[id]` Card**: full performance breakdown. **Add** records a buy and **Sell** records a sale. Selling more than you hold asks for confirmation. **Fetch market price** pulls the latest TCGplayer price. The transaction history supports edit and delete.
- **Add card** (header, on every page): search the catalog to prefill name, number, set, rarity, art and price, or enter a card manually (for example Japanese prints). You can record the first purchase in the same step.

## How the numbers work

All metrics are computed on request from the `Transaction` table in [`lib/metrics.ts`](lib/metrics.ts). Nothing is stored denormalized, so adding, editing or deleting a transaction updates every page.

| Metric | Formula |
| --- | --- |
| Quantity bought / sold | Σ BUY quantity / Σ SELL quantity |
| Average buy price | Σ(BUY qty × unit price) ÷ Σ BUY qty |
| Average sell price | Σ(SELL qty × unit price) ÷ Σ SELL qty |
| Quantity in stock | bought − sold |
| Total cost basis | average buy price × quantity in stock |
| Realized profit | sales revenue − (average buy price × quantity sold) − all fees |
| Margin % | realized profit ÷ sales revenue × 100 |
| Unrealized P&L | (market price − average buy price) × quantity in stock |
| Capital invested | Σ(BUY qty × unit price + BUY fees) |
| Overall ROI | net realized profit ÷ capital invested × 100 |
| Portfolio market value | Σ(quantity in stock × market price), for priced cards only |

Conventions:

- **Fees are kept separate from prices.** Unit prices never include fees. Buy and sell fees are deducted in full from realized profit.
- **Cost of sold units uses the weighted average cost.**
- **Ratios with a zero denominator show "—"** rather than ∞ or NaN. Examples: margin with no revenue, ROI with no capital, average buy price with no buys.
- **Oversold positions** (recorded after confirmation) are valued at zero held units, never at a negative cost basis.
- **One currency, SGD.** Fetched TCGplayer prices are converted from USD when they're fetched, and the stored price is in SGD.
- **Dates are calendar days** stored as UTC midnight and always displayed in UTC, so they never shift between time zones.

## Project layout

```
app/
  page.tsx             Dashboard
  vault/page.tsx       Vault
  card/[id]/page.tsx   Card detail
  actions.ts           Server Actions: record/update/delete transactions, create card, fetch price, catalog search
components/            UI: vault table, transaction modal, card ledger, add-card dialog
lib/
  metrics.ts           Pure calculation functions (+ metrics.test.ts)
  data.ts              Prisma reads → serializable view models
  tcg.ts               pokemontcg.io client (search, lookup, price selection, retries)
  fx.ts                USD→SGD exchange rate (Frankfurter / ECB, or USD_SGD_RATE)
  db.ts                Prisma client (better-sqlite3 driver adapter)
prisma/
  schema.prisma        Card and Transaction models
  seed.ts              Demo data (8 cards, 16 transactions)
```

### Stack notes

- **Next.js 16** (App Router) with Cache Components. Database reads call `connection()` and render inside `<Suspense>`, so they always run at request time. Mutations call `revalidatePath("/", "layout")`.
- **Prisma 7** with the `better-sqlite3` driver adapter. To move to PostgreSQL, change the datasource provider, swap in `@prisma/adapter-pg`, and re-create the migrations.
- **Tailwind CSS 4** for styling, **Lucide** for icons, and IBM Plex Sans / Plex Sans Condensed for type.
- **pokemontcg.io** sometimes returns 5xx errors. Requests time out after 12 s and are retried up to 3 times.
