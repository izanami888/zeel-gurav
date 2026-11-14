import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

// Шатрын дүрмийг бүхэлд нь chess.js шийднэ. Энэ файл зөвхөн UI-д
// хэрэгтэй хэлбэрт оруулж өгдөг нимгэн давхарга юм.

export type { Color, PieceSymbol, Square };

export type PromotionPiece = "q" | "r" | "b" | "n";

/** Нэг нүүдэл: хаанаас, хаашаа, (хүү дэвшвэл) ямар дүрс болох. */
export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface BoardSquare {
  square: Square;
  piece: { type: PieceSymbol; color: Color } | null;
  isDark: boolean;
}

export type GameResult =
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | { kind: "insufficient" }
  | { kind: "repetition" }
  | { kind: "fifty" }
  | { kind: "draw" };

export const COLOR_LABEL: Record<Color, string> = {
  w: "Цагаан",
  b: "Хар",
};

export const PIECE_LABEL: Record<PieceSymbol, string> = {
  k: "Ноён",
  q: "Бэрс",
  r: "Тэрэг",
  b: "Тэмээ",
  n: "Морь",
  p: "Хүү",
};

export const PROMOTION_PIECES: PromotionPiece[] = ["q", "r", "b", "n"];

/** Нүүдлийн түүхээс тоглоомын төлөвийг сэргээнэ. */
export function buildGame(moves: MoveInput[]): Chess {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game;
}

/** Самбарыг дээрээс доош (8-р эгнээнээс 1-р эгнээ) 64 нүд болгон буцаана. */
export function getBoard(game: Chess): BoardSquare[] {
  return game.board().flatMap((row, rowIndex) =>
    row.map((cell, colIndex) => {
      const square = `${"abcdefgh"[colIndex]}${8 - rowIndex}` as Square;
      return {
        square,
        piece: cell ? { type: cell.type, color: cell.color } : null,
        isDark: (rowIndex + colIndex) % 2 === 1,
      };
    })
  );
}

/** Тухайн нүдэн дээрх дүрсийн хууль ёсны нүүдлүүд. */
export function getLegalMoves(game: Chess, from: Square) {
  return game.moves({ square: from, verbose: true }).map((move) => ({
    to: move.to,
    isCapture: move.isCapture() || move.isEnPassant(),
    isPromotion: move.isPromotion(),
  }));
}

/** Шагт орсон ноёны нүд (шаг байхгүй бол null). */
export function getCheckedKingSquare(game: Chess): Square | null {
  if (!game.isCheck()) return null;
  return game.findPiece({ type: "k", color: game.turn() })[0] ?? null;
}

export function getResult(game: Chess): GameResult | null {
  if (game.isCheckmate()) {
    // Мат болсон үед ээлж нь ялагдсан талд байдаг.
    return { kind: "checkmate", winner: game.turn() === "w" ? "b" : "w" };
  }
  if (game.isStalemate()) return { kind: "stalemate" };
  if (game.isInsufficientMaterial()) return { kind: "insufficient" };
  if (game.isThreefoldRepetition()) return { kind: "repetition" };
  if (game.isDrawByFiftyMoves()) return { kind: "fifty" };
  if (game.isDraw()) return { kind: "draw" };
  return null;
}

/** Үр дүнгийн дэлгэц болон хуваалцах зурагт гарах текст. */
export function describeResult(result: GameResult): {
  result: string;
  subtitle?: string;
} {
  switch (result.kind) {
    case "checkmate":
      return { result: `${COLOR_LABEL[result.winner]} яллаа!`, subtitle: "Мат" };
    case "stalemate":
      return { result: "Тэнцлээ!", subtitle: "Пат" };
    case "insufficient":
      return { result: "Тэнцлээ!", subtitle: "Мат тавих хүч хүрэлцэхгүй" };
    case "repetition":
      return { result: "Тэнцлээ!", subtitle: "Байрлал гурван удаа давтагдлаа" };
    case "fifty":
      return { result: "Тэнцлээ!", subtitle: "50 нүүдлийн дүрэм" };
    default:
      return { result: "Тэнцлээ!" };
  }
}
