/**
 * Demo data: 8 sought-after cards with a mix of buys and sells so every
 * metric (averages, realized profit, margins, unrealized P&L) is populated.
 *
 * Run with `npm run db:seed`. This REPLACES all cards and transactions.
 * Market prices are TCGplayer market values captured October 2026; use
 * "Fetch market price" on a card page to refresh them.
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../lib/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

type SeedTx = [type: "BUY" | "SELL", date: string, quantity: number, unitPrice: number, fees: number, notes?: string];

interface SeedCard {
  apiCardId: string | null;
  name: string;
  cardNumber: string;
  rarity: string;
  setName: string;
  language: string;
  imageUrl: string | null;
  currentMarketPrice: number;
  transactions: SeedTx[];
}

const img = (apiCardId: string) => {
  const [set, number] = apiCardId.split("-");
  return `https://images.pokemontcg.io/${set}/${number}.png`;
};

const cards: SeedCard[] = [
  {
    apiCardId: "base1-4",
    name: "Charizard",
    cardNumber: "4/102",
    rarity: "Rare Holo",
    setName: "Base",
    language: "English",
    imageUrl: img("base1-4"),
    currentMarketPrice: 954.65,
    transactions: [
      ["BUY", "2025-02-10", 1, 720, 18, "Local card show, LP"],
      ["BUY", "2025-06-03", 1, 810, 0, "Collection buyout"],
      ["SELL", "2026-03-14", 1, 1050, 136.5, "eBay, 13% fees"],
    ],
  },
  {
    apiCardId: "swsh7-215",
    name: "Umbreon VMAX",
    cardNumber: "215/203",
    rarity: "Rare Rainbow",
    setName: "Evolving Skies",
    language: "English",
    imageUrl: img("swsh7-215"),
    currentMarketPrice: 2264.7,
    transactions: [
      ["BUY", "2025-01-20", 1, 1580, 25, "Moonbreon, NM"],
      ["BUY", "2025-09-12", 1, 1890, 0, "Trade-in credit"],
    ],
  },
  {
    apiCardId: "svp-85",
    name: "Pikachu with Grey Felt Hat",
    cardNumber: "085",
    rarity: "Promo",
    setName: "Scarlet & Violet Black Star Promos",
    language: "English",
    imageUrl: img("svp-85"),
    currentMarketPrice: 1000.59,
    transactions: [
      ["BUY", "2025-03-01", 4, 185, 12, "Van Gogh Museum release"],
      ["SELL", "2025-11-20", 2, 640, 166.4, "TCGplayer"],
    ],
  },
  {
    apiCardId: "sv8-238",
    name: "Pikachu ex",
    cardNumber: "238/191",
    rarity: "Special Illustration Rare",
    setName: "Surging Sparks",
    language: "English",
    imageUrl: img("sv8-238"),
    currentMarketPrice: 274.44,
    transactions: [
      ["BUY", "2024-12-05", 3, 205, 9],
      ["BUY", "2025-04-18", 2, 240, 0],
      ["SELL", "2025-08-02", 1, 310, 40.3, "Facebook Marketplace"],
    ],
  },
  {
    apiCardId: "swsh12-186",
    name: "Lugia V",
    cardNumber: "186/195",
    rarity: "Rare Ultra",
    setName: "Silver Tempest",
    language: "English",
    imageUrl: img("swsh12-186"),
    currentMarketPrice: 488.36,
    transactions: [
      ["BUY", "2025-05-22", 1, 395, 8, "Alt art"],
      ["SELL", "2026-07-09", 1, 520, 67.6, "eBay"],
    ],
  },
  {
    apiCardId: "swsh11-186",
    name: "Giratina V",
    cardNumber: "186/196",
    rarity: "Rare Ultra",
    setName: "Lost Origin",
    language: "English",
    imageUrl: img("swsh11-186"),
    currentMarketPrice: 851.13,
    transactions: [["BUY", "2025-07-30", 1, 610, 0, "Alt art"]],
  },
  {
    apiCardId: "sv3pt5-199",
    name: "Charizard ex",
    cardNumber: "199/165",
    rarity: "Special Illustration Rare",
    setName: "151",
    language: "English",
    imageUrl: img("sv3pt5-199"),
    currentMarketPrice: 323.37,
    transactions: [
      ["BUY", "2025-02-25", 2, 265, 6],
      ["SELL", "2026-01-15", 1, 240, 31.2, "Sold during a dip"],
    ],
  },
  {
    // Not in the English-only pokemontcg.io catalog: entered manually.
    apiCardId: null,
    name: "Umbreon VMAX",
    cardNumber: "095/069",
    rarity: "HR",
    setName: "Eevee Heroes",
    language: "Japanese",
    imageUrl: null,
    currentMarketPrice: 1350,
    transactions: [["BUY", "2025-10-08", 1, 1100, 35, "Imported, PSA 9 candidate"]],
  },
];

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.card.deleteMany();

  for (const { transactions, ...card } of cards) {
    await prisma.card.create({
      data: {
        ...card,
        marketPriceUpdatedAt: new Date("2026-10-29T00:00:00.000Z"),
        transactions: {
          create: transactions.map(([type, date, quantity, unitPrice, fees, notes]) => ({
            type,
            date: new Date(`${date}T00:00:00.000Z`),
            quantity,
            unitPrice,
            fees,
            notes: notes ?? null,
          })),
        },
      },
    });
  }

  const txCount = cards.reduce((n, c) => n + c.transactions.length, 0);
  console.log(`Seeded ${cards.length} cards and ${txCount} transactions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
