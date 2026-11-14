"use client";

import type { ReactNode } from "react";

// "Чулуу таалцах" тоглоомын жижиг UI хэсгүүд: чулуу, гар, товч, дүрмийн цонх.

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

/** Нэг жижиг чулуу. */
export function Stone({
  size = "sm",
  delayMs,
}: {
  size?: "sm" | "md";
  /** Өгвөл чулуу "үсэрч" гарч ирнэ (гар нээгдэх үед). */
  delayMs?: number;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 border border-black/30 bg-gradient-to-br from-[#E4E7EC] to-[#8A93A1] shadow-sm shadow-black/40 ${
        size === "md" ? "h-4 w-5" : "h-2.5 w-3"
      } ${delayMs !== undefined ? "animate-stone-pop" : ""}`}
      style={{
        borderRadius: "55% 45% 50% 50% / 60% 55% 45% 40%",
        animationDelay: delayMs !== undefined ? `${delayMs}ms` : undefined,
      }}
    />
  );
}

/** Тоглогчийн чулууны овоолго: дүрс + тоо. */
export function StonePile({ count }: { count: number }) {
  return (
    <div
      className="flex items-center gap-2"
      aria-label={`${count} чулуу`}
      role="img"
    >
      <span className="w-5 text-right text-sm font-bold tabular-nums text-white">
        {count}
      </span>
      {count > 0 ? (
        <span className="flex flex-wrap gap-0.5">
          {Array.from({ length: count }, (_, index) => (
            <Stone key={index} />
          ))}
        </span>
      ) : (
        <span className="text-xs text-white/40">чулуугүй</span>
      )}
    </div>
  );
}

export type FistState =
  | { kind: "waiting" } // хараахан атгаагүй
  | { kind: "closed"; shake?: boolean } // атгасан, нууц
  | { kind: "open"; count: number } // нээгдсэн
  | { kind: "out" }; // хасагдсан

/** Атгасан гар. Нээгдэх үед алга болон чулуунууд харагдана. */
export function Fist({ state }: { state: FistState }) {
  if (state.kind === "out") {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center text-2xl opacity-30">
        ✊
      </div>
    );
  }

  if (state.kind === "open") {
    return (
      <div
        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center"
        role="img"
        aria-label={`Гарт ${state.count} чулуу`}
      >
        <span className="animate-fist-open text-3xl leading-none">🖐️</span>
        <span className="mt-1 flex h-4 items-center gap-0.5">
          {state.count === 0 ? (
            <span className="animate-stone-pop text-[10px] font-semibold text-white/60">
              хоосон
            </span>
          ) : (
            Array.from({ length: state.count }, (_, index) => (
              <Stone key={index} delayMs={350 + index * 120} />
            ))
          )}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center text-3xl ${
        state.kind === "waiting" ? "opacity-40 grayscale" : ""
      }`}
      role="img"
      aria-label={state.kind === "waiting" ? "Хараахан атгаагүй" : "Атгасан гар"}
    >
      <span className={state.kind === "closed" && state.shake ? "animate-fist-shake" : ""}>
        ✊
      </span>
    </div>
  );
}

/** Том тооны товчнууд (атгах тоо, таамаг сонгоход). */
export function NumberPad({
  max,
  selected,
  taken,
  onSelect,
  columns,
}: {
  max: number;
  selected: number | null;
  taken?: Set<number>;
  onSelect: (value: number) => void;
  columns: number;
}) {
  return (
    <div
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: max + 1 }, (_, value) => {
        const isTaken = taken?.has(value) ?? false;
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            disabled={isTaken}
            aria-pressed={isSelected}
            aria-label={isTaken ? `${value} — хэлэгдсэн` : String(value)}
            onClick={() => onSelect(value)}
            className={`flex h-14 touch-manipulation items-center justify-center rounded-xl border text-2xl font-bold tabular-nums transition active:scale-95 ${
              isTaken
                ? "border-white/10 bg-white/5 text-white/25 line-through"
                : isSelected
                  ? "border-mongol-gold bg-mongol-gold text-mongol-blue"
                  : "border-mongol-gold/30 bg-mongol-blue-light/60 text-white"
            }`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

/** Нууцыг хамгаалах "утсаа дамжуул" дэлгэц. */
export function PassScreen({
  name,
  hint,
  onReady,
}: {
  name: string;
  hint: string;
  onReady: () => void;
}) {
  return (
    <div className={`flex w-full flex-col items-center gap-6 p-8 text-center ${CARD}`}>
      <div className="text-6xl" aria-hidden>
        📱
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">Утсаа {name}-д өг</h2>
        <p className="mt-2 text-sm text-white/60">{hint}</p>
      </div>
      <p className="text-xs text-white/40">
        Бусад тоглогч дэлгэц рүү харахгүй байгаарай.
      </p>
      <button type="button" onClick={onReady} className={`w-full ${PRIMARY_BUTTON}`}>
        Бэлэн
      </button>
    </div>
  );
}

const RULES: string[] = [
  "Тоглогч бүр ижил тооны чулуутай эхэлнэ.",
  "Үе бүрд хүн бүр гартаа хэдэн чулуу атгахаа нууцаар сонгоно (0 байж болно).",
  "Дараа нь ээлжлэн бүх гарт байгаа чулууны НИЙТ тоог таана. Өөр хүний хэлсэн тоог давтаж болохгүй.",
  "Бүгд таасны дараа гараа зэрэг нээнэ.",
  "Яг таасан тоглогч бусад тоглогч бүрээс 1 чулуу авна. Хэн ч таагаагүй бол чулуу солигдохгүй.",
  "Эхэлж таах хүн үе бүрд нэг суудлаар шилжинэ.",
  "Чулуугүй болсон тоглогч хасагдана.",
  "Нэг хүн бүх чулууг авбал ялна. Үеийн тоо дуусвал хамгийн их чулуутай нь ялна; тэнцүү бол тэнцээ.",
];

export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Тоглоомын дүрэм"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-mongol-gold/40 bg-mongol-blue p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white">Хэрхэн тоглох вэ?</h2>
        <ol className="flex flex-col gap-3">
          {RULES.map((rule, index) => (
            <li key={index} className="flex gap-3 text-sm leading-relaxed text-white/85">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mongol-gold text-xs font-bold text-mongol-blue">
                {index + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
          Ойлголоо
        </button>
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <legend className="mb-3 text-sm uppercase tracking-widest text-mongol-gold-light/80">
      {children}
    </legend>
  );
}
