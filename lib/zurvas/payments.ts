import "server-only";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { GIFT_VALID_DAYS, getProduct } from "./gifts";
import { getStore, type ZurvasGift } from "./store";

// Төлбөрийн давхарга. Шинэ төлбөрийн хэрэгсэл (жишээ нь банкны картын
// гарц) нэмэхдээ PaymentProvider-г хэрэгжүүлээд getProvider()-т бүртгэнэ.

export interface PaymentInvoice {
  /** Төлбөрийн системийн нэхэмжлэлийн дугаар. */
  ref: string;
  /** Уншуулах QR зураг (data URL). */
  qrImage: string | null;
  /** Банкны апп руу үсрэх холбоосууд (утсан дээр). */
  links: { name: string; logo?: string; link: string }[];
}

export interface PaymentProvider {
  id: string;
  createInvoice(gift: ZurvasGift, callbackUrl: string): Promise<PaymentInvoice>;
  /** Нэхэмжлэл бүрэн төлөгдсөн эсэхийг төлбөрийн системээс шалгана. */
  isPaid(gift: ZurvasGift): Promise<boolean>;
}

// --------------------------------------------------------------------- QPay
// QPay Merchant API v2. Орчны хувьсагч:
//   QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE
//   QPAY_BASE_URL (заавал биш; sandbox: https://merchant-sandbox.qpay.mn/v2)

const qpayBase = () =>
  (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2").replace(/\/$/, "");

let qpayToken: { value: string; expiresAt: number } | null = null;

async function qpayAccessToken(): Promise<string> {
  if (qpayToken && qpayToken.expiresAt > Date.now() + 60_000) return qpayToken.value;

  const basic = Buffer.from(
    `${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`
  ).toString("base64");
  const res = await fetch(`${qpayBase()}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`QPay auth failed: ${res.status}`);
  const data = await res.json();
  // expires_in нь зарим хувилбарт unix timestamp, заримд секундээр ирдэг.
  const raw = Number(data.expires_in) || 3600;
  const expiresAt = raw > 1_000_000_000 ? raw * 1000 : Date.now() + raw * 1000;
  qpayToken = { value: data.access_token, expiresAt };
  return qpayToken.value;
}

async function qpayRequest(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${qpayBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await qpayAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`QPay ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const qpay: PaymentProvider = {
  id: "qpay",
  async createInvoice(gift, callbackUrl) {
    const product = getProduct(gift.productId);
    const data = await qpayRequest("/invoice", {
      invoice_code: process.env.QPAY_INVOICE_CODE,
      sender_invoice_no: gift.id,
      invoice_receiver_code: "terminal",
      invoice_description: `Бэлэг: ${product?.name ?? gift.productId}`,
      amount: gift.amountMnt,
      callback_url: callbackUrl,
    });
    return {
      ref: data.invoice_id,
      qrImage: data.qr_image ? `data:image/png;base64,${data.qr_image}` : null,
      links: (data.urls ?? []).map((u: any) => ({
        name: u.description || u.name,
        logo: u.logo,
        link: u.link,
      })),
    };
  },
  async isPaid(gift) {
    if (!gift.paymentRef) return false;
    const data = await qpayRequest("/payment/check", {
      object_type: "INVOICE",
      object_id: gift.paymentRef,
      offset: { page_number: 1, page_limit: 100 },
    });
    const paid = (data.rows ?? [])
      .filter((r: any) => r.payment_status === "PAID")
      .reduce((sum: number, r: any) => sum + Number(r.payment_amount ?? 0), 0);
    return paid >= gift.amountMnt;
  },
};

// ------------------------------------------------------- Mock (зөвхөн dev)
// Бодит мөнгө хөдлөхгүй. /api/zurvas/payments/mock-оор "төлсөн" болгоно.

const mock: PaymentProvider = {
  id: "mock",
  async createInvoice(gift) {
    return {
      ref: `mock-${gift.id}`,
      qrImage: await QRCode.toDataURL(`MOCK-PAYMENT:${gift.id}`, { width: 320, margin: 1 }),
      links: [],
    };
  },
  async isPaid() {
    return false;
  },
};

export function isQpayConfigured(): boolean {
  return Boolean(
    process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE
  );
}

/** Одоо идэвхтэй төлбөрийн хэрэгсэл. Тохируулаагүй бол null. */
export function getActiveProvider(): PaymentProvider | null {
  if (isQpayConfigured()) return qpay;
  if (process.env.NODE_ENV !== "production") return mock;
  return null;
}

function providerById(id: string): PaymentProvider | null {
  if (id === "qpay") return isQpayConfigured() ? qpay : null;
  if (id === "mock") return process.env.NODE_ENV !== "production" ? mock : null;
  return null;
}

// ---------------------------------------------------------------- Тооцоо

/** Бэлгийг "төлөгдсөн" болгож, QR-ын код болон дуусах хугацааг онооно. */
export async function markPaid(gift: ZurvasGift): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + GIFT_VALID_DAYS * 24 * 60 * 60 * 1000);
  await getStore().markGiftPaid(
    gift.id,
    randomBytes(18).toString("base64url"),
    now.toISOString(),
    expires.toISOString()
  );
}

/**
 * Хүлээгдэж буй бэлгийн төлбөрийг төлбөрийн системээс шалгаад, төлөгдсөн бол
 * тэмдэглэнэ. Callback болон клиентийн polling аль алинаас дуудагдана —
 * хэдэн ч удаа дуудсан аюулгүй (idempotent).
 */
export async function settleGift(giftId: string): Promise<ZurvasGift | null> {
  const store = getStore();
  const gift = await store.getGift(giftId);
  if (!gift || gift.status !== "pending") return gift;

  const provider = providerById(gift.paymentProvider);
  if (provider && (await provider.isPaid(gift))) {
    await markPaid(gift);
    return store.getGift(giftId);
  }
  return gift;
}
