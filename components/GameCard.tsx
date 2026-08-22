import Link from "next/link";
import type { GameMeta } from "@/lib/games";

export default function GameCard({ game }: { game: GameMeta }) {
  const isAvailable = game.status === "available";

  const cardContent = (
    <div
      className={`flex h-full flex-col gap-3 rounded-2xl border p-5 transition ${
        isAvailable
          ? "border-mongol-gold/30 bg-mongol-blue-light/50 hover:-translate-y-0.5 hover:border-mongol-gold hover:shadow-lg hover:shadow-mongol-gold/10"
          : "border-white/10 bg-mongol-blue-light/20 opacity-60"
      }`}
    >
      <div className="text-4xl">{game.emoji}</div>
      <h3 className="text-lg font-semibold text-white">{game.name}</h3>
      <p className="flex-1 text-sm text-white/60">{game.description}</p>
      {isAvailable ? (
        <span className="inline-flex w-fit items-center rounded-full bg-mongol-gold px-3 py-1 text-xs font-semibold text-mongol-blue">
          Тоглох
        </span>
      ) : (
        <span className="inline-flex w-fit items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/50">
          Тун удахгүй
        </span>
      )}
    </div>
  );

  if (!isAvailable) {
    return <div className="cursor-not-allowed">{cardContent}</div>;
  }

  return (
    <Link href={game.href} className="block h-full">
      {cardContent}
    </Link>
  );
}
