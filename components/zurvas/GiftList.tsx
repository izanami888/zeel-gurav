"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { formatDate, getProduct } from "@/lib/zurvas/gifts";

export interface InboxGift {
  id: string;
  productId: string;
  senderName: string | null;
  senderVerified: boolean;
  note: string | null;
  state: "active" | "redeemed" | "expired";
  expiresAt: string;
  /** Зөвхөн ашиглах боломжтой (active) бэлгэнд ирнэ. */
  redeemCode: string | null;
}

const stateLabel = {
  active: { text: "Ашиглах боломжтой", cls: "bg-emerald-100 text-emerald-800" },
  redeemed: { text: "Ашигласан", cls: "bg-slate-200 text-slate-600" },
  expired: { text: "Хугацаа дууссан", cls: "bg-red-100 text-red-700" },
};

export default function GiftList({ gifts }: { gifts: InboxGift[] }) {
  const [open, setOpen] = useState<{ id: string; qr: string } | null>(null);

  async function toggle(g: InboxGift) {
    if (open?.id === g.id) return setOpen(null);
    const url = `${window.location.origin}/redeem/${g.redeemCode}`;
    setOpen({ id: g.id, qr: await QRCode.toDataURL(url, { width: 480, margin: 1 }) });
  }

  if (gifts.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">Ирсэн бэлэг ({gifts.length})</h2>
      {gifts.map((g) => {
        const product = getProduct(g.productId);
        const label = stateLabel[g.state];
        return (
          <article
            key={g.id}
            className={`flex flex-col gap-3 rounded-2xl bg-white p-5 text-mongol-blue ${
              g.state === "active" ? "" : "opacity-70"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">{product?.emoji ?? "🎁"}</span>
              <div className="flex-1">
                <div className="text-lg font-semibold">{product?.name ?? "Бэлэг"}</div>
                <div className="text-sm text-mongol-blue/60">
                  {g.senderName ? (
                    <>
                      Илгээсэн: <strong>{g.senderName}</strong>
                      {g.senderVerified ? " ✓" : " (өөрөө бичсэн нэр)"}
                    </>
                  ) : (
                    "🕶️ Нэрээ нууцалсан хүнээс"
                  )}
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${label.cls}`}>
                {label.text}
              </span>
            </div>

            {g.note ? (
              <p className="whitespace-pre-wrap break-words rounded-xl bg-mongol-blue/5 px-4 py-3">
                {g.note}
              </p>
            ) : null}

            {g.state === "active" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-mongol-blue/60">
                    {formatDate(g.expiresAt)} хүртэл хүчинтэй
                  </span>
                  <button
                    onClick={() => toggle(g)}
                    className="rounded-full bg-mongol-blue px-4 py-2 text-sm font-semibold text-white"
                  >
                    {open?.id === g.id ? "QR нуух" : "QR код харах"}
                  </button>
                </div>
                {open?.id === g.id ? (
                  <div className="flex flex-col items-center gap-2 border-t border-mongol-blue/10 pt-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={open.qr} alt="Бэлгийн QR код" className="h-60 w-60" />
                    <p className="text-sm text-mongol-blue/60">
                      Түнш кофе шопын ажилтанд энэ QR кодыг үзүүлээрэй. Бусдад бүү
                      илгээгээрэй — нэг л удаа ашиглагдана.
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
