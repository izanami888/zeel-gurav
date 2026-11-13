import { NextResponse } from "next/server";
import { settleGift } from "@/lib/zurvas/payments";

export const dynamic = "force-dynamic";

// QPay төлбөр төлөгдөхөд энэ хаягийг дуудна. Callback-д өөрт нь итгэхгүй —
// төлбөрийг QPay-ээс дахин шалгаж байж л "төлөгдсөн" болгоно.
async function callback(req: Request) {
  const giftId = new URL(req.url).searchParams.get("gift");
  if (!giftId) return new NextResponse("missing gift", { status: 400 });
  try {
    await settleGift(giftId);
    return new NextResponse("SUCCESS");
  } catch (e) {
    console.error("[zurvas] qpay callback", e);
    return new NextResponse("error", { status: 500 });
  }
}

export const GET = callback;
export const POST = callback;
