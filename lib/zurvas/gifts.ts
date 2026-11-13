// Бэлгийн каталог ба нийтлэг тохиргоо (клиент + сервер аль алинд ашиглана).

export interface GiftProduct {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Төгрөгөөр (MNT). */
  priceMnt: number;
}

// ⚠️ Үнэ нь түр зуурын жишээ — түнш кофе шопуудтай тохирсон үнээр солино уу.
export const GIFT_PRODUCTS: GiftProduct[] = [
  {
    id: "coffee",
    name: "Кофе",
    emoji: "☕",
    description: "Түнш кофе шопуудаас 1 аяга кофе",
    priceMnt: 9000,
  },
];

export const GIFT_VALID_DAYS = 30;
export const GIFT_NOTE_MAX = 200;
export const SENDER_NAME_MAX = 40;

export type PaymentMethod = "qpay" | "card";

export function getProduct(id: string): GiftProduct | undefined {
  return GIFT_PRODUCTS.find((p) => p.id === id);
}

export function formatMnt(amount: number): string {
  return `${amount.toLocaleString("en-US")}₮`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
