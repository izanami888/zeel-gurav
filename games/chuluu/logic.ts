// "Чулуу таалцах" тоглоомын цэвэр логик (UI-гүй).
//
// Үе бүрд тоглогч бүр гартаа хэдэн чулуу атгаснаа нууж, дараа нь бүх
// гарт байгаа чулууны НИЙТ тоог ээлжлэн таана. Яг таасан тоглогч бусад
// тоглогч бүрээс 1 чулуу авна.

export interface ChuluuPlayer {
  name: string;
  stones: number;
  isComputer: boolean;
}

export interface ChuluuSettings {
  /** Тоглогч бүрийн эхлэх чулуу. */
  startStones: number;
  /** Нэг удаад атгаж болох дээд тоо. */
  maxHide: number;
  /** Хамгийн ихдээ хэдэн үе тоглох (null = хязгааргүй). */
  roundLimit: number | null;
}

export interface Guess {
  seat: number;
  value: number;
}

export interface RoundOutcome {
  total: number;
  /** Яг таасан тоглогчийн суудал (хэн ч таагаагүй бол null). */
  winnerSeat: number | null;
  stonesAfter: number[];
  /** Тоглогч бүрийн чулууны өөрчлөлт (+3, -1, 0 ...). */
  delta: number[];
  /** Энэ үед чулуугүй болж хасагдсан суудлууд. */
  eliminated: number[];
}

export interface GameResult {
  /** Ялагчийн суудал; хэд хэдэн байвал тэнцээ. */
  winners: number[];
  rounds: number;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const START_STONE_OPTIONS = [5, 10];
export const MAX_HIDE_OPTIONS = [1, 2, 3, 4, 5];
export const ROUND_LIMIT_OPTIONS: Array<number | null> = [null, 10, 20];

export const DEFAULT_SETTINGS: ChuluuSettings = {
  startStones: 5,
  maxHide: 3,
  // Хязгааргүй горим маш удаан үргэлжилж болох тул анхдагч нь 10 үе.
  roundLimit: 10,
};

export function isActive(player: ChuluuPlayer): boolean {
  return player.stones > 0;
}

/** Тухайн тоглогч хамгийн ихдээ хэдэн чулуу атгаж болох вэ. */
export function hideLimit(player: ChuluuPlayer, settings: ChuluuSettings): number {
  return Math.min(settings.maxHide, player.stones);
}

/** Бүх гарт байж болох чулууны дээд нийлбэр (= таамгийн дээд хязгаар). */
export function maxPossibleTotal(
  players: ChuluuPlayer[],
  settings: ChuluuSettings
): number {
  return players.reduce((sum, player) => sum + hideLimit(player, settings), 0);
}

/**
 * Энэ үеийн таах дараалал: `starter` суудлаас эхлэн тойрч, хасагдсан
 * тоглогчдыг алгасна.
 */
export function guessOrder(players: ChuluuPlayer[], starter: number): number[] {
  const order: number[] = [];
  for (let i = 0; i < players.length; i++) {
    const seat = (starter + i) % players.length;
    if (isActive(players[seat])) order.push(seat);
  }
  return order;
}

/** Дараагийн үед эхэлж таах суудал: энэ үед эхэлсэн хүний дараагийнх. */
export function nextStarter(players: ChuluuPlayer[], starter: number): number {
  const first = guessOrder(players, starter)[0] ?? starter;
  return (first + 1) % players.length;
}

export function isGuessAllowed(
  value: number,
  guesses: Guess[],
  maxTotal: number
): boolean {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maxTotal &&
    !guesses.some((guess) => guess.value === value)
  );
}

/** Бүх гар нээгдсэний дараах үр дүн. `hidden[seat]` — атгасан чулуу. */
export function resolveRound(
  players: ChuluuPlayer[],
  hidden: Array<number | null>,
  guesses: Guess[]
): RoundOutcome {
  const total = hidden.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const winner = guesses.find((guess) => guess.value === total);
  const winnerSeat = winner ? winner.seat : null;

  const stonesAfter = players.map((player) => player.stones);
  if (winnerSeat !== null) {
    players.forEach((player, seat) => {
      // Чулуугүй тоглогч юу ч өгөхгүй.
      if (seat !== winnerSeat && player.stones > 0) {
        stonesAfter[seat] -= 1;
        stonesAfter[winnerSeat] += 1;
      }
    });
  }

  return {
    total,
    winnerSeat,
    stonesAfter,
    delta: stonesAfter.map((stones, seat) => stones - players[seat].stones),
    eliminated: players
      .map((player, seat) => (player.stones > 0 && stonesAfter[seat] === 0 ? seat : -1))
      .filter((seat) => seat >= 0),
  };
}

/**
 * Тоглоом дууссан эсэх. Нэг тоглогч бүх чулууг авсан, эсвэл тогтоосон
 * үеийн тоо дууссан бол хамгийн их чулуутай тоглогч(ид) ялна.
 */
export function getGameResult(
  players: ChuluuPlayer[],
  roundsPlayed: number,
  settings: ChuluuSettings
): GameResult | null {
  const activeCount = players.filter(isActive).length;
  const limitReached =
    settings.roundLimit !== null && roundsPlayed >= settings.roundLimit;
  if (activeCount > 1 && !limitReached) return null;

  const most = Math.max(...players.map((player) => player.stones));
  return {
    winners: players
      .map((player, seat) => (player.stones === most ? seat : -1))
      .filter((seat) => seat >= 0),
    rounds: roundsPlayed,
  };
}

function randomInt(maxInclusive: number, random: () => number): number {
  return Math.floor(random() * (maxInclusive + 1));
}

/** Компьютер санамсаргүй тооны чулуу атгана. */
export function computerHide(
  player: ChuluuPlayer,
  settings: ChuluuSettings,
  random: () => number = Math.random
): number {
  return randomInt(hideLimit(player, settings), random);
}

/**
 * Компьютерийн таамаг: өөрийн атгасан чулуу + бусдын атгасан байж болох
 * чулууны дундаж. Тэр тоо аль хэдийн хэлэгдсэн бол хамгийн ойр сул тоог
 * сонгоно (боломжгүй тоог таахгүй).
 */
export function computerGuess(
  seat: number,
  ownHidden: number,
  players: ChuluuPlayer[],
  settings: ChuluuSettings,
  guesses: Guess[],
  random: () => number = Math.random
): number {
  const others = players.filter((player, index) => index !== seat && isActive(player));
  const othersMax = others.reduce((sum, player) => sum + hideLimit(player, settings), 0);
  const expected = ownHidden + othersMax / 2;
  const taken = new Set(guesses.map((guess) => guess.value));

  let best: number[] = [];
  let bestDistance = Infinity;
  for (let value = ownHidden; value <= ownHidden + othersMax; value++) {
    if (taken.has(value)) continue;
    const distance = Math.abs(value - expected);
    if (distance < bestDistance - 1e-9) {
      best = [value];
      bestDistance = distance;
    } else if (Math.abs(distance - bestDistance) < 1e-9) {
      best.push(value);
    }
  }

  // Боломжит мужид үргэлж сул тоо үлддэг ч, хамгаалалт болгон дурын сул тоо.
  if (best.length === 0) {
    const maxTotal = maxPossibleTotal(players, settings);
    for (let value = 0; value <= maxTotal; value++) {
      if (!taken.has(value)) best.push(value);
    }
  }
  return best[randomInt(best.length - 1, random)];
}

export function createPlayers(
  entries: Array<{ name: string; isComputer: boolean }>,
  settings: ChuluuSettings
): ChuluuPlayer[] {
  return entries.map((entry) => ({ ...entry, stones: settings.startStones }));
}
