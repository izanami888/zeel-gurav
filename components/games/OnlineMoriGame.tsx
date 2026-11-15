"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  countHorses,
  evaluateRoll,
  finishPosition,
  standings,
  type RaceState,
} from "@/games/mori/logic";
import {
  MORI_ERROR_MESSAGE,
  pendingSeat,
  positionsBefore,
  toLogicPlayers,
  toRace,
  type MoriAction,
  type MoriErrorCode,
  type MoriRoom,
} from "@/games/mori/online";
import {
  MoriRoomError,
  fetchMoriRoom,
  sendMoriAction,
  subscribeToMoriRoom,
  type MoriSession,
} from "@/lib/moriOnline";
import { MAX_NAME_LENGTH } from "@/games/chuluu/online";
import { loadSavedName, saveName } from "@/lib/chuluuOnline";
import {
  BERKH_MS,
  BerkhCelebration,
  FINISH_MS,
  FinalPlaces,
  HORSE_COLORS,
  HorseToken,
  NO_MOVE_MS,
  OpeningBoard,
  PUSH_MS,
  REVEAL_MS,
  ROLL_MS,
  RankingList,
  RollPanel,
  RulesButton,
  RulesDialog,
  SETTLE_MS,
  STEP_MS,
  TEXT_INPUT,
  Track,
  TurnHeader,
  describeRoll,
  horseLabel,
} from "@/components/games/mori/MoriParts";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/games/ui";
import ResultShareCard from "@/components/ResultShareCard";
import RoomShare from "@/components/RoomShare";

const GAME_NAME = "Морь уралдуулах";

/** Сервер рүү "би энд байна" гэж мэдэгдэх давтамж. */
const PING_EVERY_MS = 10_000;
/** Ээлжтэй тоглогчийг хүлээж эхэлснээс хойш серверээс анх асуух хугацаа. */
const NUDGE_FIRST_MS = 2_500;
/** Дараа нь "өмнөөс нь хаяж болох уу" гэж асуух давтамж. */
const NUDGE_EVERY_MS = 6_000;
/** Эхлэгч тодорсныг харуулах хугацаа. */
const ANNOUNCE_MS = 2_200;
/** Өөрөө хаясан үед хариу ирсний дараа шагай дор хаяж ийм удаан эргэлдэнэ. */
const MIN_ROLL_MS = 250;

type Stage =
  | "rolling" // шагай эргэлдэж байна
  | "shown" // буусан талыг харуулж байна
  | "moving" // морь алхам алхмаар урагшилж байна
  | "pushing" // түлхэгдсэн морь ухарч байна
  | "settled" // нүүдэл дууссан
  | "announce"; // эхлэгч тодорсон

/**
 * Дэлгэцэнд харагдаж буй үзэгдэл. Серверээс шинэ хаялт ирэхэд шууд
 * үсрэхгүй: `room.last_roll`-ийг алхам алхмаар тоглуулж гүйцнэ. Ингэснээр
 * бүх тоглогч, үзэгч ижил хөдөлгөөн харна.
 */
interface Scene {
  /** Харуулж буй өрөөний төлөв (хөдөлгөөн дууссаны дараах байдал). */
  room: MoriRoom;
  /** Тоглож буй хөдөлгөөний үе шат; null бол хөдөлгөөнгүй. */
  stage: Stage | null;
  /** Морьдын харагдах байрлал. */
  shown: number[];
}

function errorCode(error: unknown): MoriErrorCode {
  return error instanceof MoriRoomError ? error.code : "server_error";
}

function settingsSummary(room: MoriRoom): string {
  return [
    `${room.settings.trackLength} шагайн зам`,
    `түлхэх дүрэм ${room.settings.pushRule ? "асаалттай" : "унтраалттай"}`,
  ].join(" · ");
}

export default function OnlineMoriGame({ roomId }: { roomId: string }) {
  const router = useRouter();

  // `room` — серверийн хамгийн сүүлийн төлөв; `scene` — дэлгэцэнд харагдах нь.
  const [room, setRoom] = useState<MoriRoom | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<MoriErrorCode | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [connected, setConnected] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [onlineSeats, setOnlineSeats] = useState<Set<number> | null>(null);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const rollClickedAt = useRef(0);

  // Хуучин мэдээлэл шинийг дарахаас сэргийлж version-оор харьцуулна.
  const applyRoom = useCallback((next: MoriRoom) => {
    setRoom((prev) => (!prev || next.version > prev.version ? next : prev));
  }, []);

  const applySession = useCallback(
    (session: MoriSession) => {
      applyRoom(session.room);
      setSeat(session.seat);
    },
    [applyRoom]
  );

  const refresh = useCallback(async () => {
    const latest = await fetchMoriRoom(roomId);
    if (latest) applyRoom(latest);
  }, [roomId, applyRoom]);

  /** Алдааг үл тоож, зөвхөн шинэ төлөвийг авна (ping, өмнөөс нь хаяулах). */
  const sendQuietly = useCallback(
    (action: MoriAction) => sendMoriAction(roomId, action).then(applySession, () => {}),
    [roomId, applySession]
  );

  // 1) Өрөөг нээх (суудалтай бол буцаж орно; үгүй бол үзэгч).
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setName(loadSavedName());
    sendMoriAction(roomId, { type: "view" })
      .then((session) => {
        if (cancelled) return;
        applySession(session);
        // Дууссан уралдааны холбоосыг нээвэл шууд үр дүнг харуулна.
        if (session.room.status === "finished") setResultsOpen(true);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorCode(error));
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, loadAttempt, applySession]);

  const loaded = room !== null;
  const status = room?.status ?? null;
  const racing = status === "opening" || status === "race";

  // 2) Realtime: өрөөний өөрчлөлт болон хэн холбогдсоныг сонсоно.
  useEffect(() => {
    if (!loaded) return;
    const unsubscribe = subscribeToMoriRoom(roomId, seat, {
      onRoom: applyRoom,
      onPresence: setOnlineSeats,
      onConnection: (isConnected) => {
        setConnected(isConnected);
        if (isConnected) void refresh();
      },
    });
    return () => {
      unsubscribe();
      setConnected(false);
      setOnlineSeats(null);
    };
  }, [roomId, seat, loaded, applyRoom, refresh]);

  // 3) Нөөц: Realtime ажиллахгүй үед ч зогсохгүйн тулд үе үе уншина.
  useEffect(() => {
    if (!status || status === "finished") return;
    const interval = setInterval(refresh, connected ? 15000 : 3000);
    const onWake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [status, connected, refresh]);

  useEffect(() => {
    if (connected || !loaded) {
      setShowOffline(false);
      return;
    }
    const timer = setTimeout(() => setShowOffline(true), 5000);
    return () => clearTimeout(timer);
  }, [connected, loaded]);

  // 4) Уралдааны үеэр серверт "би энд байна" гэж тогтмол мэдэгдэнэ. Удаан
  //    чимээгүй болсон тоглогчийн өмнөөс сервер шагайг нь хаяна.
  useEffect(() => {
    if (seat === null || !racing) return;
    const ping = () => {
      if (document.visibilityState === "visible") void sendQuietly({ type: "ping" });
    };
    ping();
    const interval = setInterval(ping, PING_EVERY_MS);
    return () => clearInterval(interval);
  }, [seat, racing, sendQuietly]);

  // 5) Үзэгдлийг серверийн төлөвтэй гүйцүүлнэ. Шинэ хаялт ирсэн бол
  //    хөдөлгөөнийг эхнээс нь тоглуулна; тоглож буй хөдөлгөөн байвал
  //    эхлээд түүнийг дуусгана.
  const sceneIdle = scene === null || scene.stage === null;
  useEffect(() => {
    if (!room || !sceneIdle) return;
    setScene((prev) => {
      if (prev && (prev.stage !== null || prev.room.version >= room.version)) {
        return prev;
      }
      const event = room.last_roll;
      const animate =
        prev !== null &&
        event !== null &&
        room.roll_seq > prev.room.roll_seq &&
        document.visibilityState === "visible";
      return animate
        ? { room, stage: "rolling", shown: positionsBefore(room, event) }
        : { room, stage: null, shown: room.positions };
    });
  }, [room, sceneIdle]);

  // 6) Хөдөлгөөний үе шатуудыг цагаар ахиулна.
  useEffect(() => {
    if (!scene || scene.stage === null) return;
    const event = scene.room.last_roll;
    const done: Scene = { room: scene.room, stage: null, shown: scene.room.positions };
    const at = (stage: Stage): Scene => ({ ...scene, stage });

    let delay: number;
    let next: Scene;
    if (!event || document.visibilityState !== "visible") {
      // Хуудас нуугдсан үед хөдөлгөөн тоглуулахгүй, шууд гүйцээнэ.
      delay = 0;
      next = done;
    } else if (scene.stage === "rolling") {
      // Өөрөө хаясан бол товч дарсан мөчөөс шагай аль хэдийн эргэлдэж байгаа.
      const mine = event.seat === seat && !event.auto;
      const waited = mine ? Date.now() - rollClickedAt.current : 0;
      delay = Math.max(MIN_ROLL_MS, ROLL_MS - Math.max(0, waited));
      next = at("shown");
    } else if (event.kind === "opening") {
      if (scene.stage === "shown") {
        delay = REVEAL_MS;
        next = event.first !== null ? at("announce") : done;
      } else {
        delay = ANNOUNCE_MS;
        next = done;
      }
    } else if (scene.stage === "shown") {
      if (event.to === event.from) {
        delay = NO_MOVE_MS;
        next = done;
      } else {
        delay = evaluateRoll(event.sides).durvunBerkh ? BERKH_MS : REVEAL_MS;
        next = at("moving");
      }
    } else if (scene.stage === "moving") {
      if (scene.shown[event.seat] < event.to) {
        delay = STEP_MS;
        next = {
          ...scene,
          shown: scene.shown.map((position, index) =>
            index === event.seat ? position + 1 : position
          ),
        };
      } else if (event.pushed.length > 0) {
        delay = STEP_MS;
        next = { ...scene, stage: "pushing", shown: scene.room.positions };
      } else {
        delay = 0;
        next = at("settled");
      }
    } else if (scene.stage === "pushing") {
      delay = PUSH_MS;
      next = at("settled");
    } else {
      delay = event.finished ? FINISH_MS : SETTLE_MS;
      next = done;
    }

    const timer = setTimeout(() => setScene(next), delay);
    return () => clearTimeout(timer);
  }, [scene, seat]);

  // 7) Ээлжтэй тоглогчийг хүлээж удвал серверээс "өмнөөс нь хаяж болох уу"
  //    гэж асууна. Шийдвэрийг сервер гаргана: тоглогч үнэхээр удаан
  //    чимээгүй байсан үед л хаяна.
  const caughtUp =
    scene !== null &&
    room !== null &&
    scene.stage === null &&
    scene.room.version === room.version;
  const waitingFor = caughtUp ? pendingSeat(scene.room) : null;
  const waitingSeq = caughtUp ? scene.room.roll_seq : -1;
  useEffect(() => {
    if (seat === null || waitingFor === null || waitingFor === seat) return;
    const nudge = () => void sendQuietly({ type: "nudge", seq: waitingSeq });
    const first = setTimeout(nudge, NUDGE_FIRST_MS);
    const interval = setInterval(nudge, NUDGE_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [seat, waitingFor, waitingSeq, sendQuietly]);

  async function run(action: MoriAction) {
    setBusy(true);
    setActionError(null);
    try {
      applySession(await sendMoriAction(roomId, action));
    } catch (error) {
      setActionError(MORI_ERROR_MESSAGE[errorCode(error)]);
      void refresh();
    }
    setBusy(false);
  }

  /** Шагай хаях: сервер рүү зөвхөн "хая" гэж илгээнэ, үр дүнг сервер гаргана. */
  async function handleRoll(seq: number) {
    rollClickedAt.current = Date.now();
    setPendingRoll(true);
    setActionError(null);
    try {
      applySession(await sendMoriAction(roomId, { type: "roll", seq }));
    } catch (error) {
      setActionError(MORI_ERROR_MESSAGE[errorCode(error)]);
      void refresh();
    }
    setPendingRoll(false);
  }

  if (loadError) {
    return (
      <div className={`flex w-full flex-col items-center gap-4 p-6 text-center ${CARD}`}>
        <p role="alert" className="text-white/90">
          {MORI_ERROR_MESSAGE[loadError]}
        </p>
        {loadError !== "not_found" && (
          <button
            type="button"
            onClick={() => setLoadAttempt((count) => count + 1)}
            className={PRIMARY_BUTTON}
          >
            Дахин оролдох
          </button>
        )}
        <Link
          href="/games/mori"
          className="text-sm font-medium text-mongol-gold-light underline underline-offset-4"
        >
          Морь уралдуулах руу буцах
        </Link>
      </div>
    );
  }

  if (!room || !scene) {
    return (
      <p className="animate-pulse py-16 text-center text-white/70">
        Өрөөнд холбогдож байна...
      </p>
    );
  }

  const view = scene.room;
  const stage = scene.stage;
  const event = view.last_roll;
  const players = toLogicPlayers(view);
  const isPlayer = seat !== null;
  const nameOf = (index: number) => (index === seat ? "Та" : players[index].name);
  const isOffline = (index: number) =>
    connected && onlineSeats !== null && index !== seat && !onlineSeats.has(index);

  const errorLine = actionError && (
    <p role="alert" className="text-center text-sm text-red-300">
      {actionError}
    </p>
  );
  const offlineNotice = showOffline && (
    <div
      role="status"
      className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-center text-sm text-white/90"
    >
      Холболт тасарлаа. Дахин холбогдож байна...
    </div>
  );
  const rules = showRules && <RulesDialog onClose={() => setShowRules(false)} />;

  // ---------- Тоглогчдыг хүлээх өрөө ----------
  if (view.status === "lobby") {
    const full = view.players.length >= MAX_PLAYERS;
    return (
      <div className="flex w-full flex-col gap-4">
        {offlineNotice}
        <div className={`flex flex-col items-center gap-5 p-5 ${CARD}`}>
          <p className="animate-pulse text-lg font-semibold text-white" aria-live="polite">
            Тоглогчдыг хүлээж байна...
          </p>
          <RoomShare
            roomId={view.id}
            path={`/games/mori/room/${view.id}`}
            shareTitle={`${GAME_NAME} — Тоглоомын Тавцан`}
            shareText="Надтай морь уралдуулах уу?"
          />
        </div>

        <div className={`flex flex-col gap-3 p-4 ${CARD}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
              Тоглогчид ({view.players.length}/{MAX_PLAYERS})
            </p>
            <RulesButton onClick={() => setShowRules(true)} />
          </div>
          <ol className="flex flex-col gap-2">
            {players.map((player, index) => (
              <li
                key={index}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-mongol-blue-light/40 px-3 py-2 text-white"
              >
                <HorseToken
                  color={HORSE_COLORS[index]}
                  label={horseLabel(player.name)}
                  size={28}
                />
                <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                {index === seat && (
                  <span className="rounded-full bg-mongol-gold/20 px-2 py-0.5 text-[10px] font-medium text-mongol-gold-light">
                    та
                  </span>
                )}
                {index === 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
                    өрөөний эзэн
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="text-xs text-white/50">{settingsSummary(view)}</p>
        </div>

        <div className={`flex flex-col gap-3 p-4 text-center ${CARD}`}>
          {!isPlayer &&
            (full ? (
              <p className="text-sm text-white/70">Өрөө дүүрсэн байна.</p>
            ) : (
              <>
                <input
                  type="text"
                  maxLength={MAX_NAME_LENGTH}
                  value={name}
                  placeholder="Таны нэр"
                  aria-label="Таны нэр"
                  onChange={(change) => setName(change.target.value)}
                  className={TEXT_INPUT}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    saveName(name.trim());
                    void run({ type: "join", name });
                  }}
                  className={PRIMARY_BUTTON}
                >
                  Нэгдэх
                </button>
              </>
            ))}

          {seat === 0 && (
            <>
              <button
                type="button"
                disabled={busy || view.players.length < MIN_PLAYERS}
                onClick={() => run({ type: "start" })}
                className={PRIMARY_BUTTON}
              >
                Эхлүүлэх
              </button>
              <p className="text-xs text-white/50">
                {view.players.length < MIN_PLAYERS
                  ? "Дор хаяж 2 тоглогч хэрэгтэй."
                  : "Бүгд орсон бол эхлүүлээрэй."}
              </p>
            </>
          )}

          {isPlayer && seat !== 0 && (
            <p className="animate-pulse text-sm text-white/70">
              Өрөөний эзэн эхлүүлэхийг хүлээж байна...
            </p>
          )}
          {errorLine}
        </div>

        {rules}
      </div>
    );
  }

  // ---------- Уралдаан дууссан: үр дүн ----------
  if (view.status === "finished" && stage === null && resultsOpen) {
    const places = standings(toRace(view));
    const winner = places[0];
    const myPlace = isPlayer ? places.indexOf(seat) + 1 : 0;
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <ResultShareCard
          game={GAME_NAME}
          result={`${nameOf(winner)} түрүүллээ!`}
          subtitle={
            myPlace > 1
              ? `Таны байр: ${myPlace} · ${players.length} морь уралдлаа`
              : `Түрүү магнай · ${players.length} морь уралдлаа`
          }
          onPlayAgain={() => router.push("/games/mori")}
        />
        <FinalPlaces players={players} places={places} youSeat={seat} />
      </div>
    );
  }

  // ---------- Уралдаан явагдаж байна ----------
  const animating = stage !== null;
  // Шинэ хаялт ирсэн ч хөдөлгөөн нь хараахан эхлээгүй богино завсар.
  const queued = !animating && room.roll_seq > view.roll_seq;
  const tumbling = stage === "rolling" || pendingRoll || queued;
  const turnSeat = pendingSeat(view);
  const myTurn =
    isPlayer && !animating && !pendingRoll && !queued && turnSeat === seat;
  const waitingButton = { label: isPlayer ? "Ээлжээ хүлээнэ үү" : "👀 Та үзэж байна" };
  const autoNote = "Удаан хүлээлгэсэн тул автоматаар хаялаа.";

  const footer = (
    <>
      {!isPlayer && (
        <p className="text-center text-xs text-white/50">👀 Та үзэгчээр орсон байна</p>
      )}
      {errorLine}
      <div className="flex items-center justify-center gap-4">
        <p className="text-xs text-white/40">Өрөөний код: {view.id}</p>
        <Link href="/games/mori" className={SECONDARY_BUTTON}>
          Гарах
        </Link>
      </div>
      {rules}
    </>
  );

  // Эхлэх дарааллын шодолт (эхлэгчийг тодруулсан хаялтын хөдөлгөөн дуустал).
  const opening = view.opening;
  if (opening && (view.status === "opening" || (animating && event?.kind === "opening"))) {
    const openingEvent = animating && event?.kind === "opening" ? event : null;
    const revealed = openingEvent !== null && stage !== "rolling";
    // Тэнцэж шинэ тойрог эхлүүлсэн хаялтыг тоглуулж байх зуур өмнөх тойргийг
    // (бүгдийн хаялтыг) харуулна.
    const closingRound = openingEvent?.tied ? openingEvent.round : null;
    const round = closingRound ?? opening.round;
    const inRound = (index: number) =>
      closingRound !== null
        ? opening.rolls[index]?.round === closingRound
        : opening.contenders.includes(index);
    const first = stage === "announce" ? openingEvent?.first ?? null : null;
    const rollerSeat = openingEvent ? openingEvent.seat : turnSeat;

    const horses = openingEvent ? countHorses(openingEvent.sides) : 0;
    let message: string;
    let detail: string | null = null;
    if (first !== null) {
      message = `${nameOf(first)} түрүүлж эхэлнэ!`;
    } else if (revealed) {
      message = horses === 0 ? "Морь буусангүй" : `${horses} морь буулаа`;
      if (openingEvent?.auto) detail = autoNote;
    } else if (tumbling) {
      message = "Шагай эргэлдэж байна...";
    } else if (myTurn) {
      message = "Шагайгаа хая!";
    } else {
      message = `${players[view.turn].name} хаях ээлж...`;
      if (isOffline(view.turn)) detail = "Холболтгүй байна — удахгүй автоматаар хаяна.";
    }

    return (
      <div className="flex w-full flex-col gap-4">
        {offlineNotice}
        <OpeningBoard
          players={players}
          rows={players.map((_, index) => {
            const entry = opening.rolls[index];
            const hidden = openingEvent?.seat === index && !revealed;
            return {
              roll:
                entry && !hidden && (entry.round === round || !inRound(index))
                  ? entry.sides
                  : null,
              mark:
                first === index
                  ? "first"
                  : first === null && rollerSeat === index
                    ? "rolling"
                    : null,
              dim: !inRound(index) || (first !== null && first !== index),
              offline: isOffline(index),
            };
          })}
          tie={
            first !== null || (openingEvent?.tied && !revealed) ? null : opening.tie
          }
          youSeat={seat}
          onShowRules={() => setShowRules(true)}
        />
        <RollPanel
          roll={revealed ? openingEvent.sides : null}
          rolling={tumbling}
          lead={
            first !== null ? (
              <HorseToken
                color={HORSE_COLORS[first]}
                label={horseLabel(players[first].name)}
                size={72}
              />
            ) : undefined
          }
          message={message}
          detail={detail}
          button={
            myTurn
              ? { label: "Шагай хаях", onClick: () => handleRoll(view.roll_seq) }
              : rollerSeat === seat
                ? { label: "Шагай хаях" }
                : waitingButton
          }
        />
        {footer}
      </div>
    );
  }

  // Уралдаан.
  const raceEvent = event?.kind === "race" ? event : null;
  const outcome = raceEvent ? evaluateRoll(raceEvent.sides) : null;
  const finish = finishPosition(view.settings);
  const over = view.status === "finished" && !animating;
  const actor = animating && raceEvent ? raceEvent.seat : view.turn;
  // Толгой хэсэгт: ээлжтэй тоглогч, дууссаны дараа түрүүлсэн тоглогч.
  const headSeat = over ? view.finish_order[0] : actor;
  const rollVisible = animating && stage !== "rolling" && raceEvent !== null;
  const arrived = raceEvent !== null && scene.shown[raceEvent.seat] >= raceEvent.to;

  // Жагсаалтад морь бариаг давсны дараа л "барианд орсон" гэж харуулна.
  const shownRace: RaceState = {
    positions: scene.shown,
    finishOrder: view.finish_order.filter((index) => scene.shown[index] >= finish),
  };
  const iFinished = isPlayer && shownRace.finishOrder.includes(seat);
  const lastNote =
    raceEvent && outcome
      ? `${players[raceEvent.seat].name}: ${describeRoll(outcome)}`
      : null;

  let message: string;
  let detail: string | null = null;
  if (over) {
    message = "Уралдаан дууслаа!";
  } else if (rollVisible && outcome) {
    message = describeRoll(outcome);
    if (raceEvent.auto) detail = autoNote;
  } else if (tumbling) {
    message = "Шагай эргэлдэж байна...";
  } else if (myTurn) {
    const bonus = raceEvent?.seat === seat && outcome?.rollAgain;
    message = bonus ? "4 морь буулаа — дахин хая!" : "Шагайгаа хая!";
    detail = lastNote;
  } else {
    message = `${players[view.turn].name} хаях ээлж...`;
    detail = isOffline(view.turn)
      ? "Холболтгүй байна — удахгүй автоматаар хаяна."
      : lastNote;
  }

  if (raceEvent && arrived && (over || stage === "settled" || stage === "pushing")) {
    if (raceEvent.finished) {
      const place = view.finish_order.indexOf(raceEvent.seat) + 1;
      detail =
        place === 1
          ? `🏆 ${nameOf(raceEvent.seat)} түрүүллээ — Түрүү магнай!`
          : `🏁 ${nameOf(raceEvent.seat)} барианд орлоо — ${place}-р байр!`;
    } else if (raceEvent.pushed.length > 0) {
      detail = `Түлхлээ! ${raceEvent.pushed.map(nameOf).join(", ")} 1 алхам ухарлаа.`;
    }
  }

  const button = over
    ? { label: "Үр дүн харах", onClick: () => setResultsOpen(true) }
    : myTurn
      ? { label: "Шагай хаях", onClick: () => handleRoll(view.roll_seq) }
      : iFinished
        ? { label: "🏁 Та барианд орсон" }
        : actor === seat
          ? { label: "Шагай хаях" }
          : waitingButton;

  return (
    <div className="flex w-full flex-col gap-4">
      <TurnHeader
        players={players}
        seat={headSeat}
        label={over ? "Түрүү магнай" : headSeat === seat ? "Таны ээлж" : "Ээлж"}
        onShowRules={() => setShowRules(true)}
      />

      {offlineNotice}

      <Track
        players={players}
        positions={scene.shown}
        finishOrder={view.finish_order}
        trackLength={view.settings.trackLength}
        activeSeat={over ? null : actor}
      />

      <RollPanel
        roll={rollVisible ? raceEvent.sides : null}
        rolling={tumbling}
        berkh={rollVisible && outcome !== null && outcome.durvunBerkh}
        message={message}
        detail={detail}
        button={button}
      />

      <RankingList
        players={players}
        race={shownRace}
        trackLength={view.settings.trackLength}
        activeSeat={over ? null : actor}
        youSeat={seat}
        offlineSeats={new Set(players.map((_, index) => index).filter(isOffline))}
      />

      {view.settings.pushRule && (
        <p className="text-center text-xs text-white/40">
          Түлхэх дүрэм асаалттай: буусан шагай дээрх морь 1 алхам ухарна.
        </p>
      )}

      {footer}

      {stage === "shown" && outcome?.durvunBerkh && <BerkhCelebration />}
    </div>
  );
}
