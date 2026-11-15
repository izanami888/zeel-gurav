import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  SHAGAI_PER_ROLL,
  SIDES,
  TRACK_LENGTH_OPTIONS,
  countHorses,
  evaluateRoll,
  isRaceOver,
  moveHorse,
  nextSeat,
  openingLeaders,
  type MoriPlayer,
  type MoriSettings,
  type RaceState,
  type Side,
} from "./logic";

// "Морь уралдуулах" онлайн өрөөний төлөв ба дүрэм. Сервер (API route) болон
// клиент хоёулаа ашигладаг цэвэр логик — сүлжээ, өгөгдлийн сан байхгүй.
//
// ЧУХАЛ: шагайг зөвхөн СЕРВЕР хаяна. Хөтөч "хая" гэсэн хүсэлт л илгээнэ;
// буусан талуудыг сервер санамсаргүйгээр гаргаж `planRoll`-д дамжуулна.
// Хөтөч хэзээ ч хаялтын үр дүнг илгээхгүй.

/** lobby → opening (эхлэх дарааллын шодолт) → race → finished */
export type RoomStatus = "lobby" | "opening" | "race" | "finished";

export interface OnlinePlayer {
  name: string;
  /** Тоглогчийн нууц ID-ийн SHA-256 hash. */
  hash: string;
}

export interface OpeningState {
  /** Шодолтын тойрог (тэнцэх бүрд нэгээр нэмэгдэнэ). */
  round: number;
  /** Энэ тойрогт хаях суудлууд (суудлын дарааллаар). */
  contenders: number[];
  /** Суудал бүрийн хамгийн сүүлийн хаялт ба аль тойргийнх болох. */
  rolls: Array<{ round: number; sides: Side[] } | null>;
  /** Өмнөх тойрог тэнцсэн бол: хэн, хэдэн морьтой тэнцсэн. */
  tie: { seats: number[]; horses: number } | null;
}

interface RollEventBase {
  /** Хаялтын дугаар (1-ээс). Хөтөч шинэ хаялтыг үүгээр таньж хөдөлгөөн тоглуулна. */
  seq: number;
  seat: number;
  sides: Side[];
  /** Тоглогч удаан чимээгүй байсан тул сервер өмнөөс нь хаясан. */
  auto: boolean;
}

/**
 * Сүүлийн хаялт. Бүх хөтөч үүнийг уншиж ижил хөдөлгөөн (шагай эргэлдэх,
 * морь алхах) тоглуулна.
 */
export type RollEvent =
  | (RollEventBase & {
      kind: "opening";
      round: number;
      /** Энэ хаялтаар тойрог тэнцэж, шинэ тойрог эхэлсэн. */
      tied: boolean;
      /** Энэ хаялтаар эхлэгч тодорсон бол түүний суудал. */
      first: number | null;
    })
  | (RollEventBase & {
      kind: "race";
      from: number;
      to: number;
      /** Түлхэгдэж 1 алхам ухарсан суудлууд. */
      pushed: number[];
      finished: boolean;
    });

/** `mori_rooms` хүснэгтийн нэг мөр. */
export interface MoriRoom {
  id: string;
  settings: MoriSettings;
  players: OnlinePlayer[];
  status: RoomStatus;
  opening: OpeningState | null;
  /** Суудал бүрийн байрлал (0 = гараа, trackLength + 1 = бариа). */
  positions: number[];
  /** Барианд орсон суудлууд, орсон дарааллаар. */
  finish_order: number[];
  /** Одоо шагай хаях ээлжтэй суудал. */
  turn: number;
  roll_seq: number;
  last_roll: RollEvent | null;
  turn_started_at: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type MoriAction =
  | { type: "view" }
  | { type: "ping" }
  | { type: "join"; name: string }
  | { type: "start" }
  /** Өөрийн ээлжинд шагай хаях. `seq` — хөтчийн харсан сүүлийн хаялтын дугаар. */
  | { type: "roll"; seq: number }
  /** Ээлжтэй тоглогч удаан чимээгүй байвал сервер өмнөөс нь хаяхыг хүсэх. */
  | { type: "nudge"; seq: number };

export type MoriErrorCode =
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
  | "too_early"
  | "conflict"
  | "network"
  | "server_error";

export const MORI_ERROR_MESSAGE: Record<MoriErrorCode, string> = {
  not_configured: "Онлайн горим одоогоор ажиллахгүй байна.",
  bad_request: "Буруу хүсэлт илгээгдлээ.",
  not_found: "Ийм өрөө олдсонгүй.",
  not_player: "Та энэ өрөөнд тоглогч биш байна.",
  not_host: "Зөвхөн өрөө үүсгэсэн хүн эхлүүлнэ.",
  room_full: "Өрөө дүүрсэн байна.",
  already_started: "Уралдаан аль хэдийн эхэлсэн байна.",
  need_players: "Дор хаяж 2 тоглогч хэрэгтэй.",
  wrong_phase: "Одоо энэ үйлдлийг хийх боломжгүй.",
  stale: "Тоглоомын төлөв өөрчлөгдсөн байна.",
  not_your_turn: "Таны ээлж биш байна.",
  too_early: "Хараахан өмнөөс нь хаях боломжгүй.",
  conflict: "Тоглоомын төлөв өөрчлөгдсөн байна. Дахин оролдоно уу.",
  network: "Сүлжээний алдаа гарлаа. Интернэт холболтоо шалгана уу.",
  server_error: "Серверийн алдаа гарлаа. Дахин оролдоно уу.",
};

export type RoomPatch = Partial<
  Pick<
    MoriRoom,
    | "players"
    | "status"
    | "opening"
    | "positions"
    | "finish_order"
    | "turn"
    | "roll_seq"
    | "last_roll"
  >
>;

export type Plan =
  | { ok: true; patch: RoomPatch }
  | { ok: false; error: MoriErrorCode };

/** Клиентээс ирсэн тохиргоог зөвшөөрөгдсөн утгууд руу шүүнэ. */
export function parseSettings(value: unknown): MoriSettings | null {
  if (!value || typeof value !== "object") return null;
  const { trackLength, pushRule } = value as Record<string, unknown>;
  if (
    !TRACK_LENGTH_OPTIONS.includes(trackLength as number) ||
    typeof pushRule !== "boolean"
  ) {
    return null;
  }
  return { trackLength: trackLength as number, pushRule };
}

export function isMoriAction(value: unknown): value is MoriAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case "view":
    case "ping":
    case "start":
      return true;
    case "join":
      return typeof action.name === "string";
    case "roll":
    case "nudge":
      return Number.isInteger(action.seq);
    default:
      return false;
  }
}

/** Серверийн гаргасан хаялт зөв хэлбэртэй эсэх (4 шагай, зөв талууд). */
export function isValidRoll(sides: Side[]): boolean {
  return (
    sides.length === SHAGAI_PER_ROLL && sides.every((side) => SIDES.includes(side))
  );
}

export function toLogicPlayers(room: MoriRoom): MoriPlayer[] {
  return room.players.map((player) => ({ name: player.name, isComputer: false }));
}

export function toRace(room: MoriRoom): RaceState {
  return { positions: room.positions, finishOrder: room.finish_order };
}

export function seatOf(room: MoriRoom, hash: string): number | null {
  const seat = room.players.findIndex((player) => player.hash === hash);
  return seat >= 0 ? seat : null;
}

/** Шагай хаяхыг нь хүлээж буй суудал (тоглоом явагдаагүй бол null). */
export function pendingSeat(room: MoriRoom): number | null {
  return room.status === "opening" || room.status === "race" ? room.turn : null;
}

export function planJoin(
  room: MoriRoom,
  player: OnlinePlayer
): Plan {
  if (room.status !== "lobby") return { ok: false, error: "already_started" };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: "room_full" };
  return { ok: true, patch: { players: [...room.players, player] } };
}

/** Зөвхөн өрөө үүсгэсэн хүн (0-р суудал) эхлүүлнэ. */
export function planStart(room: MoriRoom, seat: number): Plan {
  if (room.status !== "lobby") return { ok: false, error: "already_started" };
  if (seat !== 0) return { ok: false, error: "not_host" };
  if (room.players.length < MIN_PLAYERS) return { ok: false, error: "need_players" };
  const seats = room.players.map((_, index) => index);
  return {
    ok: true,
    patch: {
      status: "opening",
      opening: { round: 1, contenders: seats, rolls: seats.map(() => null), tie: null },
      positions: seats.map(() => 0),
      finish_order: [],
      turn: 0,
      roll_seq: 0,
      last_roll: null,
    },
  };
}

/**
 * `seat`-ийн ээлжийн хаялтыг гүйцэтгэнэ. `sides`-ийг СЕРВЕР санамсаргүйгээр
 * гаргасан байх ёстой. Ээлж биш бол татгалзана.
 */
export function planRoll(
  room: MoriRoom,
  seat: number,
  sides: Side[],
  auto: boolean
): Plan {
  if (room.status !== "opening" && room.status !== "race") {
    return { ok: false, error: "wrong_phase" };
  }
  if (room.turn !== seat) return { ok: false, error: "not_your_turn" };
  if (!isValidRoll(sides)) return { ok: false, error: "server_error" };

  const base = { seq: room.roll_seq + 1, seat, sides, auto };

  if (room.status === "opening") {
    const opening = room.opening;
    if (!opening) return { ok: false, error: "server_error" };
    const rolls = opening.rolls.map((entry, index) =>
      index === seat ? { round: opening.round, sides } : entry
    );
    const event = { ...base, kind: "opening" as const, round: opening.round };

    // Энэ тойрогт хараахан хаяагүй хүн байвал дараагийнх нь хаяна.
    const waiting = opening.contenders.filter(
      (contender) => rolls[contender]?.round !== opening.round
    );
    if (waiting.length > 0) {
      return {
        ok: true,
        patch: {
          opening: { ...opening, rolls },
          turn: waiting[0],
          roll_seq: base.seq,
          last_roll: { ...event, tied: false, first: null },
        },
      };
    }

    const results = opening.contenders.map((contender) => ({
      seat: contender,
      horses: countHorses(rolls[contender]?.sides ?? []),
    }));
    const leaders = openingLeaders(results);
    if (leaders.length === 1) {
      return {
        ok: true,
        patch: {
          status: "race",
          opening: { ...opening, rolls },
          turn: leaders[0],
          roll_seq: base.seq,
          last_roll: { ...event, tied: false, first: leaders[0] },
        },
      };
    }
    // Тэнцсэн: зөвхөн тэнцсэн тоглогчид шинэ тойрогт дахин хаяна.
    return {
      ok: true,
      patch: {
        opening: {
          round: opening.round + 1,
          contenders: leaders,
          rolls,
          tie: {
            seats: leaders,
            horses: Math.max(...results.map((entry) => entry.horses)),
          },
        },
        turn: leaders[0],
        roll_seq: base.seq,
        last_roll: { ...event, tied: true, first: null },
      },
    };
  }

  if (room.finish_order.includes(seat)) return { ok: false, error: "wrong_phase" };
  const outcome = evaluateRoll(sides);
  const move = moveHorse(toRace(room), seat, outcome.steps, room.settings);
  const over = isRaceOver(move.race);
  // 4 морь буулгасан тоглогч дахин хаяна (барианд ороогүй бол).
  const again = outcome.rollAgain && !move.finished;
  return {
    ok: true,
    patch: {
      status: over ? "finished" : "race",
      positions: move.race.positions,
      finish_order: move.race.finishOrder,
      turn: over || again ? seat : nextSeat(move.race, seat),
      roll_seq: base.seq,
      last_roll: {
        ...base,
        kind: "race",
        from: move.from,
        to: move.to,
        pushed: move.pushed,
        finished: move.finished,
      },
    },
  };
}

/**
 * `event` хаялтын ӨМНӨХ байрлалууд: хаясан морь хуучин байрандаа,
 * түлхэгдсэн морьд ухрахаасаа өмнөх шагай дээрээ. Хөтөч хөдөлгөөнийг
 * эндээс эхлүүлнэ.
 */
export function positionsBefore(room: MoriRoom, event: RollEvent): number[] {
  if (event.kind !== "race") return room.positions;
  return room.positions.map((position, seat) =>
    seat === event.seat ? event.from : event.pushed.includes(seat) ? event.to : position
  );
}
