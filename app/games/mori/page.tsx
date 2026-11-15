import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import MoriGame from "@/components/games/MoriGame";
import { isOnlineConfigured } from "@/lib/supabaseAdmin";

export const metadata = {
  title: "Морь уралдуулах — Тоглоомын Тавцан",
};

export default function MoriPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 py-10">
        <div className="mb-6 flex w-full items-center justify-between">
          <Link href="/" className="text-sm text-white/50 hover:text-white/80">
            ← Буцах
          </Link>
          <h1 className="text-xl font-bold text-white">Морь уралдуулах</h1>
          <span className="w-12" />
        </div>

        <MoriGame onlineEnabled={isOnlineConfigured()} />
      </main>
    </div>
  );
}
