"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLOR_LABEL,
  PIECE_LABEL,
  PROMOTION_PIECES,
  buildGame,
  describeResult,
  getBoard,
  getCheckedKingSquare,
  getLegalMoves,
  getResult,
  type BoardSquare,
  type Color,
  type MoveInput,
  type PieceSymbol,
  type PromotionPiece,
  type Square,
} from "@/games/chess/logic";
import {
  ChessEngine,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  type Difficulty,
} from "@/games/chess/engine";
import ResultShareCard from "@/components/ResultShareCard";

// Хоёр талд ижил (дүүргэсэн) дүрс ашиглаж, өнгөөр нь ялгана.
// U+FE0E нь утсан дээр emoji болж хувирахаас сэргийлнэ.
const PIECE_GLYPH: Record<PieceSymbol, string> = {
  k: "♚︎",
  q: "♛︎",
  r: "♜︎",
  b: "♝︎",
  n: "♞︎",
  p: "♟︎",
};

const OUTLINE_DARK =
  "0 1px 0 #0B1F3A, 0 -1px 0 #0B1F3A, 1px 0 0 #0B1F3A, -1px 0 0 #0B1F3A, 0 2px 3px rgba(0,0,0,0.45)";
const OUTLINE_LIGHT =
  "0 1px 0 #F1D57A, 0 -1px 0 #F1D57A, 1px 0 0 #F1D57A, -1px 0 0 #F1D57A";

function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none relative select-none leading-none"
      style={{
        fontFamily:
          '"Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", sans-serif',
        color: color === "w" ? "#FFFFFF" : "#0A1526",
        textShadow: color === "w" ? OUTLINE_DARK : OUTLINE_LIGHT,
      }}
    >
      {PIECE_GLYPH[type]}
    </span>
  );
}

interface BoardProps {
  board: BoardSquare[];
  flipped?: boolean;
  selected?: Square | null;
  targets?: Map<Square, { isCapture: boolean }>;
  lastMove?: MoveInput;
  checkedKing?: Square | null;
  onSquareClick?: (square: Square) => void;
}

function Board({
  board,
  flipped = false,
  selected,
  targets,
  lastMove,
  checkedKing,
  onSquareClick,
}: BoardProps) {
  const squares = flipped ? [...board].reverse() : board;

  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border-2 border-mongol-gold/60 text-[min(9.5vw,3rem)] shadow-lg shadow-black/30">
      {squares.map(({ square, piece, isDark }, index) => {
        const target = targets?.get(square);
        const isSelected = selected === square;
        const isLast = lastMove?.from === square || lastMove?.to === square;
        const isChecked = checkedKing === square;
        const file = square[0];
        const rank = square[1];

        const label = piece
          ? `${square}, ${COLOR_LABEL[piece.color]} ${PIECE_LABEL[piece.type]}`
          : square;

        return (
          <button
            key={square}
            type="button"
            onClick={() => onSquareClick?.(square)}
            disabled={!onSquareClick}
            aria-label={label}
            aria-pressed={isSelected}
            className={`relative flex aspect-square touch-manipulation items-center justify-center ${
              isDark ? "bg-[#3E689F]" : "bg-[#EADFB8]"
            }`}
          >
            {isLast && <span className="absolute inset-0 bg-mongol-gold/70" />}
            {isChecked && (
              <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.95)_25%,rgba(239,68,68,0.35)_75%)]" />
            )}
            {isSelected && (
              <span className="absolute inset-0 bg-mongol-gold ring-2 ring-inset ring-white/80" />
            )}

            {index % 8 === 0 && (
              <span
                className={`absolute left-0.5 top-0.5 text-[9px] font-semibold leading-none ${
                  isDark ? "text-white/70" : "text-mongol-blue/60"
                }`}
              >
                {rank}
              </span>
            )}
            {index >= 56 && (
              <span
                className={`absolute bottom-0.5 right-0.5 text-[9px] font-semibold leading-none ${
                  isDark ? "text-white/70" : "text-mongol-blue/60"
                }`}
              >
                {file}
              </span>
            )}

            {piece && <Piece type={piece.type} color={piece.color} />}

            {target &&
              (target.isCapture ? (
                <span className="absolute inset-[6%] rounded-full border-4 border-emerald-500/80" />
              ) : (
                <span className="absolute h-[30%] w-[30%] rounded-full bg-emerald-500/70" />
              ))}
          </button>
        );
      })}
    </div>
  );
}

type GameSettings =
  | { mode: "local" }
  | { mode: "computer"; difficulty: Difficulty; playerColor: Color };

function ColorDot({ color }: { color: Color }) {
  return (
    <span
      className={`inline-block h-5 w-5 shrink-0 rounded-full border-2 ${
        color === "w"
          ? "border-mongol-gold bg-white"
          : "border-mongol-gold-light bg-[#0A1526]"
      }`}
    />
  );
}

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

function optionClass(active: boolean) {
  return `flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition active:scale-95 ${
    active
      ? "border-mongol-gold bg-mongol-gold text-mongol-blue"
      : "border-mongol-gold/30 bg-mongol-blue-light/50 text-white"
  }`;
}

function SetupScreen({ onStart }: { onStart: (settings: GameSettings) => void }) {
  const [mode, setMode] = useState<GameSettings["mode"]>("local");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<Color>("w");

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

      {mode === "computer" && <StockfishCredit />}
    </div>
  );
}

export default function ChessGame() {
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
    return <SetupScreen onStart={setSettings} />;
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Хүүг дэвшүүлэх"
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-mongol-blue/80 p-3 backdrop-blur-sm"
          >
            <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-mongol-gold/40 bg-mongol-blue-light p-4">
              <p className="text-base font-semibold text-white">
                Хүүгээ ямар дүрс болгох вэ?
              </p>
              <div className="grid w-full grid-cols-4 gap-2 text-[2.5rem]">
                {PROMOTION_PIECES.map((type: PromotionPiece) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      commitMove({ ...pendingPromotion, promotion: type })
                    }
                    className="flex flex-col items-center gap-1 rounded-xl border border-mongol-gold/30 bg-[#3E689F] px-1 pb-2 pt-3 transition active:scale-95"
                  >
                    <Piece type={type} color={turn} />
                    <span className="text-xs font-medium text-white">
                      {PIECE_LABEL[type]}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="text-sm font-medium text-white/60 underline underline-offset-4"
              >
                Болих
              </button>
            </div>
          </div>
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
