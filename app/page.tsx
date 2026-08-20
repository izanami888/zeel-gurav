import SiteHeader from "@/components/SiteHeader";
import GameCard from "@/components/GameCard";
import AdBanner from "@/components/AdBanner";
import { games } from "@/lib/games";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <section className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Хамт тоглох цаг боллоо
          </h1>
          <p className="mt-3 text-white/60">
            Найз, гэр бүлийнхэнтэйгээ нэг төхөөрөмж дээр тоглоомоо тоглоод,
            үр дүнгээ хуваалцаарай.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>

        <section className="mt-12">
          <AdBanner placement="homepage" />
        </section>
      </main>

      <footer className="border-t border-mongol-gold/10 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Тоглоомын Тавцан — playboard.mn
      </footer>
    </div>
  );
}
