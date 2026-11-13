"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/zurvas/client";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api(`/api/zurvas/${mode}`, "POST", { username, password });
    if (res.ok) {
      router.push("/zurvas/inbox");
      router.refresh();
    } else {
      setError(res.error ?? "Алдаа гарлаа.");
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-white/15 bg-mongol-blue px-4 py-3 text-white placeholder-white/30 outline-none focus:border-mongol-gold";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-6"
    >
      <div className="grid grid-cols-2 gap-1 rounded-full bg-mongol-blue p-1 text-sm font-semibold">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-full py-2 transition ${
              mode === m ? "bg-mongol-gold text-mongol-blue" : "text-white/60"
            }`}
          >
            {m === "signup" ? "Бүртгүүлэх" : "Нэвтрэх"}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm text-white/70">
        Хэрэглэгчийн нэр
        <input
          className={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="жишээ: bat_erdene"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          maxLength={21}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-white/70">
        Нууц үг
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          maxLength={100}
          required
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        disabled={busy}
        className="rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 font-semibold text-mongol-blue transition disabled:opacity-60"
      >
        {busy ? "Түр хүлээнэ үү..." : mode === "signup" ? "Линкээ авах" : "Нэвтрэх"}
      </button>
    </form>
  );
}
