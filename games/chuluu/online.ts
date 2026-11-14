import {
  MAX_HIDE_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROUND_LIMIT_OPTIONS,
  START_STONE_OPTIONS,
  getGameResult,
  guessOrder,
  hideLimit,
  isActive,
  isGuessAllowed,
  maxPossibleTotal,
  resolveRound,
  type ChuluuPlayer,
  type ChuluuSettings,
  type GameResult,
  type RoundOutcome,
} from "./logic";

// "Чулуу таалцах" онлайн өрөөний төлөв ба дүрэм. Сервер (API route) болон
// клиент хоёулаа ашигладаг цэвэр логик — сүлжээ, өгөгдлийн сан байхгүй.
//
// ЧУХАЛ: тоглогчдын атгасан чулууны тоо `ChuluuRoom`-д ХЭЗЭЭ Ч байхгүй
// (зөвхөн `hidden_done` — сонгосон эсэх). Бодит тоо тусдаа, нийтэд
// уншигдахгүй хүснэгтэд хадгалагдаж, бүгд таасны дараа л `revealed` болж
// өрөөнд нийтлэгдэнэ.

export type RoomStatus = "lobby" | "playing" | "finished";
export type RoomPhase = "hide" | "guess" | "reveal";

export interface OnlinePlayer {
  name: string;
  stones: number;
  /** Тоглогчийн нууц ID-ийн SHA-256 hash. */
  hash: string;
}

/** value === null бол ээлж алгасагдсан (холболт тасарсан). */
export interface OnlineGuess {
  seat: number;
  value: number | null;
}

/** `chuluu_rooms` хүснэгтийн нэг мөр. */
export interface ChuluuRoom {
  id: string;
  settings: ChuluuSettings;
  players: OnlinePlayer[];
  status: RoomStatus;
  round: number;
  guess_order: number[];
  phase: RoomPhase | null;
  /** Суудал бүр атгаж дууссан эсэх (тоо нь биш!). */
  hidden_done: boolean[];
  guesses: OnlineGuess[];
  /** `guess_order` доторх одоо таах ээлжийн индекс. */
  turn: number;
  /** Гар нээгдсэний дараа л бөглөгдөнө. */
  revealed: Array<number | null> | null;
  outcome: RoundOutcome | null;
  result: GameResult | null;
  turn_started_at: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type ChuluuAction =
  | { type: "view" }
  | { type: "ping" }
  | { type: "join"; name: string }
  | { type: "start" }
  | { type: "hide"; round: number; count: number }
  | { type: "guess"; round: number; value: number }
  | { type: "next"; round: number }
  | { type: "skip"; round: number; seat: number };

export type ChuluuErrorCode =
  | "not_configured"
  | "bad_request"
  | "not_found"
  | "not_player"
  | "not_host"
  | "room_full"
  | "already_started"
  | "need_players"
  | "wrong_phase"
  | "stale"
  | "not_your_turn"
  | "already_hidden"
  | "bad_count"
  | "guess_taken"
  | "bad_guess"
  | "too_early"
  | "conflict"
  | "network"
  | "server_error";

export const CHULUU_ERROR_MESSAGE: Record<ChuluuErrorCode, string> = {
  not_configured: "Онлайн горим одоогоор ажиллахгүй байна.",
  bad_request: "Буруу хүсэлт илгээгдлээ.",
  not_found: "Ийм өрөө олдсонгүй.",
  not_player: "Та энэ өрөөнд тоглогч биш байна.",
  not_host: "Зөвхөн өрөө үүсгэсэн хүн эхлүүлнэ.",
  room_full: "Өрөө дүүрсэн байна.",
  already_started: "Тоглоом аль хэдийн эхэлсэн байна.",
  need_players: "Дор хаяж 2 тоглогч хэрэгтэй.",
  wrong_phase: "Одоо энэ үйлдлийг хийх боломжгүй.",
  stale: "Тоглоомын төлөв өөрчлөгдсөн байна.",
  not_your_turn: "Таны ээлж биш байна.",
  already_hidden: "Та аль хэдийн атгасан байна.",
  bad_count: "Ийм тооны чулуу атгах боломжгүй.",
  guess_taken: "Энэ тоог өөр хүн хэлсэн байна.",
  bad_guess: "Ийм тоо таах боломжгүй.",
  too_early: "Хараахан алгасах боломжгүй.",
  conflict: "Тоглоомын төлөв өөрчлөгдсөн байна. Дахин оролдоно уу.",
  network: "Сүлжээний алдаа гарлаа. Интернэт холболтоо шалгана уу.",
  server_error: "Серверийн алдаа гарлаа. Дахин оролдоно уу.",
};

export type RoomPatch = Partial<
  Pick<
    ChuluuRoom,
    | "players"
    | "status"
    | "round"
    | "guess_order"
    | "phase"
    | "hidden_done"
    | "guesses"
    | "turn"
    | "revealed"
    | "outcome"
    | "result"
  >
>;

export type Plan =
  | { ok: true; patch: RoomPatch }
  | { ok: false; error: ChuluuErrorCode };

export const MAX_NAME_LENGTH = 14;

export function cleanName(value: unknown, fallback: string): string {
  const name =
    typeof value === "string"
      ? value.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH)
      : "";
  return name || fallback;
}

/** Клиентээс ирсэн тохиргоог зөвшөөрөгдсөн утгууд руу шүүнэ. */
export function parseSettings(value: unknown): ChuluuSettings | null {
  if (!value || typeof value !== "object") return null;
  const { startStones, maxHide, roundLimit } = value as Record<string, unknown>;
  if (
    !START_STONE_OPTIONS.includes(startStones as number) ||
    !MAX_HIDE_OPTIONS.includes(maxHide as number) ||
    !ROUND_LIMIT_OPTIONS.includes(roundLimit as number | null)
  ) {
    return null;
  }
  return {
    startStones: startStones as number,
    maxHide: maxHide as number,
    roundLimit: roundLimit as number | null,
  };
}

export function isChuluuAction(value: unknown): value is ChuluuAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  const int = (key: string) => Number.isInteger(action[key]);
  switch (action.type) {
    case "view":
    case "ping":
    case "start":
      return true;
    case "join":
      return typeof action.name === "string";
    case "hide":
      return int("round") && int("count");
    case "guess":
      return int("round") && int("value");
    case "next":
      return int("round");
    case "skip":
      return int("round") && int("seat");
    default:
      return false;
  }
}

export function toLogicPlayers(room: ChuluuRoom): ChuluuPlayer[] {
  return room.players.map((player) => ({
    name: player.name,
    stones: player.stones,
    isComputer: false,
  }));
}

export function seatOf(room: ChuluuRoom, hash: string): number | null {
  const seat = room.players.findIndex((player) => player.hash === hash);
  return seat >= 0 ? seat : null;
}

/** Одоо үйлдэл хийхийг нь хүлээж буй суудлууд. */
export function pendingSeats(room: ChuluuRoom): number[] {
  if (room.status !== "playing") return [];
  if (room.phase === "hide") {
    return room.players
      .map((player, seat) => (player.stones > 0 && !room.hidden_done[seat] ? seat : -1))
      .filter((seat) => seat >= 0);
  }
  if (room.phase === "guess") {
    const seat = room.guess_order[room.turn];
    return seat === undefined ? [] : [seat];
  }
  return [];
}

function newRound(
  players: ChuluuPlayer[],
  round: number,
  starter: number
): RoomPatch {
  return {
    round,
    guess_order: guessOrder(players, starter),
    phase: "hide",
    // Хасагдсан тоглогч сонгох шаардлагагүй.
    hidden_done: players.map((player) => !isActive(player)),
    guesses: [],
    turn: 0,
    revealed: null,
    outcome: null,
  };
}

export function planJoin(room: ChuluuRoom, hash: string, name: unknown): Plan {
  if (room.status !== "lobby") return { ok: false, error: "already_started" };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: "room_full" };
  return {
    ok: true,
    patch: {
      players: [
        ...room.players,
        {
          name: cleanName(name, `Тоглогч ${room.players.length + 1}`),
          stones: room.settings.startStones,
          hash,
        },
      ],
    },
  };
}

/** Зөвхөн өрөө үүсгэсэн хүн (0-р суудал) эхлүүлнэ. */
export function planStart(room: ChuluuRoom, seat: number): Plan {
  if (room.status !== "lobby") return { ok: false, error: "already_started" };
  if (seat !== 0) return { ok: false, error: "not_host" };
  if (room.players.length < MIN_PLAYERS) return { ok: false, error: "need_players" };
  return {
    ok: true,
    patch: { status: "playing", ...newRound(toLogicPlayers(room), 1, 0) },
  };
}

/**
 * Чулуу атгах. Атгасан тоо энэ patch-д ОРОХГҮЙ — сервер түүнийг нууц
 * хүснэгтэд тусад нь хадгална.
 */
export function planHide(room: ChuluuRoom, seat: number, count: number): Plan {
  if (room.status !== "playing" || room.phase !== "hide") {
    return { ok: false, error: "wrong_phase" };
  }
  const players = toLogicPlayers(room);
  if (!isActive(players[seat])) return { ok: false, error: "not_player" };
  if (room.hidden_done[seat]) return { ok: false, error: "already_hidden" };
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > hideLimit(players[seat], room.settings)
  ) {
    return { ok: false, error: "bad_count" };
  }

  const hidden_done = room.hidden_done.map((done, index) => done || index === seat);
  const patch: RoomPatch = { hidden_done };
  if (hidden_done.every(Boolean)) {
    patch.phase = "guess";
    patch.turn = 0;
  }
  return { ok: true, patch };
}

/**
 * Таах (value === null бол алгасах). Сүүлчийн таамаг бол `needsReveal`
 * буцаж, сервер нууц гаруудыг уншаад `planReveal`-ийг нэмж бичнэ.
 */
export function planGuess(
  room: ChuluuRoom,
  seat: number,
  value: number | null
): (Plan & { ok: true; needsReveal: boolean }) | (Plan & { ok: false }) {
  if (room.status !== "playing" || room.phase !== "guess") {
    return { ok: false, error: "wrong_phase" };
  }
  if (room.guess_order[room.turn] !== seat) {
    return { ok: false, error: "not_your_turn" };
  }
  if (value !== null) {
    const maxTotal = maxPossibleTotal(toLogicPlayers(room), room.settings);
    if (!Number.isInteger(value) || value < 0 || value > maxTotal) {
      return { ok: false, error: "bad_guess" };
    }
    const taken = room.guesses
      .filter((guess) => guess.value !== null)
      .map((guess) => ({ seat: guess.seat, value: guess.value as number }));
    if (!isGuessAllowed(value, taken, maxTotal)) {
      return { ok: false, error: "guess_taken" };
    }
  }

  const turn = room.turn + 1;
  return {
    ok: true,
    patch: { guesses: [...room.guesses, { seat, value }], turn },
    needsReveal: turn >= room.guess_order.length,
  };
}

/** Бүгд таасны дараа: нууц гаруудыг нийтэлж, үеийн үр дүнг тооцно. */
export function planReveal(
  room: ChuluuRoom,
  guesses: OnlineGuess[],
  hands: Map<number, number>
): RoomPatch {
  const players = toLogicPlayers(room);
  const revealed = players.map((player, seat) =>
    isActive(player) ? hands.get(seat) ?? 0 : null
  );
  const realGuesses = guesses
    .filter((guess) => guess.value !== null)
    .map((guess) => ({ seat: guess.seat, value: guess.value as number }));
  return {
    phase: "reveal",
    revealed,
    outcome: resolveRound(players, revealed, realGuesses),
  };
}

/** Гар нээгдсэний дараа: чулууг шилжүүлж, дараагийн үе эсвэл төгсгөл. */
export function planNext(room: ChuluuRoom): Plan {
  if (room.status !== "playing" || room.phase !== "reveal" || !room.outcome) {
    return { ok: false, error: "wrong_phase" };
  }
  const stonesAfter = room.outcome.stonesAfter;
  const players = room.players.map((player, seat) => ({
    ...player,
    stones: stonesAfter[seat],
  }));
  const logicPlayers = players.map((player) => ({
    name: player.name,
    stones: player.stones,
    isComputer: false,
  }));

  const result = getGameResult(logicPlayers, room.round, room.settings);
  if (result) {
    return { ok: true, patch: { players, status: "finished", result } };
  }
  // Эхэлж таах хүн үе бүрд нэг суудлаар шилжинэ.
  const starter = (room.guess_order[0] + 1) % players.length;
  return {
    ok: true,
    patch: { players, ...newRound(logicPlayers, room.round + 1, starter) },
  };
}
