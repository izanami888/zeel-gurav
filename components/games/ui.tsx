import type { ReactNode } from "react";

// Тоглоомуудын дунд хуваалцдаг товч, картын загвар.

export const PRIMARY_BUTTON =
  "rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3.5 text-base font-semibold text-mongol-blue transition active:scale-95 disabled:opacity-50";
export const SECONDARY_BUTTON =
  "rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/40 active:scale-95";
export const CARD =
  "rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50";

export function optionClass(active: boolean) {
  return `flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition active:scale-95 ${
    active
      ? "border-mongol-gold bg-mongol-gold text-mongol-blue"
      : "border-mongol-gold/30 bg-mongol-blue-light/50 text-white"
  }`;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <legend className="mb-3 text-sm uppercase tracking-widest text-mongol-gold-light/80">
      {children}
    </legend>
  );
}
