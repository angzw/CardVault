# CardVault — TCG Inventory Web App Requirements

A production-ready TCG Inventory Web App to track Pokémon card purchases, sales, portfolio performance, and live market values.

---

## Tech Stack & Setup
- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Tailwind CSS + Lucide React (for icons)
- **Database/ORM**: Prisma with SQLite (or PostgreSQL-compatible)
- **External API (Optional/Configurable)**: Pokémon TCG API (pokemontcg.io) or TCGplayer API integration for automatic card image fetching, set details, and live market prices.
- **UI Aesthetic**: Clean, modern, dark-mode dashboard. High contrast, data-dense, collector-focused UI (reminiscent of Bloomberg Terminal meets Collectr / TCGplayer).

---

## Core Data & Calculation Rules
All card metrics and vault figures **must be dynamically calculated from the underlying Transaction Ledger**:

1. **Calculated Metrics per Card**:
   - `Quantity Bought` = `SUM(BUY quantities)`
   - `Average Buy Price` = `SUM(BUY total cost) / SUM(BUY quantity)`
   - `Quantity Sold` = `SUM(SELL quantities)`
   - `Average Sell Price` = `SUM(SELL revenue) / SUM(SELL quantity)`
   - `Quantity in Stock` = `Quantity Bought - Quantity Sold`
   - `Total Cost Basis` = `Average Buy Price * Quantity in Stock`
   - `Realized Profit` = `Total Revenue from Sales - Cost of Sold Units - Total Fees`
   - `Margin %` = `(Realized Profit / Total Sales Revenue) * 100`
   - `Unrealized P&L` = `(Current Market Price - Average Buy Price) * Quantity in Stock`

---

## Database Schema Requirements

1. **Card (Item Master)**:
   - `id`, `apiCardId` (optional link to pokemontcg.io), `name`, `cardNumber`, `rarity`, `setName`, `language`, `imageUrl`, `currentMarketPrice`
2. **Transaction**:
   - `id`, `cardId` (foreign key), `type` ('BUY' or 'SELL'), `quantity`, `unitPrice`, `fees`, `date` (ISO timestamp), `notes`

---

## Page Architecture & Features

### 1. Home Page / Dashboard (`/`)
- **Top Summary Cards (KPI Metrics):**
  - **Total Capital Invested**: Total spent across all buy transactions.
  - **Total Sales Revenue**: Gross revenue from sell transactions.
  - **Net Realized Profit**: Realized profit across sold inventory minus all transaction fees.
  - **Overall ROI (%)**: `(Net Realized Profit / Total Capital Invested) * 100`.
  - **Active Cards in Stock**: Total count of individual physical cards currently sitting in inventory.
  - **Total Portfolio Market Value**: `SUM(Quantity in Stock * Current Market Price)`.
- **Last 10 Recent Transactions Table:**
  - Columns: Card Image, Card Name (hyperlink to `/card/[id]`), Card Number, Rarity, Set Name, Language, Transaction Type (BUY/SELL badge), Quantity, Buy/Sell Unit Price, Total Fees, Date.

### 2. Vault Page (`/vault`)
- **Search & Filtering Header:**
  - Real-time search bar for **Card Name** and **Card Number**.
  - Dropdown filters for **Set Name** and **Language**.
  - Quick toggle to filter: *"In Stock Only"* vs *"All Cards Ever Owned"*.
- **Vault Summary Table (Aggregated from Transaction History):**
  - Columns: Card Image, Card Name (hyperlink to `/card/[id]`), Card Number, Rarity, Set Name, Language, **Quantity in Stock**, **Average Buy Price**, **Total Cost Basis**, **Current Market Price**, **Unrealized P&L ($ / %)**.
- **Navigation:** Back button / Breadcrumb navigation to Dashboard.

### 3. Card Detail Page (`/card/[id]`)
- **Card Performance & Summary Table:**
  - Aggregated metrics: Card Image, Card Name, Card Number, Rarity, Set Name, Language, Quantity Bought, Average Buy Price, Total Cost, Quantity Sold, Average Sell Price, Total Revenue, Quantity in Stock, Realized Profit, Margin %, Unrealized P&L.
- **Action Controls:**
  - **"Add" Button (Modal):** Record a new BUY transaction (Quantity, Unit Price, Date, Fees).
  - **"Minus" Button (Modal):** Record a new SELL transaction (Quantity, Unit Price, Date, Fees). Prevents selling more than current stock unless confirmed.
  - **"Fetch Market Price" Button:** Fetches current TCGplayer market price for this card via Pokémon TCG API.
- **Transaction History Table (Specific to this card):**
  - Columns: Date, Type (BUY/SELL), Quantity, Unit Price, Fees, Total Amount, Actions (Edit/Delete).
- **Navigation:** Back button to Vault or Home.

---

## Implementation Guidelines
1. **API Integration**: Include a utility helper (`/lib/tcg.ts`) using the public Pokémon TCG API (`https://api.pokemontcg.io/v2/cards`) to auto-complete card name, image, set, and market price when adding a new card.
2. **Database Seeding**: Include a Prisma seed script (`prisma/seed.ts`) prepopulated with 5-8 popular Pokémon cards (e.g., Base Set Charizard, Moonbreon, Pikachu Special Illustration Promos) and multiple buy/sell transactions so all calculated stats, ROI, average prices, and Vault summaries display populated data immediately.
3. **Data Integrity & Edge Cases**:
   - Safely handle division by zero (e.g., when 0 items are sold or cost is 0).
   - Dynamically re-calculate all Vault numbers whenever a transaction is added, edited, or deleted.
4. **UI Design**: Modern, responsive CSS with clear color coding (green for profit/positive ROI, red for loss/negative ROI, blue for buys, purple for sells).

Deliverables: scaffold the project structure, create the database schema, implement the dynamic calculation functions, build all three pages, and provide startup commands.
