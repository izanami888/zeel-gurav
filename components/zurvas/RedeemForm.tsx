"use client";

import { useState } from "react";
import { api } from "@/lib/zurvas/client";

export default function RedeemForm({ code }: { code: string }) {
  const [partnerCode, setPartnerCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api("/api/zurvas/redeem", "POST", { code, partnerCode });
    setBusy(false);
    if (res.ok) setDone(String(res.partner));
    else setError(res.error ?? "Алдаа гарлаа.");
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl bg-emerald-500 p-6 text-center text-white">
        <div className="text-5xl">✅</div>
        <div className="mt-2 text-xl font-bold">Амжилттай ашиглалаа</div>
        <div className="text-sm opacity-90">{done}</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm text-white/70">
        Түншийн код (зөвхөн кофе шопын ажилтан)
        <input
          type="password"
          value={partnerCode}
          onChange={(e) => setPartnerCode(e.target.value)}
          autoComplete="off"
          required
          className="w-full rounded-xl border border-white/15 bg-mongol-blue px-4 py-3 text-white outline-none focus:border-mongol-gold"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        disabled={busy}
        className="rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 font-semibold text-mongol-blue disabled:opacity-50"
      >
        {busy ? "Шалгаж байна..." : "Бэлгийг олгох"}
      </button>
    </form>
  );
}
