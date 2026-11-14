"use client";

import {
  COLOR_LABEL,
  PIECE_LABEL,
  PROMOTION_PIECES,
  type BoardSquare,
  type Color,
  type MoveInput,
  type PieceSymbol,
  type PromotionPiece,
  type Square,
} from "@/games/chess/logic";

// Шатрын бүх горимд (локал, компьютер, онлайн) дундаа ашиглах самбар
// болон жижиг UI хэсгүүд.

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

export function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
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

export function Board({
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

export function ColorDot({ color }: { color: Color }) {
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

export function optionClass(active: boolean) {
  return `flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition active:scale-95 ${
    active
      ? "border-mongol-gold bg-mongol-gold text-mongol-blue"
      : "border-mongol-gold/30 bg-mongol-blue-light/50 text-white"
  }`;
}

interface PromotionDialogProps {
  color: Color;
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/** Самбарын дээр гарч ирэх "хүүгээ ямар дүрс болгох вэ" цонх. */
export function PromotionDialog({ color, onChoose, onCancel }: PromotionDialogProps) {
  return (
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
              onClick={() => onChoose(type)}
              className="flex flex-col items-center gap-1 rounded-xl border border-mongol-gold/30 bg-[#3E689F] px-1 pb-2 pt-3 transition active:scale-95"
            >
              <Piece type={type} color={color} />
              <span className="text-xs font-medium text-white">
                {PIECE_LABEL[type]}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-white/60 underline underline-offset-4"
        >
          Болих
        </button>
      </div>
    </div>
  );
}
