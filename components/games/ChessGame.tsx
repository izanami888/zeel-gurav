"use client";

import { useMemo, useState } from "react";
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
  selected?: Square | null;
  targets?: Map<Square, { isCapture: boolean }>;
  lastMove?: MoveInput;
  checkedKing?: Square | null;
  onSquareClick?: (square: Square) => void;
}

function Board({
  board,
  selected,
  targets,
  lastMove,
  checkedKing,
  onSquareClick,
}: BoardProps) {
  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border-2 border-mongol-gold/60 text-[min(9.5vw,3rem)] shadow-lg shadow-black/30">
      {board.map(({ square, piece, isDark }) => {
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

            {file === "a" && (
              <span
                className={`absolute left-0.5 top-0.5 text-[9px] font-semibold leading-none ${
                  isDark ? "text-white/70" : "text-mongol-blue/60"
                }`}
              >
                {rank}
              </span>
            )}
            {rank === "1" && (
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

export default function ChessGame() {
  const [moves, setMoves] = useState<MoveInput[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const game = useMemo(() => buildGame(moves), [moves]);
  const board = useMemo(() => getBoard(game), [game]);
  const result = getResult(game);
  const turn = game.turn();
  const lastMove = moves[moves.length - 1];

  const targets = useMemo(() => {
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    if (selected) {
      for (const move of getLegalMoves(game, selected)) map.set(move.to, move);
    }
    return map;
  }, [game, selected]);

  function commitMove(move: MoveInput) {
    setMoves((prev) => [...prev, move]);
    setSelected(null);
    setPendingPromotion(null);
  }

  function handleSquareClick(square: Square) {
    if (pendingPromotion) return;

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

  function handleUndo() {
    setMoves((prev) => prev.slice(0, -1));
    setSelected(null);
    setPendingPromotion(null);
  }

  function handleReset() {
    setMoves([]);
    setSelected(null);
    setPendingPromotion(null);
  }

  if (result) {
    const text = describeResult(result);
    return (
      <div className="flex w-full flex-col items-center gap-8">
        <ResultShareCard
          game="Шатар"
          result={text.result}
          subtitle={text.subtitle}
          onPlayAgain={handleReset}
        />

        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
            Эцсийн байрлал
          </p>
          <Board
            board={board}
            lastMove={lastMove}
            checkedKing={getCheckedKingSquare(game)}
          />
        </div>
      </div>
    );
  }

  const inCheck = game.isCheck();

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex min-h-[4.5rem] flex-col items-center text-center" aria-live="polite">
        <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
          {COLOR_LABEL[turn]}-ын ээлж
        </p>
        <div className="mt-1 flex items-center gap-3">
          <span
            className={`h-6 w-6 rounded-full border-2 ${
              turn === "w"
                ? "border-mongol-gold bg-white"
                : "border-mongol-gold-light bg-[#0A1526]"
            }`}
          />
          {inCheck && (
            <span className="rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
              Шаг!
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full">
        <Board
          board={board}
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

      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={handleUndo}
          disabled={moves.length === 0}
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
      </div>
    </div>
  );
}
