"use client";

import { useState } from "react";
import Link from "next/link";
import { MESSAGE_MAX } from "@/lib/zurvas/config";
import { api } from "@/lib/zurvas/client";

export default function SendForm({ username, prompt }: { username: string; prompt: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    const res = await api("/api/zurvas/send", "POST", { username, message });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      setMessage("");
    } else {
      setError(res.error ?? "Алдаа гарлаа.");
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-8 text-center">
        <div className="text-5xl">✅</div>
        <h2 className="text-2xl font-bold text-white">Зурвас илгээгдлээ!</h2>
        <p className="text-sm text-white/60">
          @{username} таныг хэн болохыг мэдэхгүй.
        </p>
        <Link
          href="/zurvas"
          className="w-full rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 font-semibold text-mongol-blue"
        >
          Өөрийн линкийг авах
        </Link>
        <button
          onClick={() => setSent(false)}
          className="text-sm font-medium text-mongol-gold-light underline underline-offset-4"
        >
          Дахин зурвас илгээх
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-mongol-gold/30">
        <div className="bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-5 py-4">
          <div className="text-sm font-semibold text-mongol-blue/70">@{username}</div>
          <div className="text-lg font-bold text-mongol-blue">{prompt}</div>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={6}
          placeholder="Энд нууц зурвасаа бичээрэй..."
          aria-label="Зурвас"
          className="block w-full resize-none bg-white px-5 py-4 text-lg text-mongol-blue placeholder-mongol-blue/40 outline-none"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <span>🔒 Таны нэр хэнд ч харагдахгүй</span>
        <span>
          {message.length}/{MESSAGE_MAX}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        disabled={busy || !message.trim()}
        className="rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3.5 text-lg font-semibold text-mongol-blue transition disabled:opacity-50"
      >
        {busy ? "Илгээж байна..." : "Илгээх"}
      </button>
    </form>
  );
}
