"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COLOR_LABEL,
  buildGame,
  describeResult,
  getBoard,
  getCheckedKingSquare,
  getLegalMoves,
  getResult,
  type Color,
  type MoveInput,
  type Square,
} from "@/games/chess/logic";
import {
  ChessEngine,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  type Difficulty,
} from "@/games/chess/engine";
import {
  Board,
  ColorDot,
  PromotionDialog,
  optionClass,
} from "@/components/games/chess/ChessBoard";
import { ROOM_ERROR_MESSAGE, type ColorChoice } from "@/games/chess/online";
import { RoomError, createChessRoom } from "@/lib/realtime";
import ResultShareCard from "@/components/ResultShareCard";

type GameSettings =
  | { mode: "local" }
  | { mode: "computer"; difficulty: Difficulty; playerColor: Color };

function StockfishCredit() {
  return (
    <p className="text-center text-xs leading-relaxed text-white/40">
      Компьютерийн нүүдлийг{" "}
      <a
        href="https://stockfishchess.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        Stockfish
      </a>{" "}
      хөдөлгүүр бодно (
      <a
        href="/stockfish/COPYING.txt"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        GPLv3 лиценз
      </a>
      ,{" "}
      <a
        href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        эх код
      </a>
      ).
    </p>
  );
}

function SetupScreen({
  onStart,
  onlineEnabled,
}: {
  onStart: (settings: GameSettings) => void;
  onlineEnabled: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"local" | "computer" | "online">("local");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<Color>("w");
  const [onlineColor, setOnlineColor] = useState<ColorChoice>("random");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setCreating(true);
    setCreateError(null);
    try {
      const { room } = await createChessRoom(onlineColor);
      router.push(`/games/chess/room/${room.id}`);
    } catch (error) {
      const code = error instanceof RoomError ? error.code : "server_error";
      setCreateError(ROOM_ERROR_MESSAGE[code]);
      setCreating(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 p-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm uppercase tracking-widest text-mongol-gold-light/80">
          Тоглох горим
        </legend>
        <button
          type="button"
          aria-pressed={mode === "local"}
          onClick={() => setMode("local")}
          className={optionClass(mode === "local")}
        >
          👥 2 тоглогч (нэг төхөөрөмж дээр)
        </button>
        <button
          type="button"
          aria-pressed={mode === "computer"}
          onClick={() => setMode("computer")}
          className={optionClass(mode === "computer")}
        >
          🤖 Компьютертэй тоглох
        </button>
        {onlineEnabled && (
          <button
            type="button"
            aria-pressed={mode === "online"}
            onClick={() => setMode("online")}
            className={optionClass(mode === "online")}
          >
            🌐 Онлайн тоглох
          </button>
        )}
      </fieldset>

      {mode === "computer" && (
        <>
          <fieldset>
            <legend className="mb-3 text-sm uppercase tracking-widest text-mongol-gold-light/80">
              Түвшин
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={difficulty === level}
                  onClick={() => setDifficulty(level)}
                  className={optionClass(difficulty === level)}
                >
                  {DIFFICULTY_LABEL[level]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm uppercase tracking-widest text-mongol-gold-light/80">
              Таны өнгө
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(["w", "b"] as Color[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-pressed={playerColor === color}
                  onClick={() => setPlayerColor(color)}
                  className={optionClass(playerColor === color)}
                >
                  <ColorDot color={color} />
                  {COLOR_LABEL[color]}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {mode === "online" && (
        <fieldset>
          <legend className="mb-3 text-sm uppercase tracking-widest text-mongol-gold-light/80">
            Таны өнгө
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {(["w", "b", "random"] as ColorChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={onlineColor === choice}
                onClick={() => setOnlineColor(choice)}
                className={optionClass(onlineColor === choice)}
              >
                {choice === "random" ? (
                  "🎲 Санамсаргүй"
                ) : (
                  <>
                    <ColorDot color={choice} />
                    {COLOR_LABEL[choice]}
                  </>
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/50">
            Өрөө үүсгээд холбоос эсвэл QR кодоо найздаа илгээнэ. Найз тань
            ормогц тоглоом эхэлнэ.
          </p>
        </fieldset>
      )}

      {createError && (
        <p role="alert" className="text-center text-sm text-red-300">
          {createError}
        </p>
      )}

      {mode === "online" ? (
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={creating}
          className="rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 text-base font-semibold text-mongol-blue transition active:scale-95 disabled:opacity-60"
        >
          {creating ? "Өрөө үүсгэж байна..." : "Өрөө үүсгэх"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            onStart(
              mode === "local"
                ? { mode: "local" }
                : { mode: "computer", difficulty, playerColor }
            )
          }
          className="rounded-full bg-gradient-to-r from-mongol-gold to-mongol-gold-light px-6 py-3 text-base font-semibold text-mongol-blue transition active:scale-95"
        >
          Эхлэх
        </button>
      )}

      {mode === "computer" && <StockfishCredit />}
    </div>
  );
}

export default function ChessGame({
  onlineEnabled = false,
}: {
  onlineEnabled?: boolean;
}) {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [moves, setMoves] = useState<MoveInput[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const engineRef = useRef<ChessEngine | null>(null);

  const game = useMemo(() => buildGame(moves), [moves]);
  const board = useMemo(() => getBoard(game), [game]);
  const result = getResult(game);
  const turn = game.turn();
  const lastMove = moves[moves.length - 1];

  const vsComputer = settings?.mode === "computer";
  const playerColor = settings?.mode === "computer" ? settings.playerColor : null;
  const difficulty = settings?.mode === "computer" ? settings.difficulty : null;
  const computerTurn = vsComputer && turn !== playerColor && !result;
  const flipped = playerColor === "b";

  // Хуудаснаас гарахад хөдөлгүүрийн worker-ийг унтраана.
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Компьютерийн ээлж ирэхэд Stockfish-аас нүүдэл асууна.
  useEffect(() => {
    if (!computerTurn || !difficulty) return;

    let cancelled = false;
    let searching = false;

    // Нүүдэл хэт гэнэт гарахаас сэргийлж бага зэрэг хүлээнэ.
    const timer = setTimeout(() => {
      if (!engineRef.current) engineRef.current = new ChessEngine();
      const engine = engineRef.current;
      searching = true;
      engine
        .findMove(moves, difficulty)
        .then((move) => {
          searching = false;
          if (cancelled || !move) return;
          setMoves((prev) => (prev === moves ? [...prev, move] : prev));
        })
        .catch(() => {
          searching = false;
          if (cancelled) return;
          engine.dispose();
          if (engineRef.current === engine) engineRef.current = null;
          setEngineError(true);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (searching) engineRef.current?.stop();
    };
  }, [computerTurn, difficulty, moves, retryCount]);

  const targets = useMemo(() => {
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    if (selected) {
      for (const move of getLegalMoves(game, selected)) map.set(move.to, move);
    }
    return map;
  }, [game, selected]);

  function clearSelection() {
    setSelected(null);
    setPendingPromotion(null);
  }

  function commitMove(move: MoveInput) {
    setMoves((prev) => [...prev, move]);
    clearSelection();
  }

  function handleSquareClick(square: Square) {
    if (pendingPromotion || computerTurn) return;

    const target = selected ? targets.get(square) : undefined;
    if (selected && target) {
      if (target.isPromotion) {
        setPendingPromotion({ from: selected, to: square });
      } else {
        commitMove({ from: selected, to: square });
      }
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === turn && square !== selected) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  // Компьютертэй тоглож байхад тоглогчийн сүүлийн нүүдэл хүртэл буцаана.
  const playerMovesFirst = playerColor !== "b";
  const undoCount = !vsComputer ? 1 : computerTurn ? 1 : 2;
  const canUndo = vsComputer
    ? moves.length >= (playerMovesFirst ? 1 : 2)
    : moves.length > 0;

  function handleUndo() {
    setMoves((prev) => prev.slice(0, Math.max(0, prev.length - undoCount)));
    setEngineError(false);
    clearSelection();
  }

  function handleReset() {
    setMoves([]);
    setEngineError(false);
    clearSelection();
  }

  function handleChangeMode() {
    handleReset();
    setSettings(null);
  }

  if (!settings) {
    return <SetupScreen onStart={setSettings} onlineEnabled={onlineEnabled} />;
  }

  if (result) {
    const text = describeResult(result);
    const resultText =
      vsComputer && result.kind === "checkmate"
        ? result.winner === playerColor
          ? "Та яллаа!"
          : "Компьютер яллаа!"
        : text.result;
    const subtitle =
      vsComputer && difficulty
        ? [text.subtitle, `Компьютер: ${DIFFICULTY_LABEL[difficulty]}`]
            .filter(Boolean)
            .join(" · ")
        : text.subtitle;

    return (
      <div className="flex w-full flex-col items-center gap-8">
        <ResultShareCard
          game="Шатар"
          result={resultText}
          subtitle={subtitle}
          onPlayAgain={handleReset}
        />

        <button
          type="button"
          onClick={handleChangeMode}
          className="text-sm font-medium text-white/50 underline underline-offset-4"
        >
          Горим солих
        </button>

        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
            Эцсийн байрлал
          </p>
          <Board
            board={board}
            flipped={flipped}
            lastMove={lastMove}
            checkedKing={getCheckedKingSquare(game)}
          />
        </div>

        {vsComputer && <StockfishCredit />}
      </div>
    );
  }

  const inCheck = game.isCheck();
  const turnLabel = !vsComputer
    ? `${COLOR_LABEL[turn]}-ын ээлж`
    : computerTurn
      ? "Компьютерийн ээлж"
      : "Таны ээлж";

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        className="flex min-h-[4.5rem] flex-col items-center text-center"
        aria-live="polite"
      >
        <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
          {turnLabel}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <ColorDot color={turn} />
          {computerTurn && !engineError && (
            <span className="animate-pulse text-sm font-medium text-white/80">
              Бодож байна...
            </span>
          )}
          {inCheck && (
            <span className="rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
              Шаг!
            </span>
          )}
        </div>
      </div>

      {engineError && (
        <div
          role="alert"
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-center text-sm text-white/90"
        >
          <p>Компьютерийн хөдөлгүүрийг ачаалж чадсангүй. Интернэт холболтоо шалгана уу.</p>
          <button
            type="button"
            onClick={() => {
              setEngineError(false);
              setRetryCount((count) => count + 1);
            }}
            className="font-semibold text-mongol-gold-light underline underline-offset-4"
          >
            Дахин оролдох
          </button>
        </div>
      )}

      <div className="relative w-full">
        <Board
          board={board}
          flipped={flipped}
          selected={selected}
          targets={targets}
          lastMove={lastMove}
          checkedKing={getCheckedKingSquare(game)}
          onSquareClick={handleSquareClick}
        />

        {pendingPromotion && (
          <PromotionDialog
            color={turn}
            onChoose={(type) => commitMove({ ...pendingPromotion, promotion: type })}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/40 disabled:opacity-40"
        >
          ↶ Нүүдэл буцаах
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm font-medium text-white/50 underline underline-offset-4"
        >
          Дахин тоглох
        </button>
        <button
          type="button"
          onClick={handleChangeMode}
          className="text-sm font-medium text-white/50 underline underline-offset-4"
        >
          Горим солих
        </button>
      </div>

      {vsComputer && (
        <p className="text-xs text-white/50">
          Түвшин: {difficulty ? DIFFICULTY_LABEL[difficulty] : ""}
        </p>
      )}
      {vsComputer && <StockfishCredit />}
    </div>
  );
}
