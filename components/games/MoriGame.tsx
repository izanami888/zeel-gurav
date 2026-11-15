"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TRACK_LENGTH_OPTIONS,
  countHorses,
  createRace,
  evaluateRoll,
  finishPosition,
  isRaceOver,
  moveHorse,
  nextSeat,
  openingLeaders,
  rollShagai,
  standings,
  type MoriPlayer,
  type MoriSettings,
  type MoveResult,
  type RaceState,
  type RollOutcome,
  type Side,
} from "@/games/mori/logic";
import {
  BerkhCelebration,
  HORSE_COLORS,
  HorseToken,
  RankingList,
  RulesButton,
  RulesDialog,
  SIDE_EMOJI,
  ShagaiRow,
  TEXT_INPUT,
  Track,
  horseLabel,
} from "@/components/games/mori/MoriParts";
import {
  CARD,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SectionLabel,
  optionClass,
} from "@/components/games/ui";
import ResultShareCard from "@/components/ResultShareCard";

const GAME_NAME = "Морь уралдуулах";

type Mode = "pass" | "computer";

interface SetupState {
  mode: Mode;
  playerCount: number;
  names: string[];
  humanName: string;
  computerCount: number;
  settings: MoriSettings;
}

const INITIAL_SETUP: SetupState = {
  mode: "pass",
  playerCount: 2,
  names: Array(MAX_PLAYERS).fill(""),
  humanName: "",
  computerCount: 1,
  settings: DEFAULT_SETTINGS,
};

const TRACK_LENGTH_HINT: Record<number, string> = {
  12: "Богино",
  20: "Дунд",
  30: "Урт",
};

// Хөдөлгөөний хугацаа (мс).
const ROLL_MS = 850; // шагай эргэлдэх
const REVEAL_MS = 950; // буусан талыг уншуулах
const NO_MOVE_MS = 1200; // морь буугаагүйг уншуулах
const BERKH_MS = 2700; // дөрвөн бэрхийн баяр
const STEP_MS = 320; // морины нэг алхам
const PUSH_MS = 900; // түлхэгдсэн морь ухрах
const SETTLE_MS = 550; // дараагийн ээлж рүү шилжих
const FINISH_MS = 1500; // барианд орсныг харуулах

/** Компьютер шагайгаа хаяхаас өмнө бага зэрэг хүлээнэ. */
function computerDelay(): number {
  return 700 + Math.random() * 500;
}

function buildPlayers(setup: SetupState): MoriPlayer[] {
  if (setup.mode === "pass") {
    return setup.names.slice(0, setup.playerCount).map((name, index) => ({
      name: name.trim() || `Тоглогч ${index + 1}`,
      isComputer: false,
    }));
  }
  return [
    { name: setup.humanName.trim() || "Та", isComputer: false },
    ...Array.from({ length: setup.computerCount }, (_, index) => ({
      name: setup.computerCount === 1 ? "Компьютер" : `Компьютер ${index + 1}`,
      isComputer: true,
    })),
  ];
}

/** Хаялтын үр дүн үгээр: "2 морь — 2 алхам урагшаа". */
function describeRoll(outcome: RollOutcome): string {
  if (outcome.durvunBerkh) return `Дөрвөн бэрх — ${outcome.steps} алхам урагшаа!`;
  if (outcome.horses === 0) return "Морь буусангүй — хөдлөхгүй";
  const text = `${outcome.horses} морь — ${outcome.steps} алхам урагшаа`;
  return outcome.rollAgain ? `${text}, дахин хаяна!` : text;
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
  const updateSettings = (patch: Partial<MoriSettings>) =>
    update({ settings: { ...settings, ...patch } });

  return (
    <div className={`flex w-full flex-col gap-6 p-5 ${CARD}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-white/70">
          Шагай хаяж, морио барианд түрүүлж оруул!
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
              <div key={index} className="flex items-center gap-3">
                <HorseToken
                  color={HORSE_COLORS[index]}
                  label={horseLabel(setup.names[index].trim() || `${index + 1}`)}
                  size={34}
                />
                <input
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
                  className={TEXT_INPUT}
                />
              </div>
            ))}
          </fieldset>
        </>
      ) : (
        <>
          <fieldset>
            <SectionLabel>Таны нэр</SectionLabel>
            <div className="flex items-center gap-3">
              <HorseToken
                color={HORSE_COLORS[0]}
                label={horseLabel(setup.humanName.trim() || "Та")}
                size={34}
              />
              <input
                type="text"
                maxLength={14}
                value={setup.humanName}
                placeholder="Та"
                aria-label="Таны нэр"
                onChange={(event) => update({ humanName: event.target.value })}
                className={TEXT_INPUT}
              />
            </div>
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
        <SectionLabel>Замын урт</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {TRACK_LENGTH_OPTIONS.map((length) => (
            <button
              key={length}
              type="button"
              aria-pressed={settings.trackLength === length}
              onClick={() => updateSettings({ trackLength: length })}
              className={optionClass(settings.trackLength === length)}
            >
              <span className="flex flex-col leading-tight">
                <span>{length} шагай</span>
                <span className="text-[11px] font-normal opacity-70">
                  {TRACK_LENGTH_HINT[length]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <SectionLabel>Нэмэлт дүрэм</SectionLabel>
        <button
          type="button"
          role="switch"
          aria-checked={settings.pushRule}
          onClick={() => updateSettings({ pushRule: !settings.pushRule })}
          className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition active:scale-[0.98] ${
            settings.pushRule
              ? "border-mongol-gold bg-mongol-gold/10"
              : "border-mongol-gold/30 bg-mongol-blue-light/50"
          }`}
        >
          <span>
            <span className="block text-sm font-semibold text-white">Түлхэх дүрэм</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-white/60">
              Өөр морьтой шагай дээр буувал тэр морь 1 алхам ухарна.
            </span>
          </span>
          <span
            aria-hidden
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.pushRule ? "bg-mongol-gold" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                settings.pushRule ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </fieldset>

      <button type="button" onClick={() => onStart(setup)} className={PRIMARY_BUTTON}>
        Эхлэх
      </button>
    </div>
  );
}

/** Шагайн мөр + үр дүнгийн үг + том товч. Шодолт, уралдаан хоёуланд нь. */
function RollPanel({
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

/**
 * Эхлэх дарааллын шодолт: бүгд 4 шагай хаяж, хамгийн олон морь буулгасан
 * нь эхэлнэ. Тэнцвэл зөвхөн тэнцсэн тоглогчид дахин хаяна.
 */
function OpeningRoll({
  mode,
  players,
  onDone,
  onShowRules,
}: {
  mode: Mode;
  players: MoriPlayer[];
  onDone: (firstSeat: number) => void;
  onShowRules: () => void;
}) {
  const [contenders, setContenders] = useState(() => players.map((_, seat) => seat));
  const [index, setIndex] = useState(0);
  const [rolls, setRolls] = useState<Array<Side[] | null>>(() => players.map(() => null));
  const [roll, setRoll] = useState<Side[] | null>(null);
  const [stage, setStage] = useState<"wait" | "rolling" | "shown" | "done">("wait");
  const [tie, setTie] = useState<{ seats: number[]; horses: number } | null>(null);
  const [first, setFirst] = useState<number | null>(null);

  const seat = contenders[index];
  const player = players[seat];

  function startRoll() {
    setRoll(rollShagai());
    setStage("rolling");
  }

  useEffect(() => {
    let delay: number;
    let next: () => void;

    if (stage === "wait" && player.isComputer) {
      delay = computerDelay();
      next = startRoll;
    } else if (stage === "rolling") {
      delay = ROLL_MS;
      next = () => {
        setRolls((prev) => prev.map((entry, other) => (other === seat ? roll : entry)));
        setStage("shown");
      };
    } else if (stage === "shown") {
      delay = REVEAL_MS;
      next = () => {
        if (index + 1 < contenders.length) {
          setIndex(index + 1);
          setStage("wait");
          return;
        }
        const results = contenders.map((contender) => ({
          seat: contender,
          horses: countHorses(rolls[contender] ?? []),
        }));
        const leaders = openingLeaders(results);
        if (leaders.length === 1) {
          setFirst(leaders[0]);
          setStage("done");
          return;
        }
        // Тэнцсэн тоглогчид л дахин хаяна.
        setTie({ seats: leaders, horses: countHorses(rolls[leaders[0]] ?? []) });
        setContenders(leaders);
        setIndex(0);
        setRolls((prev) => prev.map((entry, other) => (leaders.includes(other) ? null : entry)));
        setStage("wait");
      };
    } else {
      return;
    }

    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index, contenders, rolls, roll]);

  const horses = roll ? countHorses(roll) : 0;
  let message: string;
  if (stage === "done" && first !== null) {
    message =
      mode === "computer" && !players[first].isComputer
        ? "Та түрүүлж эхэлнэ!"
        : `${players[first].name} түрүүлж эхэлнэ!`;
  } else if (stage === "shown") {
    message = horses === 0 ? "Морь буусангүй" : `${horses} морь буулаа`;
  } else if (player.isComputer) {
    message = `🤖 ${player.name} шагай хаяж байна...`;
  } else if (stage === "rolling") {
    message = "Шагай эргэлдэж байна...";
  } else {
    message = mode === "pass" ? `${player.name}, шагайгаа хая!` : "Шагайгаа хая!";
  }

  const button =
    stage === "done" && first !== null
      ? { label: "Уралдааныг эхлүүлэх", onClick: () => onDone(first) }
      : player.isComputer
        ? { label: "🤖 Компьютерийн ээлж" }
        : { label: "Шагай хаях", onClick: stage === "wait" ? startRoll : undefined };

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

      {tie && stage !== "done" && (
        <p
          role="status"
          className="rounded-xl border border-mongol-gold/40 bg-mongol-gold/10 px-3 py-2 text-center text-sm font-medium text-mongol-gold-light"
        >
          Тэнцлээ ({tie.horses} морь)! {tie.seats.map((entry) => players[entry].name).join(", ")}{" "}
          дахин хаяна.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {players.map((entry, other) => {
          const result = rolls[other];
          const isFirst = stage === "done" && first === other;
          const isRolling = stage !== "done" && other === seat;
          const sitsOut = !contenders.includes(other) || (stage === "done" && !isFirst);
          return (
            <li
              key={other}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
                isFirst
                  ? "border-emerald-400 bg-emerald-500/15"
                  : isRolling
                    ? "border-mongol-gold bg-mongol-blue-light/70"
                    : "border-white/10 bg-mongol-blue-light/40"
              } ${sitsOut ? "opacity-50" : ""}`}
            >
              <HorseToken
                color={HORSE_COLORS[other]}
                label={horseLabel(entry.name)}
                size={30}
              />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-white">
                <span className="truncate">{entry.name}</span>
                {entry.isComputer && <span aria-hidden>🤖</span>}
                {isFirst && (
                  <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                    эхэлнэ
                  </span>
                )}
              </span>
              {result ? (
                <>
                  <span className="text-sm tracking-tight" aria-hidden>
                    {result.map((side) => SIDE_EMOJI[side]).join("")}
                  </span>
                  <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-mongol-gold-light">
                    {countHorses(result)} морь
                  </span>
                </>
              ) : (
                <span className="w-14 shrink-0 text-right text-sm text-white/30">–</span>
              )}
            </li>
          );
        })}
      </ul>

      <RollPanel
        roll={stage === "shown" ? roll : null}
        rolling={stage === "rolling"}
        lead={
          stage === "done" && first !== null ? (
            <HorseToken
              color={HORSE_COLORS[first]}
              label={horseLabel(players[first].name)}
              size={72}
            />
          ) : undefined
        }
        message={message}
        button={button}
      />
    </>
  );
}

type RaceStage =
  | "wait" // хаяхыг хүлээж байна
  | "rolling" // шагай эргэлдэж байна
  | "shown" // буусан талыг харуулж байна
  | "moving" // морь алхам алхмаар урагшилж байна
  | "pushing" // түлхэгдсэн морь ухарч байна
  | "settled" // нүүдэл дууссан
  | "over"; // бүх байр тодорсон

function Race({
  mode,
  players,
  settings,
  firstSeat,
  onFinish,
  onShowRules,
}: {
  mode: Mode;
  players: MoriPlayer[];
  settings: MoriSettings;
  firstSeat: number;
  onFinish: (race: RaceState) => void;
  onShowRules: () => void;
}) {
  // `race` — дүрмийн дагуух бодит байдал; `shown` — дэлгэцэнд харагдах
  // байрлал (морь алхам алхмаар гүйцэж очно).
  const [race, setRace] = useState(() => createRace(players.length));
  const [shown, setShown] = useState(() => players.map(() => 0));
  const [current, setCurrent] = useState(firstSeat);
  const [stage, setStage] = useState<RaceStage>("wait");
  const [roll, setRoll] = useState<Side[] | null>(null);
  const [move, setMove] = useState<MoveResult | null>(null);
  const [bonusRoll, setBonusRoll] = useState(false);
  const [lastNote, setLastNote] = useState<string | null>(null);

  const player = players[current];
  const outcome = roll ? evaluateRoll(roll) : null;
  const finish = finishPosition(settings);
  // Толгой хэсэгт: ээлжтэй тоглогч, дууссаны дараа түрүүлсэн тоглогч.
  const headSeat = stage === "over" ? race.finishOrder[0] : current;
  const youSeat = mode === "computer" ? 0 : null;
  const nameOf = (seat: number) => (seat === youSeat ? "Та" : players[seat].name);

  // Хүн тоглогчид бүгд барианд орсон бол компьютерүүд хурдан дуусгана.
  const humansRacing = players.some(
    (entry, seat) => !entry.isComputer && !race.finishOrder.includes(seat)
  );
  const speed = humansRacing ? 1 : 0.5;

  function startRoll() {
    setRoll(rollShagai());
    setMove(null);
    setStage("rolling");
  }

  function endTurn() {
    if (!outcome) return;
    setLastNote(`${player.name}: ${describeRoll(outcome)}`);
    if (isRaceOver(race)) {
      setStage("over");
      return;
    }
    // 4 морь буулгасан тоглогч дахин хаяна (барианд ороогүй бол).
    const again = outcome.rollAgain && !move?.finished;
    setBonusRoll(again);
    setCurrent(again ? current : nextSeat(race, current));
    setStage("wait");
  }

  useEffect(() => {
    let delay: number;
    let next: () => void;

    if (stage === "wait" && player.isComputer) {
      delay = computerDelay();
      next = startRoll;
    } else if (stage === "rolling") {
      delay = ROLL_MS;
      next = () => setStage("shown");
    } else if (stage === "shown" && outcome) {
      if (outcome.steps === 0) {
        delay = NO_MOVE_MS;
        next = endTurn;
      } else {
        delay = outcome.durvunBerkh ? BERKH_MS : REVEAL_MS;
        next = () => {
          const result = moveHorse(race, current, outcome.steps, settings);
          setMove(result);
          setRace(result.race);
          setStage("moving");
        };
      }
    } else if (stage === "moving" && move) {
      if (shown[current] < move.to) {
        delay = STEP_MS;
        next = () =>
          setShown((prev) =>
            prev.map((position, seat) => (seat === current ? position + 1 : position))
          );
      } else if (move.pushed.length > 0) {
        delay = STEP_MS;
        next = () => {
          setShown(move.race.positions);
          setStage("pushing");
        };
      } else {
        delay = 0;
        next = () => setStage("settled");
      }
    } else if (stage === "pushing") {
      delay = PUSH_MS;
      next = () => setStage("settled");
    } else if (stage === "settled") {
      delay = move?.finished ? FINISH_MS : SETTLE_MS;
      next = endTurn;
    } else {
      return;
    }

    const timer = setTimeout(next, delay * speed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, current, shown, speed]);

  // Жагсаалтад морь бариаг давсны дараа л "барианд орсон" гэж харуулна.
  const shownRace: RaceState = {
    positions: shown,
    finishOrder: race.finishOrder.filter((seat) => shown[seat] >= finish),
  };

  const rollVisible = stage !== "wait" && stage !== "rolling";
  const arrived = move !== null && shown[current] >= move.to;

  let message: string;
  let detail: string | null = null;
  if (stage === "over") {
    message = "Уралдаан дууслаа!";
  } else if (rollVisible && outcome) {
    message = describeRoll(outcome);
  } else if (player.isComputer) {
    message = `🤖 ${player.name} шагай хаяж байна...`;
  } else if (stage === "rolling") {
    message = "Шагай эргэлдэж байна...";
  } else {
    message = bonusRoll ? "4 морь буулаа — дахин хая!" : "Шагайгаа хая!";
    detail = lastNote;
  }

  if (move && arrived && (stage === "settled" || stage === "over" || stage === "pushing")) {
    if (move.finished) {
      const place = race.finishOrder.indexOf(current) + 1;
      detail =
        place === 1
          ? `🏆 ${nameOf(current)} түрүүллээ — Түрүү магнай!`
          : `🏁 ${nameOf(current)} барианд орлоо — ${place}-р байр!`;
    } else if (move.pushed.length > 0) {
      detail = `Түлхлээ! ${move.pushed.map(nameOf).join(", ")} 1 алхам ухарлаа.`;
    }
  }

  const button =
    stage === "over"
      ? { label: "Үр дүн харах", onClick: () => onFinish(race) }
      : player.isComputer
        ? { label: "🤖 Компьютерийн ээлж" }
        : { label: "Шагай хаях", onClick: stage === "wait" ? startRoll : undefined };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <HorseToken
            color={HORSE_COLORS[headSeat]}
            label={horseLabel(players[headSeat].name)}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-mongol-gold-light/80">
              {stage === "over"
                ? "Түрүү магнай"
                : current === youSeat
                  ? "Таны ээлж"
                  : "Ээлж"}
            </p>
            <p className="truncate text-lg font-bold leading-tight text-white">
              {players[headSeat].name}
            </p>
          </div>
        </div>
        <RulesButton onClick={onShowRules} />
      </div>

      <Track
        players={players}
        positions={shown}
        finishOrder={race.finishOrder}
        trackLength={settings.trackLength}
        activeSeat={stage === "over" ? null : current}
      />

      <RollPanel
        roll={rollVisible ? roll : null}
        rolling={stage === "rolling"}
        berkh={rollVisible && outcome !== null && outcome.durvunBerkh}
        message={message}
        detail={detail}
        button={button}
      />

      <RankingList
        players={players}
        race={shownRace}
        trackLength={settings.trackLength}
        activeSeat={stage === "over" ? null : current}
        youSeat={youSeat}
      />

      {settings.pushRule && (
        <p className="text-center text-xs text-white/40">
          Түлхэх дүрэм асаалттай: буусан шагай дээрх морь 1 алхам ухарна.
        </p>
      )}

      {stage === "shown" && outcome?.durvunBerkh && <BerkhCelebration />}
    </>
  );
}

function Results({
  mode,
  players,
  race,
  onRestart,
  onChangeSettings,
}: {
  mode: Mode;
  players: MoriPlayer[];
  race: RaceState;
  onRestart: () => void;
  onChangeSettings: () => void;
}) {
  const places = standings(race);
  const winner = places[0];
  const youWon = mode === "computer" && winner === 0;
  const yourPlace = mode === "computer" ? places.indexOf(0) + 1 : 0;

  const resultText = youWon ? "Та түрүүллээ!" : `${players[winner].name} түрүүллээ!`;
  const subtitle =
    yourPlace > 1
      ? `Таны байр: ${yourPlace} · ${players.length} морь уралдлаа`
      : `Түрүү магнай · ${players.length} морь уралдлаа`;

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

      <button type="button" onClick={onChangeSettings} className={SECONDARY_BUTTON}>
        Тохиргоо солих
      </button>
    </div>
  );
}

function Match({
  mode,
  players,
  settings,
  onRestart,
  onChangeSettings,
  onShowRules,
}: {
  mode: Mode;
  players: MoriPlayer[];
  settings: MoriSettings;
  onRestart: () => void;
  onChangeSettings: () => void;
  onShowRules: () => void;
}) {
  const [firstSeat, setFirstSeat] = useState<number | null>(null);
  const [finalRace, setFinalRace] = useState<RaceState | null>(null);

  if (finalRace) {
    return (
      <Results
        mode={mode}
        players={players}
        race={finalRace}
        onRestart={onRestart}
        onChangeSettings={onChangeSettings}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {firstSeat === null ? (
        <OpeningRoll
          mode={mode}
          players={players}
          onDone={setFirstSeat}
          onShowRules={onShowRules}
        />
      ) : (
        <Race
          mode={mode}
          players={players}
          settings={settings}
          firstSeat={firstSeat}
          onFinish={setFinalRace}
          onShowRules={onShowRules}
        />
      )}

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

export default function MoriGame() {
  const [setup, setSetup] = useState(INITIAL_SETUP);
  const [playing, setPlaying] = useState(false);
  const [matchKey, setMatchKey] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const players = useMemo(() => buildPlayers(setup), [setup]);

  return (
    <>
      {playing ? (
        <Match
          key={matchKey}
          mode={setup.mode}
          players={players}
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
