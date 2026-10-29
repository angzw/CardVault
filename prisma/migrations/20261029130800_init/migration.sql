-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiCardId" TEXT,
    "name" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "rarity" TEXT,
    "setName" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "imageUrl" TEXT,
    "currentMarketPrice" REAL,
    "marketPriceUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "fees" REAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_apiCardId_idx" ON "Card"("apiCardId");

-- CreateIndex
CREATE INDEX "Transaction_cardId_date_idx" ON "Transaction"("cardId", "date");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
