"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// Онлайн өрөөг хуваалцах хэсэг: QR код, өрөөний код, холбоос,
// "Холбоос хуулах" болон (утасны цэстэй бол) "Хуваалцах" товч.
// Онлайн горимтой бүх тоглоом дундаа ашиглана.

const PRIMARY_BUTTON =
  "rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 text-sm font-semibold text-mongol-blue transition active:scale-95 disabled:opacity-60";
const SECONDARY_BUTTON =
  "rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/40 active:scale-95 disabled:opacity-40";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Хуучин хөтөч эсвэл зөвшөөрөлгүй үед.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

interface RoomShareProps {
  roomId: string;
  /** Өрөөний хуудасны зам, жишээ нь "/games/chess/room/ABC123". */
  path: string;
  shareTitle: string;
  shareText: string;
}

export default function RoomShare({
  roomId,
  path,
  shareTitle,
  shareText,
}: RoomShareProps) {
  const [link, setLink] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}${path}`);
    setCanShare(typeof navigator.share === "function");
  }, [path]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (await copyText(link)) setCopied(true);
  }

  async function handleShare() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: link });
    } catch {
      // Хэрэглэгч цуцалсан.
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="rounded-2xl bg-white p-3">
        {link ? (
          <QRCodeSVG
            value={link}
            size={184}
            fgColor="#0B1F3A"
            bgColor="#FFFFFF"
            title="Өрөөний QR код"
          />
        ) : (
          <div className="h-[184px] w-[184px]" />
        )}
      </div>

      <p className="text-sm text-white/70">
        QR кодыг уншуулах эсвэл доорх холбоосыг найздаа илгээнэ үү.
      </p>

      <div className="w-full">
        <p className="text-xs uppercase tracking-widest text-mongol-gold-light/80">
          Өрөөний код
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-white">
          {roomId}
        </p>
        <p className="mt-2 break-all rounded-lg bg-mongol-blue/60 px-3 py-2 text-xs text-white/70">
          {link}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={handleCopy} className={PRIMARY_BUTTON}>
          {copied ? "Хуулагдлаа ✓" : "Холбоос хуулах"}
        </button>
        {canShare && (
          <button type="button" onClick={handleShare} className={SECONDARY_BUTTON}>
            Хуваалцах
          </button>
        )}
      </div>
    </div>
  );
}
