"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COLOR_LABEL,
  buildGame,
  getBoard,
  getCheckedKingSquare,
  getLegalMoves,
  type Color,
  type MoveInput,
  type Square,
} from "@/games/chess/logic";
import {
  ROOM_ERROR_MESSAGE,
  describeRoomResult,
  opposite,
  type ChessRoom,
  type RoomAction,
  type RoomErrorCode,
} from "@/games/chess/online";
import {
  RoomError,
  fetchChessRoom,
  joinChessRoom,
  sendChessAction,
  subscribeToChessRoom,
  type RoomSession,
} from "@/lib/realtime";
import {
  Board,
  ColorDot,
  PromotionDialog,
} from "@/components/games/chess/ChessBoard";
import ResultShareCard from "@/components/ResultShareCard";
import RoomShare from "@/components/RoomShare";

const PRIMARY_BUTTON =
  "rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 text-sm font-semibold text-mongol-blue transition active:scale-95 disabled:opacity-60";
const SECONDARY_BUTTON =
  "rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/40 active:scale-95 disabled:opacity-40";

function errorCode(error: unknown): RoomErrorCode {
  return error instanceof RoomError ? error.code : "server_error";
}

/** Өрсөлдөгчөө хүлээх дэлгэц: QR код, холбоос, хуулах / хуваалцах. */
function WaitingRoom({ room, color }: { room: ChessRoom; color: Color }) {
  return (
    <div className="flex w-full flex-col items-center gap-5 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-5 text-center">
      <p
        className="animate-pulse text-lg font-semibold text-white"
        aria-live="polite"
      >
        Өрсөлдөгчөө хүлээж байна...
      </p>

      <RoomShare
        roomId={room.id}
        path={`/games/chess/room/${room.id}`}
        shareTitle="Шатар — Тоглоомын Тавцан"
        shareText="Надтай шатар тоглох уу?"
      />

      <p className="flex items-center gap-2 text-sm text-white/70">
        Та <ColorDot color={color} />
        <span className="font-semibold text-white">{COLOR_LABEL[color]}</span>
        талаар тоглоно
      </p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "ok" | "info";
  children: React.ReactNode;
}) {
  const colors = {
    warn: "border-red-400/40 bg-red-500/10",
    ok: "border-emerald-400/40 bg-emerald-500/10",
    info: "border-mongol-gold/40 bg-mongol-gold/10",
  }[tone];
  return (
    <div
      role="status"
      className={`flex w-full flex-col items-center gap-2 rounded-xl border p-3 text-center text-sm text-white/90 ${colors}`}
    >
      {children}
    </div>
  );
}

export default function OnlineChessGame({ roomId }: { roomId: string }) {
  const router = useRouter();

  const [session, setSession] = useState<RoomSession | null>(null);
  const [loadError, setLoadError] = useState<RoomErrorCode | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);

  const [connected, setConnected] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [onlineColors, setOnlineColors] = useState<Set<Color> | null>(null);
  const [opponent, setOpponent] = useState<"unknown" | "online" | "away" | "back">(
    "unknown"
  );

  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  // Сервер баталгаажуулахаас өмнө өөрийн нүүдлийг шууд харуулна.
  const [pendingMove, setPendingMove] = useState<{
    move: MoveInput;
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const room = session?.room ?? null;
  const role = session?.role ?? null;
  const status = room?.status ?? null;
  const isPlayer = role === "w" || role === "b";

  // Хуучин мэдээлэл шинийг дарахаас сэргийлж version-оор харьцуулна.
  const applyRoom = useCallback((next: ChessRoom) => {
    setSession((prev) =>
      prev && next.version > prev.room.version ? { ...prev, room: next } : prev
    );
  }, []);

  const refresh = useCallback(async () => {
    const latest = await fetchChessRoom(roomId);
    if (latest) applyRoom(latest);
  }, [roomId, applyRoom]);

  // 1) Өрөөнд орох (эсвэл хуудсаа дахин ачаалсны дараа буцаж орох).
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    joinChessRoom(roomId)
      .then((joined) => {
        if (!cancelled) setSession(joined);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorCode(error));
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, joinAttempt]);

  // 2) Realtime: өрөөний өөрчлөлт болон хэн холбогдсоныг сонсоно.
  useEffect(() => {
    if (!role) return;
    const unsubscribe = subscribeToChessRoom(roomId, role, {
      onRoom: applyRoom,
      onPresence: setOnlineColors,
      onConnection: (isConnected) => {
        setConnected(isConnected);
        // Дахин холбогдох үед алгассан өөрчлөлтийг нөхөж авна.
        if (isConnected) void refresh();
      },
    });
    return () => {
      unsubscribe();
      setConnected(false);
      setOnlineColors(null);
    };
  }, [roomId, role, applyRoom, refresh]);

  // 3) Нөөц: Realtime ажиллахгүй үед ч тоглоом зогсохгүйн тулд үе үе уншина.
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

  // Өөрийн холболт хэсэг хугацаанд тасарвал мэдэгдэнэ.
  useEffect(() => {
    if (connected || !role) {
      setShowOffline(false);
      return;
    }
    const timer = setTimeout(() => setShowOffline(true), 5000);
    return () => clearTimeout(timer);
  }, [connected, role]);

  // Өрсөлдөгч гарсан / буцаж ирснийг мэдэгдэнэ.
  const opponentOnline =
    isPlayer && onlineColors ? onlineColors.has(opposite(role)) : null;
  useEffect(() => {
    if (status !== "playing" || !connected || opponentOnline === null) return;

    if (opponentOnline) {
      setOpponent((prev) =>
        prev === "away" || prev === "back" ? "back" : "online"
      );
      const timer = setTimeout(
        () => setOpponent((prev) => (prev === "back" ? "online" : prev)),
        4000
      );
      return () => clearTimeout(timer);
    }
    // Түр зуурын тасалдлыг үл тооно.
    const timer = setTimeout(() => setOpponent("away"), 3000);
    return () => clearTimeout(timer);
  }, [status, connected, opponentOnline]);

  const moves = useMemo(() => {
    if (!room) return [];
    return pendingMove && pendingMove.version === room.version
      ? [...room.moves, pendingMove.move]
      : room.moves;
  }, [room, pendingMove]);

  const game = useMemo(() => buildGame(moves), [moves]);
  const board = useMemo(() => getBoard(game), [game]);
  const turn = game.turn();
  const lastMove = moves[moves.length - 1];
  const waitingForServer =
    pendingMove !== null && room !== null && pendingMove.version === room.version;
  const myTurn =
    isPlayer && status === "playing" && turn === role && !waitingForServer;

  const targets = useMemo(() => {
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    if (selected && myTurn) {
      for (const move of getLegalMoves(game, selected)) map.set(move.to, move);
    }
    return map;
  }, [game, selected, myTurn]);

  // Өрсөлдөгч нүүсний дараа хуучин сонголтыг арилгана.
  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [room?.version]);

  async function runAction(action: RoomAction) {
    setActionError(null);
    try {
      const updated = await sendChessAction(roomId, action);
      applyRoom(updated.room);
      return true;
    } catch (error) {
      setActionError(ROOM_ERROR_MESSAGE[errorCode(error)]);
      void refresh();
      return false;
    }
  }

  async function commitMove(move: MoveInput) {
    if (!room) return;
    setSelected(null);
    setPendingPromotion(null);
    setPendingMove({ move, version: room.version });
    await runAction({ type: "move", move });
    setPendingMove((current) => (current?.move === move ? null : current));
  }

  function handleSquareClick(square: Square) {
    if (!myTurn || pendingPromotion) return;

    const target = selected ? targets.get(square) : undefined;
    if (selected && target) {
      if (target.isPromotion) {
        setPendingPromotion({ from: selected, to: square });
      } else {
        void commitMove({ from: selected, to: square });
      }
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === role && square !== selected) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  async function handleButtonAction(action: RoomAction) {
    setBusy(true);
    await runAction(action);
    setBusy(false);
    setConfirmResign(false);
  }

  if (loadError) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-6 text-center">
        <p role="alert" className="text-white/90">
          {ROOM_ERROR_MESSAGE[loadError]}
        </p>
        {loadError !== "not_found" && (
          <button
            type="button"
            onClick={() => setJoinAttempt((count) => count + 1)}
            className={PRIMARY_BUTTON}
          >
            Дахин оролдох
          </button>
        )}
        <Link
          href="/games/chess"
          className="text-sm font-medium text-mongol-gold-light underline underline-offset-4"
        >
          Шатар руу буцах
        </Link>
      </div>
    );
  }

  if (!room || !role) {
    return (
      <p className="animate-pulse py-16 text-center text-white/70">
        Өрөөнд холбогдож байна...
      </p>
    );
  }

  if (room.status === "waiting" && isPlayer) {
    return <WaitingRoom room={room} color={role} />;
  }

  const flipped = role === "b";
  const checkedKing = getCheckedKingSquare(game);

  if (room.status === "finished") {
    const text = describeRoomResult(room, role);
    return (
      <div className="flex w-full flex-col items-center gap-8">
        <ResultShareCard
          game="Шатар"
          result={text.result}
          subtitle={text.subtitle}
          onPlayAgain={() => router.push("/games/chess")}
        />

        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
            Эцсийн байрлал
          </p>
          <Board
            board={board}
            flipped={flipped}
            lastMove={lastMove}
            checkedKing={checkedKing}
          />
        </div>
      </div>
    );
  }

  const turnLabel = !isPlayer
    ? `${COLOR_LABEL[turn]}-ын ээлж`
    : turn === role
      ? "Таны ээлж"
      : "Өрсөлдөгчийн ээлж";
  const drawOfferedToMe = isPlayer && room.draw_offer_by === opposite(role);
  const drawOfferedByMe = isPlayer && room.draw_offer_by === role;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        className="flex min-h-[4.5rem] flex-col items-center text-center"
        aria-live="polite"
      >
        <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
          {turnLabel}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <ColorDot color={turn} />
          {game.isCheck() && (
            <span className="rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
              Шаг!
            </span>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
          {isPlayer ? (
            <>
              Та: <span className="text-white/80">{COLOR_LABEL[role]}</span>
            </>
          ) : (
            "👀 Та үзэгчээр орсон байна"
          )}
        </p>
      </div>

      {showOffline && (
        <Notice tone="warn">Холболт тасарлаа. Дахин холбогдож байна...</Notice>
      )}
      {isPlayer && connected && opponent === "away" && (
        <Notice tone="warn">
          Өрсөлдөгч гарсан. Буцаж ирэхийг хүлээж байна...
        </Notice>
      )}
      {isPlayer && connected && opponent === "back" && (
        <Notice tone="ok">Өрсөлдөгч буцаж ирлээ</Notice>
      )}

      {drawOfferedToMe && (
        <Notice tone="info">
          <p className="font-semibold">Өрсөлдөгч тэнцээ санал болгож байна</p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleButtonAction({ type: "accept_draw" })}
              className={PRIMARY_BUTTON}
            >
              Зөвшөөрөх
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleButtonAction({ type: "decline_draw" })}
              className={SECONDARY_BUTTON}
            >
              Татгалзах
            </button>
          </div>
        </Notice>
      )}
      {drawOfferedByMe && (
        <Notice tone="info">
          Тэнцээний санал илгээлээ. Хариу хүлээж байна...
        </Notice>
      )}

      {actionError && (
        <p role="alert" className="text-center text-sm text-red-300">
          {actionError}
        </p>
      )}

      <div className="relative w-full">
        <Board
          board={board}
          flipped={flipped}
          selected={selected}
          targets={targets}
          lastMove={lastMove}
          checkedKing={checkedKing}
          onSquareClick={isPlayer ? handleSquareClick : undefined}
        />

        {pendingPromotion && isPlayer && (
          <PromotionDialog
            color={role}
            onChoose={(type) =>
              void commitMove({ ...pendingPromotion, promotion: type })
            }
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>

      {isPlayer &&
        (confirmResign ? (
          <Notice tone="warn">
            <p className="font-semibold">Та үнэхээр бууж өгөх үү?</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleButtonAction({ type: "resign" })}
                className="rounded-full bg-red-500 px-6 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
              >
                Тийм, бууж өгнө
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmResign(false)}
                className={SECONDARY_BUTTON}
              >
                Үгүй
              </button>
            </div>
          </Notice>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={busy || drawOfferedByMe || drawOfferedToMe}
              onClick={() => handleButtonAction({ type: "offer_draw" })}
              className={SECONDARY_BUTTON}
            >
              🤝 Тэнцээ санал болгох
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmResign(true)}
              className={SECONDARY_BUTTON}
            >
              🏳️ Бууж өгөх
            </button>
          </div>
        ))}

      <p className="text-xs text-white/40">Өрөөний код: {room.id}</p>
    </div>
  );
}
