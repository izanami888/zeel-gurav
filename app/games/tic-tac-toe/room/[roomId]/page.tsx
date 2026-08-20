import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

// Онлайн олон тоглогчийн (playroom) маршрут — scaffold only.
// Бодит логик хийгдээгүй, зөвхөн "Тун удахгүй" харуулна.
// Хэрэгжүүлэх үед: lib/realtime.ts дахь joinGameRoom-г ашиглан
// roomId-аар Supabase Realtime сувагт холбогдоно.
export default function TicTacToeRoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <div className="text-5xl">🚧</div>
        <h1 className="text-2xl font-bold text-white">Тун удахгүй</h1>
        <p className="text-white/60">
          Онлайн олон тоглогчийн горим (өрөө: {params.roomId}) удахгүй
          нэмэгдэнэ.
        </p>
        <Link
          href="/games/tic-tac-toe"
          className="mt-4 rounded-full bg-mongol-gold px-6 py-3 text-sm font-semibold text-mongol-blue"
        >
          Локал тоглоом руу буцах
        </Link>
      </main>
    </div>
  );
}
