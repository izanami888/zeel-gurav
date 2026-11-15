// "Морь уралдуулах" тоглоомын цэвэр логик (UI-гүй).
//
// Шагайгаар тоглодог уламжлалт морин уралдаан. Тоглогч бүр нэг морьтой.
// Ээлжиндээ 4 шагай хаяж, буусан "морь" бүрээр шагайн замаар 1 алхам
// урагшилна. Сүүлийн шагайг давсан морь барианд орно.

export type Side = "mori" | "khoni" | "yamaa" | "temee";

export const SIDES: Side[] = ["mori", "khoni", "yamaa", "temee"];

export const SIDE_NAME: Record<Side, string> = {
  mori: "Морь",
  khoni: "Хонь",
  yamaa: "Ямаа",
  temee: "Тэмээ",
};

export interface MoriPlayer {
  name: string;
  isComputer: boolean;
}

export interface MoriSettings {
  /** Замын урт (шагайн тоо). */
  trackLength: number;
  /** "Түлхэх дүрэм": буусан шагай дээр байсан морь 1 алхам ухарна. */
  pushRule: boolean;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const SHAGAI_PER_ROLL = 4;
export const TRACK_LENGTH_OPTIONS = [12, 20, 30];
/** "Дөрвөн бэрх" (тал бүрээс нэг) буувал урагшлах алхам. */
export const DURVUN_BERKH_STEPS = 5;

export const DEFAULT_SETTINGS: MoriSettings = {
  trackLength: 12,
  pushRule: false,
};

/** 4 шагай хаяна. Тал бүр адил (25%) магадлалтай. */
export function rollShagai(random: () => number = Math.random): Side[] {
  return Array.from(
    { length: SHAGAI_PER_ROLL },
    () => SIDES[Math.floor(random() * SIDES.length)]
  );
}

export function countHorses(roll: Side[]): number {
  return roll.filter((side) => side === "mori").length;
}

/** Морь, хонь, ямаа, тэмээ тус бүр нэг буусан эсэх. */
export function isDurvunBerkh(roll: Side[]): boolean {
  return roll.length === SIDES.length && SIDES.every((side) => roll.includes(side));
}

export interface RollOutcome {
  horses: number;
  durvunBerkh: boolean;
  /** Урагшлах алхам. */
  steps: number;
  /** 4 морь буусан тул дахин хаяна. */
  rollAgain: boolean;
}

export function evaluateRoll(roll: Side[]): RollOutcome {
  const horses = countHorses(roll);
  const durvunBerkh = isDurvunBerkh(roll);
  return {
    horses,
    durvunBerkh,
    steps: durvunBerkh ? DURVUN_BERKH_STEPS : horses,
    rollAgain: horses === SHAGAI_PER_ROLL,
  };
}

/**
 * Эхлэх дарааллын шодолт: хамгийн олон морь буулгасан суудлууд.
 * Нэгээс олон суудал буцвал тэд тэнцсэн — дахин хаяна.
 */
export function openingLeaders(
  rolls: Array<{ seat: number; horses: number }>
): number[] {
  const most = Math.max(...rolls.map((entry) => entry.horses));
  return rolls.filter((entry) => entry.horses === most).map((entry) => entry.seat);
}

export interface RaceState {
  /**
   * Суудал бүрийн байрлал: 0 = гараа (эхний шагайн өмнө),
   * 1..trackLength = зам, trackLength + 1 = бариа.
   */
  positions: number[];
  /** Барианд орсон суудлууд, орсон дарааллаар. */
  finishOrder: number[];
}

export function createRace(playerCount: number): RaceState {
  return { positions: Array(playerCount).fill(0), finishOrder: [] };
}

/** Барианы байрлал: сүүлийн шагайн дараагийнх. */
export function finishPosition(settings: MoriSettings): number {
  return settings.trackLength + 1;
}

export interface MoveResult {
  race: RaceState;
  from: number;
  to: number;
  /** Энэ нүүдлээр барианд орсон эсэх. */
  finished: boolean;
  /** Түлхэгдэж 1 алхам ухарсан суудлууд. */
  pushed: number[];
}

/**
 * `seat`-ийн морийг `steps` алхам урагшлуулна. Сүүлийн шагайг давбал
 * барианд орно (яг таарах шаардлагагүй). Түлхэх дүрэмтэй бол буусан
 * шагай дээр байсан морьд 1 алхам ухарна (гинжин түлхэлт байхгүй).
 */
export function moveHorse(
  race: RaceState,
  seat: number,
  steps: number,
  settings: MoriSettings
): MoveResult {
  const finish = finishPosition(settings);
  const from = race.positions[seat];
  const to = Math.min(from + steps, finish);
  const finished = from < finish && to === finish;

  const positions = [...race.positions];
  positions[seat] = to;

  const pushed: number[] = [];
  if (settings.pushRule && to > from && !finished) {
    race.positions.forEach((position, other) => {
      if (other !== seat && position === to) {
        positions[other] = to - 1;
        pushed.push(other);
      }
    });
  }

  return {
    race: {
      positions,
      finishOrder: finished ? [...race.finishOrder, seat] : race.finishOrder,
    },
    from,
    to,
    finished,
    pushed,
  };
}

/**
 * Уралдаан дууссан эсэх: ганц морь үлдэхэд бүх байр тодорно (2 тоглогчтой
 * бол түрүүлсэн даруйд, 6 тоглогчтой бол айргийн тав тодроход).
 */
export function isRaceOver(race: RaceState): boolean {
  return race.finishOrder.length >= race.positions.length - 1;
}

/** `seat`-ийн дараагийн ээлж: суудлын дарааллаар, барианд орсныг алгасна. */
export function nextSeat(race: RaceState, seat: number): number {
  const count = race.positions.length;
  for (let step = 1; step <= count; step++) {
    const candidate = (seat + step) % count;
    if (!race.finishOrder.includes(candidate)) return candidate;
  }
  return seat;
}

/**
 * Байрын дараалал (суудлууд): барианд орсон нь орсон дарааллаараа эхэнд,
 * дараа нь уралдаж буй морьд хол явснаараа.
 */
export function standings(race: RaceState): number[] {
  const racing = race.positions
    .map((_, seat) => seat)
    .filter((seat) => !race.finishOrder.includes(seat))
    .sort((a, b) => race.positions[b] - race.positions[a] || a - b);
  return [...race.finishOrder, ...racing];
}

/**
 * Тухайн суудлын одоогийн байр (1-ээс эхэлнэ). Нэг шагай дээр зэрэгцсэн
 * морьд ижил байртай.
 */
export function placeOf(race: RaceState, seat: number): number {
  const finishedIndex = race.finishOrder.indexOf(seat);
  if (finishedIndex >= 0) return finishedIndex + 1;
  const ahead = race.positions.filter(
    (position, other) =>
      !race.finishOrder.includes(other) && position > race.positions[seat]
  ).length;
  return race.finishOrder.length + ahead + 1;
}
