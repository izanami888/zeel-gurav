import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-mongol-gold/20">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎲</span>
          <span className="text-xl font-bold tracking-tight text-mongol-gold-light">
            Тоглоомын Тавцан
          </span>
        </Link>
        <nav className="text-sm text-white/70">
          <span className="hidden sm:inline">playboard.mn</span>
        </nav>
      </div>
    </header>
  );
}
