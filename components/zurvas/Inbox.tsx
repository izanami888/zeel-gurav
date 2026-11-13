"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_PROMPT, PROMPT_MAX, profilePath } from "@/lib/zurvas/config";
import GiftList, { type InboxGift } from "@/components/zurvas/GiftList";
import { api, timeAgo } from "@/lib/zurvas/client";
import { renderStoryImage, shareOrDownload } from "@/lib/zurvas/storyImage";

export interface InboxMessage {
  id: string;
  body: string;
  createdAt: string;
  isNew: boolean;
}

interface InboxProps {
  username: string;
  prompt: string | null;
  messages: InboxMessage[];
  gifts: InboxGift[];
}

const ghostButton =
  "rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/90 transition hover:border-white/40 disabled:opacity-50";
const goldButton =
  "rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-4 py-2 text-sm font-semibold text-mongol-blue transition disabled:opacity-50";

export default function Inbox({ username, prompt: initialPrompt, messages: initial, gifts }: InboxProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [savedPrompt, setSavedPrompt] = useState(initialPrompt ?? "");
  const [host, setHost] = useState("");
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setHost(window.location.host), []);
  useEffect(() => setMessages(initial), [initial]);

  const path = profilePath(username);
  const link = `${host}${path}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Линкийг хуулж чадсангүй. Гараар хуулна уу.");
    }
  }

  async function savePrompt() {
    const res = await api("/api/zurvas/profile", "PATCH", { prompt });
    if (res.ok) {
      setSavedPrompt(prompt.trim());
      setNotice("Асуулт хадгалагдлаа.");
    } else {
      setNotice(res.error ?? "Алдаа гарлаа.");
    }
  }

  async function share(m: InboxMessage) {
    setBusyId(m.id);
    try {
      const blob = await renderStoryImage({
        prompt: savedPrompt || DEFAULT_PROMPT,
        message: m.body,
        link,
      });
      await shareOrDownload(blob, "nuuts-zurvas.png");
    } catch {
      setNotice("Зураг үүсгэж чадсангүй.");
    }
    setBusyId(null);
  }

  async function remove(m: InboxMessage, block: boolean) {
    const question = block
      ? "Энэ илгээгчийг блоклох уу? Түүнээс дахин зурвас ирэхгүй, энэ зурвас устна."
      : "Энэ зурвасыг устгах уу?";
    if (!window.confirm(question)) return;

    setBusyId(m.id);
    const res = block
      ? await api(`/api/zurvas/messages/${m.id}/block`, "POST")
      : await api(`/api/zurvas/messages/${m.id}`, "DELETE");
    setBusyId(null);
    if (res.ok) {
      setMessages((list) => list.filter((x) => x.id !== m.id));
      setNotice(block ? "Илгээгчийг блоклолоо." : "Зурвас устлаа.");
    } else {
      setNotice(res.error ?? "Алдаа гарлаа.");
    }
  }

  async function logout() {
    await api("/api/zurvas/logout", "POST");
    router.push("/zurvas");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Линк */}
      <section className="flex flex-col gap-4 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Таны линк</h2>
          <button onClick={logout} className="text-sm text-white/50 underline underline-offset-4">
            Гарах
          </button>
        </div>
        <div className="break-all rounded-xl bg-mongol-blue px-4 py-3 font-mono text-sm text-mongol-gold-light">
          {link}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyLink} className={goldButton}>
            {copied ? "Хуулагдлаа ✓" : "Линк хуулах"}
          </button>
          <a href={path} target="_blank" rel="noreferrer" className={ghostButton}>
            Хуудсаа харах
          </a>
        </div>
        <p className="text-sm text-white/50">
          Линкээ Instagram story эсвэл Facebook дээрээ тавиад найзуудаасаа нууц зурвас аваарай.
        </p>

        <label className="flex flex-col gap-1.5 text-sm text-white/70">
          Хуудсан дээр харагдах асуулт
          <div className="flex gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={PROMPT_MAX}
              placeholder={DEFAULT_PROMPT}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-mongol-blue px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-mongol-gold"
            />
            <button
              onClick={savePrompt}
              disabled={prompt.trim() === savedPrompt}
              className={ghostButton}
            >
              Хадгалах
            </button>
          </div>
        </label>
      </section>

      {notice ? (
        <p role="status" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white/80">
          {notice}
        </p>
      ) : null}

      <GiftList gifts={gifts} />

      {/* Зурвасууд */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Ирсэн зурвас{messages.length ? ` (${messages.length})` : ""}
          </h2>
          <button onClick={() => router.refresh()} className="text-sm text-mongol-gold-light">
            ↻ Шинэчлэх
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/50">
            <div className="mb-2 text-4xl">📭</div>
            Одоогоор зурвас алга. Линкээ хуваалцаарай!
          </div>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 text-mongol-blue">
              <div className="flex items-center justify-between text-xs text-mongol-blue/50">
                <span>{timeAgo(m.createdAt)}</span>
                {m.isNew ? (
                  <span className="rounded-full bg-mongol-gold px-2 py-0.5 font-semibold text-mongol-blue">
                    Шинэ
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-lg font-medium">{m.body}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => share(m)}
                  disabled={busyId === m.id}
                  className="rounded-full bg-mongol-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Story-д хуваалцах
                </button>
                <button
                  onClick={() => remove(m, false)}
                  disabled={busyId === m.id}
                  className="rounded-full border border-mongol-blue/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Устгах
                </button>
                <button
                  onClick={() => remove(m, true)}
                  disabled={busyId === m.id}
                  className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                >
                  Блоклох
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
