import "server-only";
import { createHash, randomInt } from "crypto";
import { Chess } from "chess.js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  applyAction,
  type ChessRoom,
  type ColorChoice,
  type Role,
  type RoomAction,
  type RoomErrorCode,
  type RoomPatch,
} from "@/games/chess/online";

// `chess_rooms` хүснэгттэй ажиллах сервер талын код. Бүх бичилт энд,
// service_role түлхүүрээр хийгдэнэ — хөтөч хүснэгт рүү шууд бичиж чадахгүй
// (supabase/migrations/0002_chess_rooms.sql дахь RLS-ийг үзнэ үү).

const TABLE = "chess_rooms";
// Андуурагдах тэмдэгтгүй (0/O, 1/I/L) цагаан толгой.
const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 6;
const MAX_RETRIES = 3;

export type RoomOutcome =
  | { ok: true; room: ChessRoom; role: Role }
  | { ok: false; error: RoomErrorCode };

export function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{16,64}$/.test(value);
}

export function normalizeRoomId(value: string): string | null {
  const id = value.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(id) ? id : null;
}

/**
 * Тоглогчийн нууц ID-г хүснэгтэд шууд хадгалахгүй, зөвхөн hash-ийг нь
 * хадгална. Ингэснээр хүснэгтийг уншсан хүн бусдын ID-г мэдэж чадахгүй.
 */
function hashPlayerId(playerId: string): string {
  return createHash("sha256").update(playerId).digest("hex");
}

function roleOf(room: ChessRoom, playerHash: string): Role {
  if (room.white_player_hash === playerHash) return "w";
  if (room.black_player_hash === playerHash) return "b";
  return "spectator";
}

function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  }
  return id;
}

async function readRoom(id: string): Promise<ChessRoom | null | "error"> {
  const admin = getSupabaseAdmin();
  if (!admin) return "error";
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return "error";
  return (data as ChessRoom | null) ?? null;
}

/** version таарсан үед л шинэчилнэ (зэрэг ирсэн хоёр хүсэлтээс хамгаална). */
async function writeRoom(
  room: ChessRoom,
  patch: RoomPatch & Partial<Pick<ChessRoom, "white_player_hash" | "black_player_hash">>
): Promise<ChessRoom | null | "error"> {
  const admin = getSupabaseAdmin();
  if (!admin) return "error";
  const { data, error } = await admin
    .from(TABLE)
    .update({
      ...patch,
      version: room.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", room.id)
    .eq("version", room.version)
    .select("*")
    .maybeSingle();
  if (error) return "error";
  return (data as ChessRoom | null) ?? null;
}

export async function createRoom(
  playerId: string,
  colorChoice: ColorChoice
): Promise<RoomOutcome> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "not_configured" };

  const color =
    colorChoice === "random" ? (randomInt(2) === 0 ? "w" : "b") : colorChoice;
  const playerHash = hashPlayerId(playerId);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await admin
      .from(TABLE)
      .insert({
        id: generateRoomId(),
        fen: new Chess().fen(),
        moves: [],
        status: "waiting",
        white_player_hash: color === "w" ? playerHash : null,
        black_player_hash: color === "b" ? playerHash : null,
      })
      .select("*")
      .single();

    if (!error && data) {
      return { ok: true, room: data as ChessRoom, role: color };
    }
    // 23505 = ижил кодтой өрөө аль хэдийн байна → өөр код туршина.
    if (error?.code !== "23505") break;
  }
  return { ok: false, error: "server_error" };
}

/**
 * Өрөөнд орно. Өмнө нь суусан тоглогч бол хуучин өнгөөрөө буцаж орно,
 * сул суудал байвал сууна, үгүй бол үзэгч болно.
 */
export async function joinRoom(id: string, playerId: string): Promise<RoomOutcome> {
  const playerHash = hashPlayerId(playerId);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const room = await readRoom(id);
    if (room === "error") return { ok: false, error: "server_error" };
    if (!room) return { ok: false, error: "not_found" };

    const role = roleOf(room, playerHash);
    if (role !== "spectator" || room.status !== "waiting") {
      return { ok: true, room, role };
    }

    const seat = room.white_player_hash === null ? "w" : "b";
    const updated = await writeRoom(room, {
      [seat === "w" ? "white_player_hash" : "black_player_hash"]: playerHash,
      status: "playing",
    });
    if (updated === "error") return { ok: false, error: "server_error" };
    if (updated) return { ok: true, room: updated, role: seat };
    // Өөр хүн яг зэрэг орсон — дахин уншиж шалгана.
  }
  return { ok: false, error: "conflict" };
}

export async function actOnRoom(
  id: string,
  playerId: string,
  action: RoomAction
): Promise<RoomOutcome> {
  const playerHash = hashPlayerId(playerId);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const room = await readRoom(id);
    if (room === "error") return { ok: false, error: "server_error" };
    if (!room) return { ok: false, error: "not_found" };

    const role = roleOf(room, playerHash);
    if (role === "spectator") return { ok: false, error: "not_player" };

    const outcome = applyAction(room, role, action);
    if (!outcome.ok) return outcome;

    const updated = await writeRoom(room, outcome.patch);
    if (updated === "error") return { ok: false, error: "server_error" };
    if (updated) return { ok: true, room: updated, role };
  }
  return { ok: false, error: "conflict" };
}
