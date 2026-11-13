import { normalizeUsername } from "@/lib/zurvas/config";
import { getCurrentUser } from "@/lib/zurvas/auth";
import { GIFT_NOTE_MAX, SENDER_NAME_MAX, getProduct } from "@/lib/zurvas/gifts";
import { clientIp, error, handler, ok, readJson, tooManyAttempts } from "@/lib/zurvas/http";
import { getActiveProvider } from "@/lib/zurvas/payments";
import { getStore } from "@/lib/zurvas/store";

function siteOrigin(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

// Бэлэг үүсгэж, төлбөрийн нэхэмжлэл гаргана. Нэвтрэх шаардлагагүй.
export const POST = handler(async (req) => {
  if (tooManyAttempts(`gift:${clientIp(req)}`, 10)) {
    return error("Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.", 429);
  }

  const body = await readJson(req);
  const username = normalizeUsername(String(body.username ?? ""));
  const product = getProduct(String(body.productId ?? ""));
  const anonymous = body.anonymous !== false;
  const note = String(body.note ?? "").trim();
  const typedName = String(body.senderName ?? "").trim();

  if (!product) return error("Бэлэг олдсонгүй.");
  if (note.length > GIFT_NOTE_MAX) {
    return error(`Мэндчилгээ ${GIFT_NOTE_MAX} тэмдэгтээс хэтрэхгүй байх ёстой.`);
  }
  if (body.method !== "qpay") {
    return error("Одоогоор зөвхөн QPay-ээр төлөх боломжтой.");
  }

  const provider = getActiveProvider();
  if (!provider) return error("Төлбөрийн систем хараахан тохируулагдаагүй байна.", 503);

  const store = getStore();
  const recipient = await store.getUserByUsername(username);
  if (!recipient) return error("Хэрэглэгч олдсонгүй.", 404);

  // Нэрээ харуулах бол: нэвтэрсэн хэрэглэгч → баталгаатай @нэр,
  // эс бөгөөс өөрийн бичсэн нэр (баталгаагүй).
  let senderName: string | null = null;
  let senderVerified = false;
  if (!anonymous) {
    const me = await getCurrentUser();
    if (me) {
      senderName = `@${me.username}`;
      senderVerified = true;
    } else if (typedName && typedName.length <= SENDER_NAME_MAX) {
      senderName = typedName;
    } else {
      return error(`Нэрээ бичнэ үү (${SENDER_NAME_MAX} тэмдэгт хүртэл).`);
    }
  }

  // Үнийг хэзээ ч клиентээс авахгүй — зөвхөн серверийн каталогоос.
  const gift = await store.createGift({
    userId: recipient.id,
    productId: product.id,
    amountMnt: product.priceMnt,
    senderName,
    senderVerified,
    note: note || null,
    paymentProvider: provider.id,
  });

  const invoice = await provider.createInvoice(
    gift,
    `${siteOrigin(req)}/api/zurvas/payments/qpay/callback?gift=${gift.id}`
  );
  await store.setGiftPaymentRef(gift.id, invoice.ref);

  return ok({
    giftId: gift.id,
    amountMnt: gift.amountMnt,
    qrImage: invoice.qrImage,
    links: invoice.links,
    testMode: provider.id === "mock",
  });
});
