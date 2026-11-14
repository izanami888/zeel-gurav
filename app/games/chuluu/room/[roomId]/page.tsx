import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import OnlineChuluuGame from "@/components/games/OnlineChuluuGame";
import { isOnlineConfigured } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Чулуу таалцах (онлайн) — Тоглоомын Тавцан",
};

export default function ChuluuRoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  const roomId = params.roomId.trim().toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 py-10">
        <div className="mb-6 flex w-full items-center justify-between">
          <Link
            href="/games/chuluu"
            className="text-sm text-white/50 hover:text-white/80"
          >
            ← Буцах
          </Link>
          <h1 className="text-xl font-bold text-white">Чулуу · онлайн</h1>
          <span className="w-12" />
        </div>

        {isOnlineConfigured() ? (
          <OnlineChuluuGame roomId={roomId} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-6 text-center">
            <p className="text-white/80">
              Онлайн горим одоогоор ажиллахгүй байна.
            </p>
            <Link
              href="/games/chuluu"
              className="rounded-full bg-mongol-gold px-6 py-3 text-sm font-semibold text-mongol-blue"
            >
              Чулуу таалцах руу буцах
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
