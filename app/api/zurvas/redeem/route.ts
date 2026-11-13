import { createHash } from "crypto";
import { clientIp, error, handler, ok, readJson, tooManyAttempts } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

// Түнш кофе шопын ажилтан QR уншуулаад, түншийн кодоо оруулж бэлгийг
// "ашигласан" болгоно. Нэг бэлгийг зөвхөн нэг удаа ашиглана.
export const POST = handler(async (req) => {
  if (tooManyAttempts(`redeem:${clientIp(req)}`, 10)) {
    return error("Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.", 429);
  }

  const body = await readJson(req);
  const code = String(body.code ?? "");
  const partnerCode = String(body.partnerCode ?? "").trim();
  if (!code || !partnerCode) return error("Түншийн кодоо оруулна уу.");

  const store = getStore();
  const partner = await store.getPartnerByCodeHash(
    createHash("sha256").update(partnerCode).digest("hex")
  );
  if (!partner) return error("Түншийн код буруу байна.", 403);

  const gift = await store.getGiftByRedeemCode(code);
  if (!gift) return error("Бэлэг олдсонгүй.", 404);
  if (gift.status === "redeemed") return error("Энэ бэлгийг аль хэдийн ашигласан байна.", 409);

  const now = new Date().toISOString();
  if (!gift.expiresAt || gift.expiresAt <= now) {
    return error("Бэлгийн хугацаа дууссан байна.", 410);
  }
  if (!(await store.redeemGift(gift.id, partner.id, now))) {
    return error("Энэ бэлгийг аль хэдийн ашигласан байна.", 409);
  }
  return ok({ partner: partner.name });
});
