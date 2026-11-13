import type { Metadata } from "next";
import RedeemForm from "@/components/zurvas/RedeemForm";
import { formatDate, getProduct } from "@/lib/zurvas/gifts";
import { getStore } from "@/lib/zurvas/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Бэлэг ашиглах — Нууц зурвас",
  robots: { index: false },
};

// Түнш кофе шопын ажилтан хэрэглэгчийн QR-ыг уншуулахад нээгдэх хуудас.
export default async function RedeemPage({ params }: { params: { code: string } }) {
  const store = getStore();
  const gift = await store.getGiftByRedeemCode(decodeURIComponent(params.code));
  const product = gift ? getProduct(gift.productId) : undefined;
  const expired = Boolean(gift?.expiresAt && gift.expiresAt <= new Date().toISOString());
  const partner =
    gift?.status === "redeemed" && gift.redeemedBy
      ? await store.getPartnerById(gift.redeemedBy)
      : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-white">Бэлэг шалгах</h1>

      {!gift ? (
        <div role="alert" className="rounded-2xl bg-red-500 p-6 text-center text-white">
          <div className="text-5xl">❌</div>
          <div className="mt-2 text-xl font-bold">Хүчингүй QR код</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 text-mongol-blue">
            <span className="text-5xl">{product?.emoji ?? "🎁"}</span>
            <div>
              <div className="text-xl font-bold">{product?.name ?? "Бэлэг"}</div>
              <div className="text-sm text-mongol-blue/60">{product?.description}</div>
              {gift.expiresAt ? (
                <div className="text-sm text-mongol-blue/60">
                  {formatDate(gift.expiresAt)} хүртэл хүчинтэй
                </div>
              ) : null}
            </div>
          </div>

          {gift.status === "redeemed" ? (
            <div role="alert" className="rounded-2xl bg-slate-500 p-6 text-center text-white">
              <div className="text-xl font-bold">Аль хэдийн ашигласан</div>
              <div className="text-sm opacity-90">
                {gift.redeemedAt ? formatDate(gift.redeemedAt) : ""}
                {partner ? ` · ${partner.name}` : ""}
              </div>
            </div>
          ) : expired ? (
            <div role="alert" className="rounded-2xl bg-red-500 p-6 text-center text-white">
              <div className="text-xl font-bold">Хугацаа дууссан</div>
            </div>
          ) : (
            <RedeemForm code={gift.redeemCode!} />
          )}
        </>
      )}
    </main>
  );
}
