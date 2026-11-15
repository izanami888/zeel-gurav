"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  DURVUN_BERKH_STEPS,
  SHAGAI_PER_ROLL,
  SIDES,
  SIDE_NAME,
  countHorses,
  placeOf,
  standings,
  type MoriPlayer,
  type RaceState,
  type RollOutcome,
  type Side,
} from "@/games/mori/logic";
import { CARD, PRIMARY_BUTTON } from "@/components/games/ui";

// "Морь уралдуулах" тоглоомын UI хэсгүүд: шагайн зураг, морь, зам,
// байрын жагсаалт, дүрмийн цонх. Нэг төхөөрөмжийн болон онлайн горим
// хоёулаа эдгээрийг ашиглана.

// Хөдөлгөөний хугацаа (мс).
export const ROLL_MS = 850; // шагай эргэлдэх
export const REVEAL_MS = 950; // буусан талыг уншуулах
export const NO_MOVE_MS = 1200; // морь буугаагүйг уншуулах
export const BERKH_MS = 2700; // дөрвөн бэрхийн баяр
export const STEP_MS = 320; // морины нэг алхам
export const PUSH_MS = 900; // түлхэгдсэн морь ухрах
export const SETTLE_MS = 550; // дараагийн ээлж рүү шилжих
export const FINISH_MS = 1500; // барианд орсныг харуулах

/** Хаялтын үр дүн үгээр: "2 морь — 2 алхам урагшаа". */
export function describeRoll(outcome: RollOutcome): string {
  if (outcome.durvunBerkh) return `Дөрвөн бэрх — ${outcome.steps} алхам урагшаа!`;
  if (outcome.horses === 0) return "Морь буусангүй — хөдлөхгүй";
  const text = `${outcome.horses} морь — ${outcome.steps} алхам урагшаа`;
  return outcome.rollAgain ? `${text}, дахин хаяна!` : text;
}

/** Суудал бүрийн морины өнгө. */
export const HORSE_COLORS = [
  "#F87171",
  "#38BDF8",
  "#34D399",
  "#FB923C",
  "#A78BFA",
  "#F1F5F9",
];

export const SIDE_EMOJI: Record<Side, string> = {
  mori: "🐎",
  khoni: "🐑",
  yamaa: "🐐",
  temee: "🐫",
};

export const TEXT_INPUT =
  "w-full rounded-xl border border-mongol-gold/30 bg-mongol-blue/60 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-mongol-gold focus:outline-none";

/**
 * Морин дээр бичих богино тэмдэг: "Тоглогч 2" → "2", "Бат" → "Б".
 * Гол ялгах зүйл нь өнгө; тэмдэг нь нэмэлт туслах.
 */
export function horseLabel(name: string): string {
  const trimmed = name.trim();
  const digit = trimmed.match(/(\d)\s*$/);
  if (digit) return digit[1];
  return (Array.from(trimmed)[0] ?? "?").toUpperCase();
}

// Шагайн хялбаршуулсан дүрс (48x48): өргөн тал ба нарийн хажуу тал.
const BROAD_SHAPE =
  "M14 5C19 2 29 2 34 5C40 8 42 15 39 21C37.5 23 37.5 25 39 27C42 33 40 40 34 43C29 46 19 46 14 43C8 40 6 33 9 27C10.5 25 10.5 23 9 21C6 15 8 8 14 5Z";
const NARROW_SHAPE =
  "M19 4C21.5 2.5 26.5 2.5 29 4C33 6.5 34 13 32 19C31 22 31 26 32 29C34 35 33 41.5 29 44C26.5 45.5 21.5 45.5 19 44C15 41.5 14 35 16 29C17 26 17 22 16 19C14 13 15 6.5 19 4Z";

const BONE = "#EADFC6";
const BONE_LIGHT = "#FFF9EA";
const BONE_SHADE = "#B9A57C";
const BONE_DARK = "#5C4A2A";

/**
 * Шагайн нэг талын энгийн зураг. Өргөн дүрс = өргөн тал (хонь, ямаа),
 * нарийн дүрс = хажуу тал (морь, тэмээ); цайвар товгор = гүдгэр,
 * бараан хонхор = хонхор.
 */
export function SideIcon({ side, size = 44 }: { side: Side; size?: number }) {
  const outline = { stroke: BONE_DARK, strokeWidth: 2, fill: BONE };
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      {side === "khoni" && (
        <>
          <path d={BROAD_SHAPE} {...outline} />
          <ellipse cx="24" cy="14.5" rx="9" ry="6" fill={BONE_LIGHT} />
          <ellipse cx="24" cy="33.5" rx="9" ry="6" fill={BONE_LIGHT} />
        </>
      )}
      {side === "yamaa" && (
        <>
          <path d={BROAD_SHAPE} {...outline} />
          <ellipse cx="24" cy="24" rx="9.5" ry="13" fill={BONE_DARK} opacity="0.75" />
          <ellipse cx="24" cy="27" rx="6" ry="8.5" fill={BONE_SHADE} />
        </>
      )}
      {side === "mori" && (
        <>
          <path d={NARROW_SHAPE} {...outline} />
          <path
            d="M24 9C28 17 20 23 24 31C26 35 23 38 24 41"
            fill="none"
            stroke={BONE_SHADE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {side === "temee" && (
        <>
          <path d={NARROW_SHAPE} {...outline} />
          <ellipse cx="24" cy="24" rx="4.5" ry="10" fill={BONE_DARK} opacity="0.75" />
        </>
      )}
    </svg>
  );
}

/** Аль талаараа буусан нь тодорхойгүй (хаяагүй эсвэл эргэлдэж буй) шагай. */
function BlankShagai({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <path d={BROAD_SHAPE} fill={BONE} stroke={BONE_DARK} strokeWidth="2" />
    </svg>
  );
}

/** Тоглогчийн морь: өөрийн өнгөтэй шагай. `size` өгөөгүй бол эцэг элементээ дүүргэнэ. */
export function HorseToken({
  color,
  label,
  size,
}: {
  color: string;
  label: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={size === undefined ? "block h-full w-full" : "block shrink-0"}
      aria-hidden
    >
      <path d={BROAD_SHAPE} fill={color} stroke="#0B1F3A" strokeWidth="3" />
      <text
        x="24"
        y="24"
        dy="0.36em"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="#0B1F3A"
      >
        {label}
      </text>
    </svg>
  );
}

function ShagaiTile({
  side,
  rolling,
  index,
  berkh,
}: {
  side: Side | null;
  rolling: boolean;
  index: number;
  berkh: boolean;
}) {
  const base =
    "relative flex h-24 flex-col items-center justify-center gap-1 rounded-xl border";

  if (rolling) {
    return (
      <div className={`${base} border-white/10 bg-white/5`}>
        <span
          className="animate-shagai-toss motion-reduce:animate-none"
          style={{
            animationDelay: `${index * 60}ms`,
            animationDuration: `${400 + index * 45}ms`,
          }}
        >
          <BlankShagai />
        </span>
        <span className="text-sm font-bold text-white/30">…</span>
      </div>
    );
  }

  if (!side) {
    return (
      <div className={`${base} border-white/10 bg-white/5`}>
        <span className="opacity-30">
          <BlankShagai />
        </span>
        <span className="text-sm font-bold text-white/20">?</span>
      </div>
    );
  }

  const counts = side === "mori" || berkh;
  return (
    <div
      role="img"
      aria-label={SIDE_NAME[side]}
      className={`${base} animate-shagai-land motion-reduce:animate-none ${
        counts
          ? "border-mongol-gold bg-mongol-gold/15 shadow-md shadow-mongol-gold/20"
          : "border-white/10 bg-white/5"
      }`}
      style={{ animationDelay: `${index * 110}ms` }}
    >
      <span className="absolute right-1 top-0.5 text-base leading-tight" aria-hidden>
        {SIDE_EMOJI[side]}
      </span>
      <SideIcon side={side} />
      <span
        className={`text-sm font-bold ${
          counts ? "text-mongol-gold-light" : "text-white/75"
        }`}
      >
        {SIDE_NAME[side]}
      </span>
    </div>
  );
}

/** Хаясан 4 шагай: эргэлдэх хөдөлгөөн, дараа нь буусан тал бүр нэртэйгээ. */
export function ShagaiRow({
  roll,
  rolling,
  berkh = false,
}: {
  roll: Side[] | null;
  rolling: boolean;
  berkh?: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-4 gap-2">
      {Array.from({ length: SHAGAI_PER_ROLL }, (_, index) => {
        const side = rolling ? null : roll?.[index] ?? null;
        return (
          <ShagaiTile
            // Төлөв солигдоход шинээр үүсэж, буух хөдөлгөөн дахин тоглоно.
            key={`${index}-${rolling ? "rolling" : side ?? "idle"}`}
            side={side}
            rolling={rolling}
            index={index}
            berkh={berkh}
          />
        );
      })}
    </div>
  );
}

const CONFETTI_COLORS = ["#F1D57A", "#F87171", "#38BDF8", "#34D399", "#FB923C", "#A78BFA"];
const CONFETTI = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2;
  const distance = 120 + (index % 3) * 35;
  return {
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance)}px`,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    // Шагайнууд бууж дууссаны дараа цацарна.
    delay: `${500 + (index % 4) * 70}ms`,
  };
});

/** "Дөрвөн бэрх" буусны баяр. */
export function BerkhCelebration() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 flex animate-berkh-fade items-center justify-center bg-black/50 p-6 motion-reduce:animate-none"
    >
      <div className="relative flex animate-berkh-pop flex-col items-center gap-2 rounded-3xl border-2 border-mongol-gold bg-mongol-blue px-8 py-7 text-center shadow-2xl shadow-mongol-gold/40 motion-reduce:animate-none">
        {CONFETTI.map((piece, index) => (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 h-2.5 w-2.5 animate-berkh-confetti rounded-sm motion-reduce:hidden"
            style={
              {
                "--dx": piece.dx,
                "--dy": piece.dy,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
              } as CSSProperties
            }
          />
        ))}
        <p className="text-3xl tracking-widest">
          {SIDES.map((side) => SIDE_EMOJI[side]).join("")}
        </p>
        <p className="text-3xl font-extrabold text-mongol-gold-light">Дөрвөн бэрх!</p>
        <p className="text-base font-semibold text-white">
          {DURVUN_BERKH_STEPS} алхам урагшаа
        </p>
      </div>
    </div>
  );
}

// Замын зураглал: дээр нь гараа, дунд нь шагайн эгнээнүүд, доор нь бариа.
const STRIP_HEIGHT = 44;
const STRIP_GAP = 6;
const STRIP_TOKEN = 28;

/** Нэг шагай дээрх морьдын байрлал (нүдний хэмжээнд харьцуулсан x, y). */
const CELL_SLOTS: Array<Array<[number, number]>> = [
  [],
  [[0.5, 0.5]],
  [
    [0.3, 0.5],
    [0.7, 0.5],
  ],
  [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.5, 0.7],
  ],
  [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
  [
    [0.2, 0.3],
    [0.5, 0.3],
    [0.8, 0.3],
    [0.35, 0.7],
    [0.65, 0.7],
  ],
  [
    [0.2, 0.3],
    [0.5, 0.3],
    [0.8, 0.3],
    [0.2, 0.7],
    [0.5, 0.7],
    [0.8, 0.7],
  ],
];
const CELL_TOKEN = [0, 32, 25, 23, 23, 18, 18];

function trackLayout(trackLength: number) {
  const columns = trackLength % 6 === 0 ? 6 : 5;
  const rows = Math.ceil(trackLength / columns);
  const rowHeight = rows >= 5 ? 50 : 58;
  const gridTop = STRIP_HEIGHT + STRIP_GAP;
  const finishTop = gridTop + rows * rowHeight + STRIP_GAP;
  return { columns, rowHeight, gridTop, finishTop, height: finishTop + STRIP_HEIGHT };
}

/** Гараа/барианы зурвас дахь `slot`-ын хэвтээ байрлал (%). */
function stripX(slot: number, count: number): number {
  return 24 + (slot + 0.5) * (72 / count);
}

/**
 * Уралдааны зам. Шагайнууд эгнээгээр цувж, утасны дэлгэцэнд хэдэн мөр
 * болж нугарна. Морьд байрлал солигдоход гулсаж шилжинэ.
 */
export function Track({
  players,
  positions,
  finishOrder,
  trackLength,
  activeSeat,
}: {
  players: MoriPlayer[];
  /** Суудал бүрийн харагдах байрлал (0 = гараа, trackLength + 1 = бариа). */
  positions: number[];
  finishOrder: number[];
  trackLength: number;
  activeSeat: number | null;
}) {
  const layout = trackLayout(trackLength);
  const finish = trackLength + 1;

  const spot = (seat: number) => {
    const position = positions[seat];
    if (position <= 0) {
      return {
        x: stripX(seat, players.length),
        y: STRIP_HEIGHT / 2,
        size: STRIP_TOKEN,
      };
    }
    if (position >= finish) {
      return {
        x: stripX(Math.max(0, finishOrder.indexOf(seat)), players.length),
        y: layout.finishTop + STRIP_HEIGHT / 2,
        size: STRIP_TOKEN,
      };
    }
    const sharing = positions
      .map((other, otherSeat) => (other === position ? otherSeat : -1))
      .filter((otherSeat) => otherSeat >= 0);
    const [slotX, slotY] = CELL_SLOTS[sharing.length][sharing.indexOf(seat)];
    const cell = position - 1;
    return {
      x: (((cell % layout.columns) + slotX) / layout.columns) * 100,
      y:
        layout.gridTop +
        (Math.floor(cell / layout.columns) + slotY) * layout.rowHeight,
      size: CELL_TOKEN[sharing.length],
    };
  };

  const strip =
    "absolute inset-x-0 flex items-center rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-widest";

  return (
    <div className="relative w-full" style={{ height: layout.height }} aria-hidden>
      <div
        className={`${strip} top-0 border-white/10 bg-white/5 text-white/50`}
        style={{ height: STRIP_HEIGHT }}
      >
        Гараа
      </div>

      <div
        className="absolute inset-x-0 grid"
        style={{
          top: layout.gridTop,
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: trackLength }, (_, index) => (
          <svg
            key={index}
            viewBox="0 0 48 48"
            className="w-full"
            style={{ height: layout.rowHeight }}
          >
            <path
              d={BROAD_SHAPE}
              fill={BONE}
              fillOpacity="0.16"
              stroke={BONE}
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
            <text
              x="24"
              y="24"
              dy="0.36em"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#FFFFFF"
              fillOpacity="0.4"
            >
              {index + 1}
            </text>
          </svg>
        ))}
      </div>

      <div
        className={`${strip} border-mongol-gold/40 bg-mongol-gold/10 text-mongol-gold-light`}
        style={{ top: layout.finishTop, height: STRIP_HEIGHT }}
      >
        🏁 Бариа
      </div>

      {players.map((player, seat) => {
        const { x, y, size } = spot(seat);
        const place = positions[seat] >= finish ? finishOrder.indexOf(seat) + 1 : 0;
        const active = seat === activeSeat;
        return (
          <div
            key={seat}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out motion-reduce:transition-none"
            style={{
              left: `${x}%`,
              top: y,
              width: size,
              height: size,
              zIndex: active ? 20 : 10,
            }}
          >
            <div
              // Алхам бүрд шинээр үүсэж, морь "харайна".
              key={positions[seat]}
              className={`relative h-full w-full ${
                positions[seat] > 0 ? "animate-horse-hop motion-reduce:animate-none" : ""
              }`}
              style={
                active
                  ? { filter: "drop-shadow(0 0 5px rgba(241, 213, 122, 0.95))" }
                  : undefined
              }
            >
              <HorseToken color={HORSE_COLORS[seat]} label={horseLabel(player.name)} />
              {place > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-mongol-gold text-[10px] font-bold text-mongol-blue">
                  {place}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BADGE = "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium";
const YOU_BADGE = `${BADGE} bg-mongol-gold/20 text-mongol-gold-light`;
const OFFLINE_BADGE = `${BADGE} bg-red-500/20 text-red-200`;

/** Хэн түрүүлж яваагийн жижиг жагсаалт. */
export function RankingList({
  players,
  race,
  trackLength,
  activeSeat,
  youSeat,
  offlineSeats,
}: {
  players: MoriPlayer[];
  race: RaceState;
  trackLength: number;
  activeSeat: number | null;
  /** "та" тэмдэг авах суудал (компьютертэй болон онлайн горимд). */
  youSeat: number | null;
  /** Онлайн горимд холболт нь тасарсан суудлууд. */
  offlineSeats?: Set<number>;
}) {
  const finish = trackLength + 1;
  return (
    <div className={`p-3 ${CARD}`}>
      <p className="mb-2 text-xs uppercase tracking-widest text-mongol-gold-light/80">
        Одоогийн байр
      </p>
      <ol className="flex flex-col gap-1.5">
        {standings(race).map((seat) => {
          const position = race.positions[seat];
          const done = race.finishOrder.includes(seat);
          const place = placeOf(race, seat);
          const offline = !done && (offlineSeats?.has(seat) ?? false);
          return (
            <li
              key={seat}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-sm ${
                seat === activeSeat ? "bg-white/10" : ""
              }`}
            >
              <span className="w-4 text-center font-bold tabular-nums text-white/60">
                {place}
              </span>
              <HorseToken
                color={HORSE_COLORS[seat]}
                label={horseLabel(players[seat].name)}
                size={22}
              />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium text-white">
                <span className="truncate">{players[seat].name}</span>
                {players[seat].isComputer && <span aria-hidden>🤖</span>}
                {seat === youSeat && <span className={YOU_BADGE}>та</span>}
                {offline && <span className={OFFLINE_BADGE}>холболтгүй</span>}
              </span>
              {/* "холболтгүй" тэмдэгтэй мөрөнд нэрэнд зай үлдээхээр зурвасыг нуув. */}
              {!offline && (
                <span
                  className="hidden h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-white/10 min-[380px]:block"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(Math.min(position, finish) / finish) * 100}%`,
                      backgroundColor: HORSE_COLORS[seat],
                    }}
                  />
                </span>
              )}
              <span
                className={`w-[5.25rem] shrink-0 whitespace-nowrap text-right text-xs tabular-nums ${
                  done ? "font-semibold text-mongol-gold-light" : "text-white/60"
                }`}
              >
                {done
                  ? `🏁 ${place}-р байр`
                  : position === 0
                    ? "гараанд"
                    : `${position} / ${trackLength}`}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Шагайн мөр + үр дүнгийн үг + том товч. Шодолт, уралдаан хоёуланд нь. */
export function RollPanel({
  roll,
  rolling,
  berkh = false,
  lead,
  message,
  detail,
  button,
}: {
  roll: Side[] | null;
  rolling: boolean;
  berkh?: boolean;
  /** Өгвөл шагайн мөрийн оронд харуулна. */
  lead?: ReactNode;
  message: string;
  detail?: string | null;
  /** onClick байхгүй бол товч идэвхгүй. */
  button: { label: string; onClick?: () => void };
}) {
  return (
    <div className={`flex flex-col items-center gap-3 p-4 text-center ${CARD}`}>
      {lead ?? <ShagaiRow roll={roll} rolling={rolling} berkh={berkh} />}
      <div className="flex min-h-[3.25rem] flex-col justify-center" aria-live="polite">
        <p className="text-lg font-bold leading-snug text-white">{message}</p>
        {detail && <p className="text-sm leading-snug text-white/60">{detail}</p>}
      </div>
      <button
        type="button"
        disabled={!button.onClick}
        onClick={button.onClick}
        className={`w-full touch-manipulation py-4 text-lg ${PRIMARY_BUTTON}`}
      >
        {button.label}
      </button>
    </div>
  );
}

/** Уралдааны толгой: хэний ээлж болохыг морьтой нь харуулна. */
export function TurnHeader({
  players,
  seat,
  label,
  onShowRules,
}: {
  players: MoriPlayer[];
  seat: number;
  /** Нэрийн дээрх жижиг бичиг: "Ээлж", "Таны ээлж", "Түрүү магнай". */
  label: string;
  onShowRules: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <HorseToken
          color={HORSE_COLORS[seat]}
          label={horseLabel(players[seat].name)}
          size={40}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-mongol-gold-light/80">
            {label}
          </p>
          <p className="truncate text-lg font-bold leading-tight text-white">
            {players[seat].name}
          </p>
        </div>
      </div>
      <RulesButton onClick={onShowRules} />
    </div>
  );
}

export interface OpeningRow {
  /** Харуулах хаялт (хараахан хаяагүй бол null). */
  roll: Side[] | null;
  /** "rolling" = одоо хаях ээлжтэй, "first" = эхлэгчээр тодорсон. */
  mark?: "rolling" | "first" | null;
  /** Энэ тойрогт оролцохгүй тул бүдэг харагдана. */
  dim?: boolean;
  offline?: boolean;
}

/** Эхлэх дарааллын шодолт: гарчиг, тэнцсэний мэдэгдэл, тоглогчдын хаялт. */
export function OpeningBoard({
  players,
  rows,
  tie,
  youSeat,
  onShowRules,
}: {
  players: MoriPlayer[];
  rows: OpeningRow[];
  /** Сүүлийн тойрог тэнцсэн бол: хэн, хэдэн морьтой. */
  tie: { seats: number[]; horses: number } | null;
  youSeat: number | null;
  onShowRules: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Хэн эхлэх вэ?</h2>
          <p className="text-xs leading-relaxed text-white/60">
            Бүгд 4 шагай хаяна. Хамгийн олон морь буулгасан нь эхэлнэ.
          </p>
        </div>
        <RulesButton onClick={onShowRules} />
      </div>

      {tie && (
        <p
          role="status"
          className="rounded-xl border border-mongol-gold/40 bg-mongol-gold/10 px-3 py-2 text-center text-sm font-medium text-mongol-gold-light"
        >
          Тэнцлээ ({tie.horses} морь)!{" "}
          {tie.seats.map((seat) => players[seat].name).join(", ")} дахин хаяна.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {players.map((player, seat) => {
          const row = rows[seat];
          return (
            <li
              key={seat}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
                row.mark === "first"
                  ? "border-emerald-400 bg-emerald-500/15"
                  : row.mark === "rolling"
                    ? "border-mongol-gold bg-mongol-blue-light/70"
                    : "border-white/10 bg-mongol-blue-light/40"
              } ${row.dim ? "opacity-50" : ""}`}
            >
              <HorseToken
                color={HORSE_COLORS[seat]}
                label={horseLabel(player.name)}
                size={30}
              />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-white">
                <span className="truncate">{player.name}</span>
                {player.isComputer && <span aria-hidden>🤖</span>}
                {seat === youSeat && <span className={YOU_BADGE}>та</span>}
                {row.offline && <span className={OFFLINE_BADGE}>холболтгүй</span>}
                {row.mark === "first" && (
                  <span className={`${BADGE} bg-emerald-500/20 text-emerald-200`}>
                    эхэлнэ
                  </span>
                )}
              </span>
              {row.roll ? (
                <>
                  <span className="text-sm tracking-tight" aria-hidden>
                    {row.roll.map((side) => SIDE_EMOJI[side]).join("")}
                  </span>
                  <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-mongol-gold-light">
                    {countHorses(row.roll)} морь
                  </span>
                </>
              ) : (
                <span className="w-14 shrink-0 text-right text-sm text-white/30">–</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Уралдаан дууссаны дараах байрын жагсаалт (1-р байр, 2-р байр ...). */
export function FinalPlaces({
  players,
  places,
  youSeat,
}: {
  players: MoriPlayer[];
  /** Суудлууд байрын дарааллаар. */
  places: number[];
  youSeat: number | null;
}) {
  return (
    <div className={`flex w-full flex-col gap-3 p-4 ${CARD}`}>
      <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
        Эцсийн байр
      </p>
      <ol className="flex flex-col gap-3">
        {places.map((seat, index) => (
          <li key={seat} className="flex items-center gap-3">
            <span
              className={`w-[4.5rem] shrink-0 whitespace-nowrap text-sm font-bold tabular-nums ${
                index === 0 ? "text-mongol-gold-light" : "text-white/60"
              }`}
            >
              {index + 1}-р байр
            </span>
            <HorseToken
              color={HORSE_COLORS[seat]}
              label={horseLabel(players[seat].name)}
              size={28}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <span className="truncate">{players[seat].name}</span>
                {players[seat].isComputer && <span aria-hidden>🤖</span>}
                {seat === youSeat && <span className={YOU_BADGE}>та</span>}
              </span>
              {index === 0 && (
                <span className="block text-xs font-semibold text-mongol-gold-light">
                  🏆 Түрүү магнай
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RulesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full border border-mongol-gold/40 px-4 py-1.5 text-sm font-medium text-mongol-gold-light transition active:scale-95"
    >
      📖 Дүрэм
    </button>
  );
}

const RULES: string[] = [
  "Тоглогч бүр өөрийн өнгийн нэг морьтой. Бүх морь гараанаас — эхний шагайн өмнөөс эхэлнэ.",
  "Эхлээд бүгд 4 шагай хаяна. Хамгийн олон морь буулгасан нь түрүүлж эхэлнэ. Тэнцвэл тэнцсэн тоглогчид дахин хаяна. Дараа нь ээлж суудлын дарааллаар явна.",
  "Ээлжиндээ 4 шагай хаяна. Буусан морь бүрээр 1 алхам урагшилна. Морь буугаагүй бол хөдлөхгүй.",
  "4 морь буувал 4 алхам урагшлаад дахин хаяна.",
  `"Дөрвөн бэрх" — морь, хонь, ямаа, тэмээ тус бүр нэг буувал ${DURVUN_BERKH_STEPS} алхам урагшилна.`,
  "Нэг шагай дээр хэдэн ч морь зэрэг зогсож болно. «Түлхэх дүрэм» асаалттай бол таны буусан шагай дээр байсан морь 1 алхам ухарна.",
  "Сүүлийн шагайг давсан эхний морь түрүүлнэ — «Түрүү магнай». Яг таарсан тоо буух шаардлагагүй.",
  "3 ба түүнээс олон тоглогчтой бол бүх байр тодортол үргэлжилнэ. Барианд орсон тоглогч ээлжээ алгасна.",
];

const SIDE_HINT: Record<Side, string> = {
  mori: "Нарийн хажуу тал, гүдгэр. Алхам өгдөг ганц тал.",
  temee: "Нарийн хажуу тал, хонхор.",
  khoni: "Өргөн тал, гүдгэр.",
  yamaa: "Өргөн тал, хонхор.",
};
const SIDE_ORDER: Side[] = ["mori", "temee", "khoni", "yamaa"];

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

        <h3 className="text-base font-bold text-white">Шагайн 4 тал</h3>
        <p className="-mt-2 text-sm leading-relaxed text-white/70">
          Шагай аль талаараа буусныг зураг, нэр хоёроор нь харуулна.
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {SIDE_ORDER.map((side) => (
            <li
              key={side}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center ${
                side === "mori"
                  ? "border-mongol-gold bg-mongol-gold/15"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <SideIcon side={side} size={48} />
              <span className="text-sm font-bold text-white">
                {SIDE_EMOJI[side]} {SIDE_NAME[side]}
              </span>
              <span className="text-xs leading-snug text-white/60">{SIDE_HINT[side]}</span>
            </li>
          ))}
        </ul>

        <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
          Ойлголоо
        </button>
      </div>
    </div>
  );
}
