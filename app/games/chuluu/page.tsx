import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ChuluuGame from "@/components/games/ChuluuGame";
import { isOnlineConfigured } from "@/lib/supabaseAdmin";

export const metadata = {
  title: "Чулуу таалцах — Тоглоомын Тавцан",
};

export default function ChuluuPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 py-10">
        <div className="mb-6 flex w-full items-center justify-between">
          <Link href="/" className="text-sm text-white/50 hover:text-white/80">
            ← Буцах
          </Link>
          <h1 className="text-xl font-bold text-white">Чулуу таалцах</h1>
          <span className="w-12" />
        </div>

        <ChuluuGame onlineEnabled={isOnlineConfigured()} />
      </main>
    </div>
  );
}
