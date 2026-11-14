import {
  COLOR_LABEL,
  buildGame,
  describeResult,
  getResult,
  type Color,
  type MoveInput,
} from "./logic";

// Онлайн өрөөний төлөв ба дүрэм. Сервер (API route) болон клиент хоёулаа
// ашигладаг тул энд зөвхөн цэвэр логик байна (сүлжээ, өгөгдлийн сан байхгүй).

export type RoomStatus = "waiting" | "playing" | "finished";

export type RoomResult =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "repetition"
  | "fifty"
  | "draw"
  | "resign"
  | "agreement";

/** `chess_rooms` хүснэгтийн нэг мөр. */
export interface ChessRoom {
  id: string;
  fen: string;
  moves: MoveInput[];
  status: RoomStatus;
  result: RoomResult | null;
  winner: Color | null;
  draw_offer_by: Color | null;
  white_player_hash: string | null;
  black_player_hash: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type Role = Color | "spectator";

export type ColorChoice = Color | "random";

export type RoomAction =
  | { type: "move"; move: MoveInput }
  | { type: "resign" }
  | { type: "offer_draw" }
  | { type: "accept_draw" }
  | { type: "decline_draw" };

export type RoomErrorCode =
  | "not_configured"
  | "bad_request"
  | "not_found"
  | "not_player"
  | "not_playing"
  | "not_your_turn"
  | "illegal_move"
  | "no_draw_offer"
  | "conflict"
  | "network"
  | "server_error";

export const ROOM_ERROR_MESSAGE: Record<RoomErrorCode, string> = {
  not_configured: "Онлайн горим одоогоор ажиллахгүй байна.",
  bad_request: "Буруу хүсэлт илгээгдлээ.",
  not_found: "Ийм өрөө олдсонгүй.",
  not_player: "Та энэ өрөөнд тоглогч биш байна.",
  not_playing: "Тоглоом явагдаагүй байна.",
  not_your_turn: "Таны ээлж биш байна.",
  illegal_move: "Ийм нүүдэл хийх боломжгүй.",
  no_draw_offer: "Тэнцээний санал алга.",
  conflict: "Тоглоомын төлөв өөрчлөгдсөн байна. Дахин оролдоно уу.",
  network: "Сүлжээний алдаа гарлаа. Интернэт холболтоо шалгана уу.",
  server_error: "Серверийн алдаа гарлаа. Дахин оролдоно уу.",
};

export type RoomPatch = Partial<
  Pick<
    ChessRoom,
    "fen" | "moves" | "status" | "result" | "winner" | "draw_offer_by"
  >
>;

export type ActionOutcome =
  | { ok: true; patch: RoomPatch }
  | { ok: false; error: RoomErrorCode };

const SQUARE = /^[a-h][1-8]$/;
const PROMOTION = /^[qrbn]$/;

export function isRoomAction(value: unknown): value is RoomAction {
  if (!value || typeof value !== "object") return false;
  const action = value as { type?: unknown; move?: unknown };
  switch (action.type) {
    case "resign":
    case "offer_draw":
    case "accept_draw":
    case "decline_draw":
      return true;
    case "move": {
      const move = action.move as Partial<MoveInput> | undefined;
      return (
        !!move &&
        typeof move.from === "string" &&
        SQUARE.test(move.from) &&
        typeof move.to === "string" &&
        SQUARE.test(move.to) &&
        (move.promotion === undefined ||
          (typeof move.promotion === "string" && PROMOTION.test(move.promotion)))
      );
    }
    default:
      return false;
  }
}

export function opposite(color: Color): Color {
  return color === "w" ? "b" : "w";
}

/**
 * Тоглогчийн үйлдлийг шалгаж, өрөөний мөрөнд хийх өөрчлөлтийг буцаана.
 * Нүүдлийг chess.js-ээр шалгадаг: зөвхөн ээлжтэй тоглогчийн хууль ёсны
 * нүүдэл л зөвшөөрөгдөнө.
 */
export function applyAction(
  room: ChessRoom,
  color: Color,
  action: RoomAction
): ActionOutcome {
  if (room.status !== "playing") return { ok: false, error: "not_playing" };

  switch (action.type) {
    case "move": {
      const game = buildGame(room.moves);
      if (game.turn() !== color) return { ok: false, error: "not_your_turn" };

      let played;
      try {
        played = game.move(action.move);
      } catch {
        return { ok: false, error: "illegal_move" };
      }

      const move: MoveInput = { from: played.from, to: played.to };
      if (played.promotion) {
        move.promotion = played.promotion as MoveInput["promotion"];
      }

      const patch: RoomPatch = {
        moves: [...room.moves, move],
        fen: game.fen(),
        draw_offer_by: null,
      };
      const result = getResult(game);
      if (result) {
        patch.status = "finished";
        patch.result = result.kind;
        patch.winner = result.kind === "checkmate" ? result.winner : null;
      }
      return { ok: true, patch };
    }

    case "resign":
      return {
        ok: true,
        patch: {
          status: "finished",
          result: "resign",
          winner: opposite(color),
          draw_offer_by: null,
        },
      };

    case "offer_draw":
      // Өрсөлдөгч аль хэдийн санал болгосон бол зөвшөөрсөнд тооцно.
      if (room.draw_offer_by === opposite(color)) {
        return applyAction(room, color, { type: "accept_draw" });
      }
      return { ok: true, patch: { draw_offer_by: color } };

    case "accept_draw":
      if (room.draw_offer_by !== opposite(color)) {
        return { ok: false, error: "no_draw_offer" };
      }
      return {
        ok: true,
        patch: {
          status: "finished",
          result: "agreement",
          winner: null,
          draw_offer_by: null,
        },
      };

    case "decline_draw":
      if (room.draw_offer_by !== opposite(color)) {
        return { ok: false, error: "no_draw_offer" };
      }
      return { ok: true, patch: { draw_offer_by: null } };
  }
}

/** Үр дүнгийн дэлгэц болон хуваалцах зурагт гарах текст (онлайн горим). */
export function describeRoomResult(
  room: ChessRoom,
  role: Role
): { result: string; subtitle?: string } {
  const { result, winner } = room;
  const isPlayer = role !== "spectator";

  const winText = (color: Color) =>
    !isPlayer
      ? `${COLOR_LABEL[color]} яллаа!`
      : color === role
        ? "Та яллаа!"
        : "Та хожигдлоо";

  if (result === "resign" && winner) {
    const subtitle = !isPlayer
      ? `${COLOR_LABEL[opposite(winner)]} бууж өглөө`
      : winner === role
        ? "Өрсөлдөгч бууж өглөө"
        : "Та бууж өглөө";
    return { result: winText(winner), subtitle };
  }

  if (result === "checkmate" && winner) {
    return { result: winText(winner), subtitle: "Мат" };
  }

  if (result === "agreement") {
    return { result: "Тэнцлээ!", subtitle: "Харилцан тохиролцсон тэнцээ" };
  }

  if (result && result !== "resign" && result !== "checkmate") {
    return describeResult({ kind: result });
  }

  return { result: "Тоглоом дууслаа" };
}
