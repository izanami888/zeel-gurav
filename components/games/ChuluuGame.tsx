"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  MAX_HIDE_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROUND_LIMIT_OPTIONS,
  START_STONE_OPTIONS,
  computerGuess,
  computerHide,
  createPlayers,
  getGameResult,
  guessOrder,
  hideLimit,
  isActive,
  maxPossibleTotal,
  resolveRound,
  type ChuluuPlayer,
  type ChuluuSettings,
  type GameResult,
  type Guess,
  type RoundOutcome,
} from "@/games/chuluu/logic";
import {
  CARD,
  Fist,
  NumberPad,
  PRIMARY_BUTTON,
  PassScreen,
  RulesDialog,
  SECONDARY_BUTTON,
  SectionLabel,
  StonePile,
  optionClass,
  type FistState,
} from "@/components/games/chuluu/ChuluuParts";
import ResultShareCard from "@/components/ResultShareCard";

const GAME_NAME = "Чулуу таалцах";

type Mode = "pass" | "computer";

interface SetupState {
  mode: Mode;
  playerCount: number;
  names: string[];
  humanName: string;
  computerCount: number;
  settings: ChuluuSettings;
}

const INITIAL_SETUP: SetupState = {
  mode: "pass",
  playerCount: 2,
  names: Array(MAX_PLAYERS).fill(""),
  humanName: "",
  computerCount: 1,
  settings: DEFAULT_SETTINGS,
};

function buildPlayers(setup: SetupState): ChuluuPlayer[] {
  const entries =
    setup.mode === "pass"
      ? setup.names.slice(0, setup.playerCount).map((name, index) => ({
          name: name.trim() || `Тоглогч ${index + 1}`,
          isComputer: false,
        }))
      : [
          { name: setup.humanName.trim() || "Та", isComputer: false },
          ...Array.from({ length: setup.computerCount }, (_, index) => ({
            name: setup.computerCount === 1 ? "Компьютер" : `Компьютер ${index + 1}`,
            isComputer: true,
          })),
        ];
  return createPlayers(entries, setup.settings);
}

function RulesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-mongol-gold/40 px-4 py-1.5 text-sm font-medium text-mongol-gold-light transition active:scale-95"
    >
      📖 Дүрэм
    </button>
  );
}

function SetupScreen({
  initial,
  onStart,
  onShowRules,
}: {
  initial: SetupState;
  onStart: (setup: SetupState) => void;
  onShowRules: () => void;
}) {
  const [setup, setSetup] = useState(initial);
  const { mode, settings } = setup;
  const update = (patch: Partial<SetupState>) =>
    setSetup((prev) => ({ ...prev, ...patch }));
  const updateSettings = (patch: Partial<ChuluuSettings>) =>
    update({ settings: { ...settings, ...patch } });

  return (
    <div className={`flex w-full flex-col gap-6 p-5 ${CARD}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-white/70">
          Чулуугаа нууж, нийт хэдэн чулуу байгааг таа!
        </p>
        <RulesButton onClick={onShowRules} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <SectionLabel>Тоглох горим</SectionLabel>
        <button
          type="button"
          aria-pressed={mode === "pass"}
          onClick={() => update({ mode: "pass" })}
          className={optionClass(mode === "pass")}
        >
          👥 Нэг төхөөрөмж дээр
        </button>
        <button
          type="button"
          aria-pressed={mode === "computer"}
          onClick={() => update({ mode: "computer" })}
          className={optionClass(mode === "computer")}
        >
          🤖 Компьютертэй тоглох
        </button>
      </fieldset>

      {mode === "pass" ? (
        <>
          <fieldset>
            <SectionLabel>Тоглогчийн тоо</SectionLabel>
            <div className="grid grid-cols-5 gap-2">
              {Array.from(
                { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
                (_, index) => index + MIN_PLAYERS
              ).map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={setup.playerCount === count}
                  aria-label={`${count} тоглогч`}
                  onClick={() => update({ playerCount: count })}
                  className={optionClass(setup.playerCount === count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <SectionLabel>Тоглогчдын нэр</SectionLabel>
            {Array.from({ length: setup.playerCount }, (_, index) => (
              <input
                key={index}
                type="text"
                maxLength={14}
                value={setup.names[index]}
                placeholder={`Тоглогч ${index + 1}`}
                aria-label={`Тоглогч ${index + 1}-ийн нэр`}
                onChange={(event) => {
                  const names = [...setup.names];
                  names[index] = event.target.value;
                  update({ names });
                }}
                className="w-full rounded-xl border border-mongol-gold/30 bg-mongol-blue/60 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-mongol-gold focus:outline-none"
              />
            ))}
          </fieldset>
        </>
      ) : (
        <>
          <fieldset>
            <SectionLabel>Таны нэр</SectionLabel>
            <input
              type="text"
              maxLength={14}
              value={setup.humanName}
              placeholder="Та"
              aria-label="Таны нэр"
              onChange={(event) => update({ humanName: event.target.value })}
              className="w-full rounded-xl border border-mongol-gold/30 bg-mongol-blue/60 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-mongol-gold focus:outline-none"
            />
          </fieldset>

          <fieldset>
            <SectionLabel>Компьютер тоглогчийн тоо</SectionLabel>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={setup.computerCount === count}
                  aria-label={`${count} компьютер`}
                  onClick={() => update({ computerCount: count })}
                  className={optionClass(setup.computerCount === count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset>
        <SectionLabel>Эхлэх чулуу</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {START_STONE_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={settings.startStones === count}
              onClick={() => updateSettings({ startStones: count })}
              className={optionClass(settings.startStones === count)}
            >
              {count} чулуу
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <SectionLabel>Нэг удаад атгах дээд тоо</SectionLabel>
        <div className="grid grid-cols-5 gap-2">
          {MAX_HIDE_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={settings.maxHide === count}
              aria-label={`Дээд тал нь ${count}`}
              onClick={() => updateSettings({ maxHide: count })}
              className={optionClass(settings.maxHide === count)}
            >
              {count}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <SectionLabel>Үеийн тоо</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {ROUND_LIMIT_OPTIONS.map((limit) => (
            <button
              key={limit ?? "none"}
              type="button"
              aria-pressed={settings.roundLimit === limit}
              onClick={() => updateSettings({ roundLimit: limit })}
              className={optionClass(settings.roundLimit === limit)}
            >
              {limit === null ? "Хязгааргүй" : `${limit} үе`}
            </button>
          ))}
        </div>
        {settings.roundLimit === null && (
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Хязгааргүй горимд нэг хүн бүх чулууг автал тоглоно — удаан
            үргэлжилж магадгүй.
          </p>
        )}
      </fieldset>

      <button type="button" onClick={() => onStart(setup)} className={PRIMARY_BUTTON}>
        Эхлэх
      </button>
    </div>
  );
}

interface Round {
  number: number;
  /** Таах дараалал (суудлын дугаарууд). */
  order: number[];
  /** Суудал бүрийн атгасан чулуу; хараахан сонгоогүй бол null. */
  hidden: Array<number | null>;
  guesses: Guess[];
}

type Phase =
  | { name: "hide"; index: number; ready: boolean }
  | { name: "guess"; turn: number; ready: boolean }
  | { name: "reveal" }
  | { name: "finished" };

function makeRound(
  players: ChuluuPlayer[],
  settings: ChuluuSettings,
  number: number,
  starter: number
): Round {
  return {
    number,
    order: guessOrder(players, starter),
    // Компьютерүүд үе эхлэхэд шууд атгана.
    hidden: players.map((player) =>
      isActive(player) && player.isComputer ? computerHide(player, settings) : null
    ),
    guesses: [],
  };
}

function humanSeats(players: ChuluuPlayer[]): number[] {
  return players
    .map((player, seat) => (isActive(player) && !player.isComputer ? seat : -1))
    .filter((seat) => seat >= 0);
}

function Match({
  mode,
  initialPlayers,
  settings,
  onRestart,
  onChangeSettings,
  onShowRules,
}: {
  mode: Mode;
  initialPlayers: ChuluuPlayer[];
  settings: ChuluuSettings;
  onRestart: () => void;
  onChangeSettings: () => void;
  onShowRules: () => void;
}) {
  const passMode = mode === "pass";

  const firstPhase = (current: ChuluuPlayer[]): Phase =>
    humanSeats(current).length > 0
      ? { name: "hide", index: 0, ready: !passMode }
      : { name: "guess", turn: 0, ready: !passMode };

  const [players, setPlayers] = useState(initialPlayers);
  const [round, setRound] = useState(() => makeRound(initialPlayers, settings, 1, 0));
  const [phase, setPhase] = useState<Phase>(() => firstPhase(initialPlayers));
  const [pick, setPick] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);

  const hideQueue = humanSeats(players);
  const maxTotal = maxPossibleTotal(players, settings);
  const guessSeat = phase.name === "guess" ? round.order[phase.turn] : undefined;
  const allGuessed = phase.name === "guess" && guessSeat === undefined;
  const displayName = (seat: number) =>
    !passMode && !players[seat].isComputer ? "Та" : players[seat].name;

  function submitGuess(seat: number, value: number) {
    setRound((prev) => ({ ...prev, guesses: [...prev.guesses, { seat, value }] }));
    setPhase((prev) =>
      prev.name === "guess"
        ? { name: "guess", turn: prev.turn + 1, ready: !passMode }
        : prev
    );
    setPick(null);
  }

  // Компьютерийн ээлж: бага зэрэг "бодоод" таана.
  useEffect(() => {
    if (guessSeat === undefined || !players[guessSeat].isComputer) return;
    const timer = setTimeout(
      () =>
        submitGuess(
          guessSeat,
          computerGuess(
            guessSeat,
            round.hidden[guessSeat] ?? 0,
            players,
            settings,
            round.guesses
          )
        ),
      900 + Math.random() * 700
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessSeat, round, players, settings]);

  // Гар нээгдсэний дараа чулуу шилжихийг харуулна.
  useEffect(() => {
    if (phase.name !== "reveal") return;
    const timer = setTimeout(() => setShowTransfer(true), 1800);
    return () => clearTimeout(timer);
  }, [phase.name]);

  function confirmHide() {
    if (phase.name !== "hide" || pick === null) return;
    const seat = hideQueue[phase.index];
    setRound((prev) => ({
      ...prev,
      hidden: prev.hidden.map((count, index) => (index === seat ? pick : count)),
    }));
    setPhase(
      phase.index + 1 < hideQueue.length
        ? { name: "hide", index: phase.index + 1, ready: !passMode }
        : { name: "guess", turn: 0, ready: !passMode }
    );
    setPick(null);
  }

  function handleReveal() {
    setOutcome(resolveRound(players, round.hidden, round.guesses));
    setShowTransfer(false);
    setPhase({ name: "reveal" });
  }

  const playersAfter = outcome
    ? players.map((player, seat) => ({ ...player, stones: outcome.stonesAfter[seat] }))
    : players;
  const resultAfter = outcome
    ? getGameResult(playersAfter, round.number, settings)
    : null;

  function handleNext() {
    setPlayers(playersAfter);
    setOutcome(null);
    if (resultAfter) {
      setResult(resultAfter);
      setPhase({ name: "finished" });
      return;
    }
    // Эхэлж таах хүн үе бүрд нэг суудлаар шилжинэ.
    const starter = (round.order[0] + 1) % players.length;
    setRound(makeRound(playersAfter, settings, round.number + 1, starter));
    setPhase(firstPhase(playersAfter));
  }

  if (phase.name === "finished" && result) {
    const stones = players[result.winners[0]].stones;
    const isDraw = result.winners.length > 1;
    const resultText = isDraw
      ? "Тэнцлээ!"
      : `${displayName(result.winners[0])} яллаа!`;
    const subtitle = isDraw
      ? `${result.winners.map((seat) => players[seat].name).join(", ")} · тус бүр ${stones} чулуу`
      : `${result.rounds} үе · ${stones} чулуу`;
    const standings = players
      .map((player, seat) => ({ player, seat }))
      .sort((a, b) => b.player.stones - a.player.stones);

    return (
      <div className="flex w-full flex-col items-center gap-6">
        <ResultShareCard
          game={GAME_NAME}
          result={resultText}
          subtitle={subtitle}
          onPlayAgain={onRestart}
        />

        <div className={`flex w-full flex-col gap-3 p-4 ${CARD}`}>
          <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
            Эцсийн байдал
          </p>
          {standings.map(({ player, seat }) => (
            <div key={seat} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-semibold text-white">
                {result.winners.includes(seat) ? "🏆 " : ""}
                {player.name}
              </span>
              <StonePile count={player.stones} />
            </div>
          ))}
        </div>

        <button type="button" onClick={onChangeSettings} className={SECONDARY_BUTTON}>
          Тохиргоо солих
        </button>
      </div>
    );
  }

  // Нууц сонголтын өмнө утсаа дамжуулах дэлгэц.
  if (phase.name === "hide" && !phase.ready) {
    return (
      <PassScreen
        name={players[hideQueue[phase.index]].name}
        hint="Чулуугаа нууцаар атгах ээлж"
        onReady={() => setPhase({ ...phase, ready: true })}
      />
    );
  }
  if (
    phase.name === "guess" &&
    !phase.ready &&
    guessSeat !== undefined &&
    !players[guessSeat].isComputer
  ) {
    return (
      <PassScreen
        name={players[guessSeat].name}
        hint="Нийт чулууг таах ээлж"
        onReady={() => setPhase({ ...phase, ready: true })}
      />
    );
  }

  const activeSeat =
    phase.name === "hide" ? hideQueue[phase.index] : guessSeat ?? null;
  const taken = new Set(round.guesses.map((guess) => guess.value));

  const fistState = (seat: number): FistState => {
    if (!isActive(players[seat])) return { kind: "out" };
    if (phase.name === "reveal") {
      return { kind: "open", count: round.hidden[seat] ?? 0 };
    }
    if (round.hidden[seat] === null) return { kind: "waiting" };
    return { kind: "closed", shake: allGuessed };
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-widest text-mongol-gold-light/80">
          {round.number}-р үе
          {settings.roundLimit !== null && (
            <span className="text-white/40"> / {settings.roundLimit}</span>
          )}
        </p>
        <RulesButton onClick={onShowRules} />
      </div>

      <ul className="flex flex-col gap-2">
        {players.map((player, seat) => {
          const guess = round.guesses.find((entry) => entry.seat === seat);
          const isWinner = outcome?.winnerSeat === seat;
          const delta = outcome && showTransfer ? outcome.delta[seat] : 0;
          const stones =
            outcome && showTransfer ? outcome.stonesAfter[seat] : player.stones;
          const out = !isActive(player);

          return (
            <li
              key={seat}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
                isWinner
                  ? "border-emerald-400 bg-emerald-500/15"
                  : activeSeat === seat
                    ? "border-mongol-gold bg-mongol-blue-light/70"
                    : "border-white/10 bg-mongol-blue-light/40"
              } ${out ? "opacity-50" : ""}`}
            >
              <Fist state={fistState(seat)} />

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-semibold text-white">
                  <span className="truncate">{player.name}</span>
                  {player.isComputer && <span aria-hidden>🤖</span>}
                  {round.order[0] === seat && phase.name !== "reveal" && (
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      эхэлж таана
                    </span>
                  )}
                  {out && (
                    <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-200">
                      хасагдсан
                    </span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <StonePile count={stones} />
                  {delta !== 0 && (
                    <span
                      className={`animate-stone-pop text-sm font-bold ${
                        delta > 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex w-14 shrink-0 flex-col items-center">
                <span className="text-[10px] uppercase tracking-wide text-white/40">
                  Таамаг
                </span>
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    isWinner ? "text-emerald-300" : guess ? "text-white" : "text-white/20"
                  }`}
                  aria-label={
                    guess ? `${player.name}-ийн таамаг ${guess.value}` : undefined
                  }
                >
                  {guess ? guess.value : "–"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`flex flex-col items-center gap-4 p-4 text-center ${CARD}`} aria-live="polite">
        {phase.name === "hide" && (
          <>
            <div>
              <h2 className="text-lg font-bold text-white">
                {passMode
                  ? `${players[hideQueue[phase.index]].name}, хэдэн чулуу атгах вэ?`
                  : "Хэдэн чулуу атгах вэ?"}
              </h2>
              {passMode && (
                <p className="mt-1 text-xs text-white/50">Бусдад бүү харуул!</p>
              )}
            </div>
            <NumberPad
              max={hideLimit(players[hideQueue[phase.index]], settings)}
              selected={pick}
              onSelect={setPick}
              columns={hideLimit(players[hideQueue[phase.index]], settings) + 1}
            />
            <button
              type="button"
              disabled={pick === null}
              onClick={confirmHide}
              className={`w-full ${PRIMARY_BUTTON}`}
            >
              ✊ Атгах
            </button>
          </>
        )}

        {phase.name === "guess" &&
          guessSeat !== undefined &&
          (players[guessSeat].isComputer ? (
            <p className="animate-pulse py-3 text-base font-medium text-white/80">
              🤖 {players[guessSeat].name} бодож байна...
            </p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {passMode
                    ? `${players[guessSeat].name}, нийт хэдэн чулуу байна вэ?`
                    : "Нийт хэдэн чулуу байна вэ?"}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Таны гарт:{" "}
                  <span className="font-bold text-mongol-gold-light">
                    {round.hidden[guessSeat] ?? 0}
                  </span>{" "}
                  чулуу · Хэлэгдсэн тоог сонгож болохгүй
                </p>
              </div>
              <NumberPad
                max={maxTotal}
                selected={pick}
                taken={taken}
                onSelect={setPick}
                columns={5}
              />
              <button
                type="button"
                disabled={pick === null}
                onClick={() => pick !== null && submitGuess(guessSeat, pick)}
                className={`w-full ${PRIMARY_BUTTON}`}
              >
                Таах
              </button>
            </>
          ))}

        {allGuessed && (
          <>
            <h2 className="text-lg font-bold text-white">Бүгд таалаа!</h2>
            <button type="button" onClick={handleReveal} className={`w-full ${PRIMARY_BUTTON}`}>
              🖐️ Гараа нээх
            </button>
          </>
        )}

        {phase.name === "reveal" && outcome && (
          <>
            <div>
              <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
                Нийт
              </p>
              <p className="animate-fist-open text-5xl font-bold tabular-nums text-white">
                {outcome.total}
              </p>
              <p className="text-sm text-white/60">чулуу</p>
            </div>

            {showTransfer && (
              <>
                <div className="flex flex-col gap-1">
                  {outcome.winnerSeat !== null ? (
                    <>
                      <p className="text-lg font-bold text-emerald-300">
                        🎉 {displayName(outcome.winnerSeat)} яг таалаа!
                      </p>
                      <p className="text-sm text-white/70">
                        Бусад тоглогч бүрээс 1 чулуу авлаа (+
                        {outcome.delta[outcome.winnerSeat]}).
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-white">Хэн ч таасангүй</p>
                      <p className="text-sm text-white/70">Чулуу хөдөлсөнгүй.</p>
                    </>
                  )}
                  {outcome.eliminated.length > 0 && (
                    <p className="text-sm text-red-200">
                      {outcome.eliminated.map((seat) => players[seat].name).join(", ")}{" "}
                      чулуугүй болж хасагдлаа.
                    </p>
                  )}
                </div>
                <button type="button" onClick={handleNext} className={`w-full ${PRIMARY_BUTTON}`}>
                  {resultAfter ? "Үр дүн харах" : "Дараагийн үе"}
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm font-medium text-white/50 underline underline-offset-4"
        >
          Шинээр эхлэх
        </button>
        <button
          type="button"
          onClick={onChangeSettings}
          className="text-sm font-medium text-white/50 underline underline-offset-4"
        >
          Тохиргоо солих
        </button>
      </div>
    </div>
  );
}

export default function ChuluuGame() {
  const [setup, setSetup] = useState(INITIAL_SETUP);
  const [playing, setPlaying] = useState(false);
  const [matchKey, setMatchKey] = useState(0);
  const [showRules, setShowRules] = useState(false);

  return (
    <>
      {playing ? (
        <Match
          key={matchKey}
          mode={setup.mode}
          initialPlayers={buildPlayers(setup)}
          settings={setup.settings}
          onRestart={() => setMatchKey((key) => key + 1)}
          onChangeSettings={() => setPlaying(false)}
          onShowRules={() => setShowRules(true)}
        />
      ) : (
        <SetupScreen
          initial={setup}
          onStart={(next) => {
            setSetup(next);
            setMatchKey((key) => key + 1);
            setPlaying(true);
          }}
          onShowRules={() => setShowRules(true)}
        />
      )}

      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
    </>
  );
}
