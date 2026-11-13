"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/zurvas/client";
import { profilePath } from "@/lib/zurvas/config";
import {
  GIFT_NOTE_MAX,
  GIFT_PRODUCTS,
  GIFT_VALID_DAYS,
  SENDER_NAME_MAX,
  formatMnt,
} from "@/lib/zurvas/gifts";

interface Invoice {
  giftId: string;
  amountMnt: number;
  qrImage: string | null;
  links: { name: string; logo?: string; link: string }[];
  testMode: boolean;
}

interface GiftFormProps {
  username: string;
  /** Нэвтэрсэн бол илгээгчийн @нэр. */
  me: string | null;
}

const input =
  "w-full rounded-xl border border-white/15 bg-mongol-blue px-4 py-3 text-white placeholder-white/30 outline-none focus:border-mongol-gold";
const card = "rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-5";
const goldButton =
  "rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3.5 text-lg font-semibold text-mongol-blue transition disabled:opacity-50";

export default function GiftForm({ username, me }: GiftFormProps) {
  const product = GIFT_PRODUCTS[0];
  const [anonymous, setAnonymous] = useState(true);
  const [senderName, setSenderName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paid, setPaid] = useState(false);

  // Төлбөр орсон эсэхийг 3 секунд тутам шалгана.
  useEffect(() => {
    if (!invoice || paid) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/zurvas/gifts/${invoice.giftId}`, { cache: "no-store" });
        const data = await res.json();
        if (data.paid) setPaid(true);
      } catch {
        // сүлжээний түр алдаа — дараагийн удаа дахин шалгана
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [invoice, paid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api("/api/zurvas/gifts", "POST", {
      username,
      productId: product.id,
      anonymous,
      senderName,
      note,
      method: "qpay",
    });
    setBusy(false);
    if (res.ok) setInvoice(res as unknown as Invoice);
    else setError(res.error ?? "Алдаа гарлаа.");
  }

  async function payTest() {
    if (!invoice) return;
    await api("/api/zurvas/payments/mock", "POST", { giftId: invoice.giftId });
  }

  if (paid) {
    return (
      <div className={`${card} flex flex-col items-center gap-5 p-8 text-center`}>
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">Бэлэг илгээгдлээ!</h2>
        <p className="text-sm text-white/60">
          @{username} {product.name.toLowerCase()}ны QR кодоо хүлээн авлаа. {GIFT_VALID_DAYS} хоногийн
          дотор түнш кофе шопуудад ашиглах боломжтой.
        </p>
        <Link href={profilePath(username)} className={`${goldButton} w-full`}>
          Буцах
        </Link>
      </div>
    );
  }

  if (invoice) {
    return (
      <div className={`${card} flex flex-col items-center gap-5 text-center`}>
        <h2 className="text-xl font-bold text-white">
          {formatMnt(invoice.amountMnt)} төлөх
        </h2>
        <p className="text-sm text-white/60">
          Банкны аппаараа QR кодыг уншуулж төлнө үү.
        </p>
        {invoice.qrImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={invoice.qrImage}
            alt="Төлбөрийн QR код"
            className="h-60 w-60 rounded-xl bg-white p-2"
          />
        ) : null}

        {invoice.links.length > 0 ? (
          <div className="grid w-full grid-cols-4 gap-3">
            {invoice.links.map((l) => (
              <a
                key={l.link}
                href={l.link}
                className="flex flex-col items-center gap-1 text-[11px] text-white/70"
              >
                {l.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.logo} alt="" className="h-12 w-12 rounded-xl" />
                ) : null}
                <span className="line-clamp-2">{l.name}</span>
              </a>
            ))}
          </div>
        ) : null}

        <p role="status" className="flex items-center gap-2 text-sm text-mongol-gold-light">
          <span className="h-2 w-2 animate-pulse rounded-full bg-mongol-gold" />
          Төлбөр хүлээж байна...
        </p>

        {invoice.testMode ? (
          <button onClick={payTest} className="rounded-full border border-dashed border-white/40 px-5 py-2.5 text-sm text-white/80">
            🧪 Туршилтын төлбөр төлөх (зөвхөн dev)
          </button>
        ) : null}

        <button
          onClick={() => setInvoice(null)}
          className="text-sm text-white/50 underline underline-offset-4"
        >
          Цуцлах
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className={`${card} flex items-center gap-4`}>
        <span className="text-5xl">{product.emoji}</span>
        <div className="flex-1">
          <div className="text-lg font-semibold text-white">{product.name}</div>
          <div className="text-sm text-white/60">{product.description}</div>
        </div>
        <div className="text-lg font-bold text-mongol-gold-light">
          {formatMnt(product.priceMnt)}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-white/70">Хэн илгээснийг харуулах уу?</legend>
        {[
          { value: true, title: "🕶️ Нэрээ нууцлах", text: "Хэн илгээснийг мэдэхгүй." },
          {
            value: false,
            title: "🙋 Нэрээ харуулах",
            text: me ? `@${me} гэж харагдана.` : "Доор бичсэн нэр харагдана.",
          },
        ].map((o) => (
          <label
            key={String(o.value)}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${
              anonymous === o.value ? "border-mongol-gold bg-mongol-gold/10" : "border-white/15"
            }`}
          >
            <input
              type="radio"
              name="identity"
              checked={anonymous === o.value}
              onChange={() => setAnonymous(o.value)}
              className="mt-1 accent-mongol-gold"
            />
            <span>
              <span className="block font-medium text-white">{o.title}</span>
              <span className="block text-sm text-white/50">{o.text}</span>
            </span>
          </label>
        ))}
        {!anonymous && !me ? (
          <input
            className={input}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            maxLength={SENDER_NAME_MAX}
            placeholder="Таны нэр"
            aria-label="Таны нэр"
            required
          />
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm text-white/70">
        Мэндчилгээ (заавал биш)
        <textarea
          className={`${input} resize-none`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={GIFT_NOTE_MAX}
          placeholder="Жишээ: Өдрийг сайхан өнгөрүүлээрэй!"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-white/70">Төлбөрийн хэрэгсэл</legend>
        <label className="flex items-center gap-3 rounded-xl border border-mongol-gold bg-mongol-gold/10 px-4 py-3">
          <input type="radio" name="method" checked readOnly className="accent-mongol-gold" />
          <span className="font-medium text-white">QPay (банкны апп)</span>
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 opacity-50">
          <input type="radio" name="method" disabled />
          <span className="text-white">Банкны карт — тун удахгүй</span>
        </label>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button disabled={busy} className={goldButton}>
        {busy ? "Түр хүлээнэ үү..." : `${formatMnt(product.priceMnt)} төлөх`}
      </button>
      <p className="text-center text-xs text-white/40">
        Бэлэг төлбөр төлөгдсөнөөс хойш {GIFT_VALID_DAYS} хоног хүчинтэй.
      </p>
    </form>
  );
}
