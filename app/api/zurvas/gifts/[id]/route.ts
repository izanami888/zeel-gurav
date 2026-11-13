import { error, ok } from "@/lib/zurvas/http";
import { settleGift } from "@/lib/zurvas/payments";

export const dynamic = "force-dynamic";

// Илгээгчийн төлбөрийн дэлгэц энэ хаягийг хэдэн секунд тутам дуудаж,
// төлбөр орсон эсэхийг шалгана. Зөвхөн төлөвийг буцаана.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const gift = await settleGift(params.id);
    if (!gift) return error("Бэлэг олдсонгүй.", 404);
    return ok({ paid: gift.status !== "pending" });
  } catch (e) {
    console.error("[zurvas] gift status", e);
    return error("Төлбөр шалгахад алдаа гарлаа.", 502);
  }
}
