import { error, handler, ok, readJson } from "@/lib/zurvas/http";
import { markPaid } from "@/lib/zurvas/payments";
import { getStore } from "@/lib/zurvas/store";

// ЗӨВХӨН ХӨГЖҮҮЛЭЛТЭД: туршилтын бэлгийг "төлсөн" болгоно.
// Production дээр үргэлж 404.
export const POST = handler(async (req) => {
  if (process.env.NODE_ENV === "production") return error("Not found", 404);

  const body = await readJson(req);
  const gift = await getStore().getGift(String(body.giftId ?? ""));
  if (!gift || gift.paymentProvider !== "mock") return error("Бэлэг олдсонгүй.", 404);

  if (gift.status === "pending") await markPaid(gift);
  return ok();
});
