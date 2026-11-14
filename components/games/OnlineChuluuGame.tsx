"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  hideLimit,
  maxPossibleTotal,
} from "@/games/chuluu/logic";
import {
  CHULUU_ERROR_MESSAGE,
  MAX_NAME_LENGTH,
  pendingSeats,
  toLogicPlayers,
  type ChuluuAction,
  type ChuluuErrorCode,
  type ChuluuRoom,
} from "@/games/chuluu/online";
import {
  ChuluuRoomError,
  fetchChuluuRoom,
  loadSavedName,
  saveName,
  sendChuluuAction,
  subscribeToChuluuRoom,
  type ChuluuSession,
} from "@/lib/chuluuOnline";
import {
  CARD,
  NumberPad,
  PRIMARY_BUTTON,
  PlayerRow,
  RulesDialog,
  SECONDARY_BUTTON,
  StonePile,
  type FistState,
} from "@/components/games/chuluu/ChuluuParts";
import ResultShareCard from "@/components/ResultShareCard";
import RoomShare from "@/components/RoomShare";

const GAME_NAME = "Чулуу таалцах";

/** Сервер рүү "би энд байна" гэж мэдэгдэх давтамж. */
const PING_EVERY_MS = 15_000;
/** Хүлээгдэж буй тоглогчийг алгасахыг серверээс асуух давтамж. */
const SKIP_CHECK_EVERY_MS = 8_000;
/** Гар нээгдсэний дараа автоматаар дараагийн үе рүү шилжих хугацаа. */
const AUTO_NEXT_MS = 15_000;

function errorCode(error: unknown): ChuluuErrorCode {
  return error instanceof ChuluuRoomError ? error.code : "server_error";
}

function settingsSummary(room: ChuluuRoom): string {
  const { startStones, maxHide, roundLimit } = room.settings;
  return [
    `${startStones} чулуу`,
    `нэг удаад ${maxHide} хүртэл`,
    roundLimit === null ? "хязгааргүй үе" : `${roundLimit} үе`,
  ].join(" · ");
}

export default function OnlineChuluuGame({ roomId }: { roomId: string }) {
  const router = useRouter();

  const [room, setRoom] = useState<ChuluuRoom | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  // Миний энэ үеийн гар. Бусдын гарыг хөтөч хэзээ ч мэдэхгүй.
  const [hand, setHand] = useState<{ round: number; count: number } | null>(null);
  const [loadError, setLoadError] = useState<ChuluuErrorCode | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [connected, setConnected] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [onlineSeats, setOnlineSeats] = useState<Set<number> | null>(null);

  const [name, setName] = useState("");
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Хуучин мэдээлэл шинийг дарахаас сэргийлж version-оор харьцуулна.
  const applyRoom = useCallback((next: ChuluuRoom) => {
    setRoom((prev) => (!prev || next.version > prev.version ? next : prev));
  }, []);

  const applySession = useCallback(
    (session: ChuluuSession) => {
      applyRoom(session.room);
      setSeat(session.seat);
      if (session.myHand !== null) {
        setHand({ round: session.room.round, count: session.myHand });
      }
    },
    [applyRoom]
  );

  const refresh = useCallback(async () => {
    const latest = await fetchChuluuRoom(roomId);
    if (latest) applyRoom(latest);
  }, [roomId, applyRoom]);

  /** Алдааг үл тоож, зөвхөн шинэ төлөвийг авна (ping, алгасах, автомат). */
  const sendQuietly = useCallback(
    (action: ChuluuAction) =>
      sendChuluuAction(roomId, action).then(applySession, () => {}),
    [roomId, applySession]
  );

  // 1) Өрөөг нээх (суудалтай бол буцаж орно).
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setName(loadSavedName());
    sendChuluuAction(roomId, { type: "view" })
      .then((session) => {
        if (!cancelled) applySession(session);
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

  // 2) Realtime: өрөөний өөрчлөлт болон хэн холбогдсоныг сонсоно.
  useEffect(() => {
    if (!loaded) return;
    const unsubscribe = subscribeToChuluuRoom(roomId, seat, {
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

  // 4) Тоглож байх үед серверт "би энд байна" гэж тогтмол мэдэгдэнэ.
  //    Удаан чимээгүй болсон тоглогчийн ээлжийг сервер алгасахыг зөвшөөрнө.
  useEffect(() => {
    if (seat === null || status !== "playing") return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void sendQuietly({ type: "ping" });
    }, PING_EVERY_MS);
    return () => clearInterval(interval);
  }, [seat, status, sendQuietly]);

  // 5) Хэн нэгнийг хүлээж удвал серверээс "алгасаж болох уу" гэж асууна.
  //    Шийдвэрийг сервер гаргана: тоглогч үнэхээр удаан чимээгүй байсан
  //    үед л зөвшөөрнө.
  const waitingKey = room
    ? `${room.round}:${room.phase}:${room.turn}:${room.hidden_done.join("")}`
    : "";
  useEffect(() => {
    if (!room || seat === null || room.status !== "playing") return;
    const targets = pendingSeats(room).filter((target) => target !== seat);
    if (targets.length === 0) return;
    const round = room.round;
    const interval = setInterval(() => {
      for (const target of targets) {
        void sendQuietly({ type: "skip", round, seat: target });
      }
    }, SKIP_CHECK_EVERY_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingKey, seat, sendQuietly]);

  // 6) Гар нээгдэхэд: эхлээд гар, дараа нь чулуу шилжих; хэсэг хугацааны
  //    дараа автоматаар үргэлжилнэ.
  const revealKey = room?.phase === "reveal" ? room.round : null;
  useEffect(() => {
    setShowTransfer(false);
    if (revealKey === null) return;
    const transfer = setTimeout(() => setShowTransfer(true), 1800);
    const auto =
      seat !== null
        ? setTimeout(
            () => void sendQuietly({ type: "next", round: revealKey }),
            AUTO_NEXT_MS
          )
        : null;
    return () => {
      clearTimeout(transfer);
      if (auto) clearTimeout(auto);
    };
  }, [revealKey, seat, sendQuietly]);

  // Үе шат солигдоход сонголтыг арилгана.
  useEffect(() => {
    setPick(null);
    setActionError(null);
  }, [waitingKey]);

  async function run(action: ChuluuAction) {
    setBusy(true);
    setActionError(null);
    try {
      applySession(await sendChuluuAction(roomId, action));
    } catch (error) {
      setActionError(CHULUU_ERROR_MESSAGE[errorCode(error)]);
      void refresh();
    }
    setBusy(false);
  }

  if (loadError) {
    return (
      <div className={`flex w-full flex-col items-center gap-4 p-6 text-center ${CARD}`}>
        <p role="alert" className="text-white/90">
          {CHULUU_ERROR_MESSAGE[loadError]}
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
          href="/games/chuluu"
          className="text-sm font-medium text-mongol-gold-light underline underline-offset-4"
        >
          Чулуу таалцах руу буцах
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <p className="animate-pulse py-16 text-center text-white/70">
        Өрөөнд холбогдож байна...
      </p>
    );
  }

  const players = toLogicPlayers(room);
  const isPlayer = seat !== null;
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

  // ---------- Тоглогчдыг хүлээх өрөө ----------
  if (room.status === "lobby") {
    const full = room.players.length >= MAX_PLAYERS;
    return (
      <div className="flex w-full flex-col gap-4">
        {offlineNotice}
        <div className={`flex flex-col items-center gap-5 p-5 ${CARD}`}>
          <p className="animate-pulse text-lg font-semibold text-white" aria-live="polite">
            Тоглогчдыг хүлээж байна...
          </p>
          <RoomShare
            roomId={room.id}
            path={`/games/chuluu/room/${room.id}`}
            shareTitle={`${GAME_NAME} — Тоглоомын Тавцан`}
            shareText="Надтай чулуу таалцах уу?"
          />
        </div>

        <div className={`flex flex-col gap-3 p-4 ${CARD}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
              Тоглогчид ({room.players.length}/{MAX_PLAYERS})
            </p>
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="shrink-0 whitespace-nowrap rounded-full border border-mongol-gold/40 px-4 py-1.5 text-sm font-medium text-mongol-gold-light"
            >
              📖 Дүрэм
            </button>
          </div>
          <ol className="flex flex-col gap-2">
            {room.players.map((player, index) => (
              <li
                key={index}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-mongol-blue-light/40 px-3 py-2 text-white"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mongol-gold text-xs font-bold text-mongol-blue">
                  {index + 1}
                </span>
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
          <p className="text-xs text-white/50">{settingsSummary(room)}</p>
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
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-mongol-gold/30 bg-mongol-blue/60 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-mongol-gold focus:outline-none"
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
                disabled={busy || room.players.length < MIN_PLAYERS}
                onClick={() => run({ type: "start" })}
                className={PRIMARY_BUTTON}
              >
                Эхлүүлэх
              </button>
              <p className="text-xs text-white/50">
                {room.players.length < MIN_PLAYERS
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

        {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  // ---------- Тоглоом дууссан ----------
  if (room.status === "finished" && room.result) {
    const { winners, rounds } = room.result;
    const stones = room.players[winners[0]].stones;
    const isDraw = winners.length > 1;
    const resultText = isDraw
      ? "Тэнцлээ!"
      : winners[0] === seat
        ? "Та яллаа!"
        : `${room.players[winners[0]].name} яллаа!`;
    const subtitle = isDraw
      ? `${winners.map((winner) => room.players[winner].name).join(", ")} · тус бүр ${stones} чулуу`
      : `${rounds} үе · ${stones} чулуу`;
    const standings = room.players
      .map((player, index) => ({ player, index }))
      .sort((a, b) => b.player.stones - a.player.stones);

    return (
      <div className="flex w-full flex-col items-center gap-6">
        <ResultShareCard
          game={GAME_NAME}
          result={resultText}
          subtitle={subtitle}
          onPlayAgain={() => router.push("/games/chuluu")}
        />
        <div className={`flex w-full flex-col gap-3 p-4 ${CARD}`}>
          <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
            Эцсийн байдал
          </p>
          {standings.map(({ player, index }) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-semibold text-white">
                {winners.includes(index) ? "🏆 " : ""}
                {player.name}
                {index === seat ? " (та)" : ""}
              </span>
              <StonePile count={player.stones} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Тоглоом явагдаж байна ----------
  const phase = room.phase;
  const outcome = phase === "reveal" ? room.outcome : null;
  const turnSeat = phase === "guess" ? room.guess_order[room.turn] : undefined;
  const myHand = hand && hand.round === room.round ? hand.count : null;
  const iAmOut = isPlayer && players[seat].stones === 0;
  const myHideDone = isPlayer && room.hidden_done[seat];
  const taken = new Set(
    room.guesses.flatMap((guess) => (guess.value === null ? [] : [guess.value]))
  );
  const nameOf = (index: number) =>
    index === seat ? "Та" : room.players[index].name;

  const fistState = (index: number): FistState => {
    if (players[index].stones === 0) return { kind: "out" };
    if (phase === "reveal") {
      return { kind: "open", count: room.revealed?.[index] ?? 0 };
    }
    return room.hidden_done[index] ? { kind: "closed" } : { kind: "waiting" };
  };

  const statusOf = (index: number): string | undefined => {
    if (players[index].stones === 0) return undefined;
    if (phase === "hide") {
      return room.hidden_done[index] ? "сонгосон ✓" : "сонгож байна...";
    }
    if (phase === "guess") {
      if (turnSeat === index) return "таах ээлж...";
      return room.guesses.some((guess) => guess.seat === index)
        ? "таасан ✓"
        : "ээлжээ хүлээж байна";
    }
    return undefined;
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-widest text-mongol-gold-light/80">
          {room.round}-р үе
          {room.settings.roundLimit !== null && (
            <span className="text-white/40"> / {room.settings.roundLimit}</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="shrink-0 whitespace-nowrap rounded-full border border-mongol-gold/40 px-4 py-1.5 text-sm font-medium text-mongol-gold-light"
        >
          📖 Дүрэм
        </button>
      </div>

      {offlineNotice}
      {!isPlayer && (
        <p className="text-center text-xs text-white/50">👀 Та үзэгчээр орсон байна</p>
      )}

      {/* key: үе шат солигдоход гар нээгдэх хөдөлгөөн дахин тоглогдоно */}
      <ul key={`${room.round}:${phase}`} className="flex flex-col gap-2">
        {room.players.map((player, index) => {
          const guess = room.guesses.find((entry) => entry.seat === index);
          const reveal = outcome && showTransfer ? outcome : null;
          return (
            <PlayerRow
              key={index}
              name={player.name}
              isMe={index === seat}
              stones={reveal ? reveal.stonesAfter[index] : player.stones}
              delta={reveal ? reveal.delta[index] : 0}
              fist={fistState(index)}
              guess={guess ? guess.value : null}
              guessSkipped={guess !== undefined && guess.value === null}
              highlight={
                outcome?.winnerSeat === index
                  ? "winner"
                  : turnSeat === index
                    ? "active"
                    : null
              }
              out={player.stones === 0}
              firstGuesser={room.guess_order[0] === index && phase !== "reveal"}
              offline={
                connected &&
                onlineSeats !== null &&
                index !== seat &&
                !onlineSeats.has(index)
              }
              status={statusOf(index)}
            />
          );
        })}
      </ul>

      <div
        className={`flex flex-col items-center gap-4 p-4 text-center ${CARD}`}
        aria-live="polite"
      >
        {phase === "hide" &&
          (isPlayer && !iAmOut && !myHideDone ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-white">Хэдэн чулуу атгах вэ?</h2>
                <p className="mt-1 text-xs text-white/50">
                  Таны сонголтыг бусад тоглогч харахгүй.
                </p>
              </div>
              <NumberPad
                max={hideLimit(players[seat], room.settings)}
                selected={pick}
                onSelect={setPick}
                columns={hideLimit(players[seat], room.settings) + 1}
              />
              <button
                type="button"
                disabled={pick === null || busy}
                onClick={() =>
                  pick !== null && run({ type: "hide", round: room.round, count: pick })
                }
                className={`w-full ${PRIMARY_BUTTON}`}
              >
                ✊ Атгах
              </button>
            </>
          ) : (
            <p className="py-2 text-base font-medium text-white/80">
              {isPlayer && !iAmOut && myHand !== null && (
                <>
                  Та{" "}
                  <span className="font-bold text-mongol-gold-light">{myHand}</span>{" "}
                  чулуу атгалаа.
                  <br />
                </>
              )}
              <span className="animate-pulse">
                Бусад тоглогч чулуугаа сонгож байна...
              </span>
            </p>
          ))}

        {phase === "guess" &&
          turnSeat !== undefined &&
          (turnSeat === seat ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Нийт хэдэн чулуу байна вэ?
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Таны гарт:{" "}
                  <span className="font-bold text-mongol-gold-light">
                    {myHand ?? "?"}
                  </span>{" "}
                  чулуу · Хэлэгдсэн тоог сонгож болохгүй
                </p>
              </div>
              <NumberPad
                max={maxPossibleTotal(players, room.settings)}
                selected={pick}
                taken={taken}
                onSelect={setPick}
                columns={5}
              />
              <button
                type="button"
                disabled={pick === null || busy}
                onClick={() =>
                  pick !== null && run({ type: "guess", round: room.round, value: pick })
                }
                className={`w-full ${PRIMARY_BUTTON}`}
              >
                Таах
              </button>
            </>
          ) : (
            <p className="py-2 text-base font-medium text-white/80">
              <span className="animate-pulse">
                {room.players[turnSeat].name} таах ээлж...
              </span>
              {isPlayer && !iAmOut && myHand !== null && (
                <>
                  <br />
                  <span className="text-sm text-white/60">
                    Таны гарт:{" "}
                    <span className="font-bold text-mongol-gold-light">{myHand}</span>{" "}
                    чулуу
                  </span>
                </>
              )}
            </p>
          ))}

        {outcome && (
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
                        🎉 {nameOf(outcome.winnerSeat)} яг таалаа!
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
                      {outcome.eliminated
                        .map((index) => room.players[index].name)
                        .join(", ")}{" "}
                      чулуугүй болж хасагдлаа.
                    </p>
                  )}
                </div>
                {isPlayer ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run({ type: "next", round: room.round })}
                      className={`w-full ${PRIMARY_BUTTON}`}
                    >
                      Үргэлжлүүлэх
                    </button>
                    <p className="text-xs text-white/40">
                      Хэн ч дарахгүй бол удахгүй автоматаар үргэлжилнэ.
                    </p>
                  </>
                ) : (
                  <p className="animate-pulse text-sm text-white/60">
                    Дараагийн үеийг хүлээж байна...
                  </p>
                )}
              </>
            )}
          </>
        )}

        {iAmOut && phase !== "reveal" && (
          <p className="text-xs text-white/50">
            Та чулуугүй болж хасагдсан. Тоглоомыг үзэж байна.
          </p>
        )}
        {errorLine}
      </div>

      <div className="flex items-center justify-center gap-4">
        <p className="text-xs text-white/40">Өрөөний код: {room.id}</p>
        <Link href="/games/chuluu" className={SECONDARY_BUTTON}>
          Гарах
        </Link>
      </div>

      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
    </div>
  );
}
