"use client";

import { useState } from "react";
import {
  buildResultImageUrl,
  downloadResultImage,
  tryShareResultImage,
  type ResultImageParams,
} from "@/lib/resultImage";
import AdBanner from "@/components/AdBanner";

interface ResultShareCardProps extends ResultImageParams {
  onPlayAgain: () => void;
}

/**
 * Тоглоом дуусахад харагдах үр дүн + хуваалцах дэлгэц.
 * Дурын тоглоомоос дахин ашиглаж болно: game/result/subtitle дамжуулна.
 */
export default function ResultShareCard({
  game,
  result,
  subtitle,
  onPlayAgain,
}: ResultShareCardProps) {
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const imageUrl = buildResultImageUrl({ game, result, subtitle });
  const fileName = `${game.replace(/\s+/g, "-")}-tsuu.png`;

  async function handleShare() {
    setBusy("share");
    const shared = await tryShareResultImage(imageUrl, fileName, `${game}: ${result}`);
    if (!shared) {
      await downloadResultImage(imageUrl, fileName);
    }
    setBusy(null);
  }

  async function handleDownload() {
    setBusy("download");
    await downloadResultImage(imageUrl, fileName);
    setBusy(null);
  }

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-6 text-center">
      <h2 className="text-3xl font-bold text-white">{result}</h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${game} үр дүн`}
        className="aspect-[9/16] w-full max-w-[240px] rounded-xl border border-white/10 object-cover shadow-lg"
      />

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={handleShare}
          disabled={busy !== null}
          className="rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 text-sm font-semibold text-mongol-blue transition disabled:opacity-60"
        >
          {busy === "share" ? "Бэлдэж байна..." : "Instagram Story-д хуваалцах"}
        </button>
        <button
          onClick={handleDownload}
          disabled={busy !== null}
          className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/90 transition hover:border-white/40 disabled:opacity-60"
        >
          {busy === "download" ? "Татаж байна..." : "Зураг татах"}
        </button>
      </div>

      <button
        onClick={onPlayAgain}
        className="text-sm font-medium text-mongol-gold-light underline underline-offset-4"
      >
        Дахин тоглох
      </button>

      <div className="w-full pt-2">
        <AdBanner placement="result_screen" />
      </div>
    </div>
  );
}
