import "server-only";
import { randomInt } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { generateRoomId, hashPlayerId } from "./chessRooms";
import { cleanName } from "@/games/chuluu/online";
import { SHAGAI_PER_ROLL, SIDES, type MoriSettings, type Side } from "@/games/mori/logic";
import {
  pendingSeat,
  planJoin,
  planRoll,
  planStart,
  seatOf,
  type MoriAction,
  type MoriErrorCode,
  type MoriRoom,
  type RoomPatch,
} from "@/games/mori/online";

// "Морь уралдуулах" онлайн өрөөний сервер талын код. Бүх бичилт энд,
// service_role түлхүүрээр хийгдэнэ — хөтөч хүснэгт рүү бичиж чадахгүй.
//
// Шагайг ЗӨВХӨН энд хаяна (`serverRoll`). Хөтөч "roll" гэсэн хүсэлт л
// илгээх бөгөөд үр дүнг нь өөрөө сонгох, урьдчилан мэдэх боломжгүй.

const ROOMS = "mori_rooms";
const SEEN = "mori_seen";
const MAX_RETRIES = 8;

/** Ийм удаан чимээгүй байсан тоглогчийг "холболт тасарсан" гэж үзнэ. */
export const OFFLINE_AFTER_MS = 30_000;
/** Холбогдсон ч ийм удаан хаяагүй бол сервер өмнөөс нь хаяж болно. */
export const IDLE_ROLL_AFTER_MS = 60_000;

export type MoriOutcome =
  | { ok: true; room: MoriRoom; seat: number | null }
  | { ok: false; error: MoriErrorCode };

type DbResult<T> = { data: T; failed: false } | { data: null; failed: true };

/** 4 шагайг сервер дээр хаяна. Тал бүр адил (25%) магадлалтай. */
function serverRoll(): Side[] {
  return Array.from(
    { length: SHAGAI_PER_ROLL },
    () => SIDES[randomInt(SIDES.length)]
  );
}

async function readRoom(id: string): Promise<DbResult<MoriRoom | null>> {
  const admin = getSupabaseAdmin();
  if (!admin) return { data: null, failed: true };
  const { data, error } = await admin.from(ROOMS).select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, failed: true };
  return { data: (data as MoriRoom | null) ?? null, failed: false };
}

/** version таарсан үед л шинэчилнэ; ээлж солигдвол цагийг шинэчилнэ. */
async function writeRoom(
  room: MoriRoom,
  patch: RoomPatch
): Promise<DbResult<MoriRoom | null>> {
  const admin = getSupabaseAdmin();
  if (!admin) return { data: null, failed: true };
  const now = new Date().toISOString();
  const turnChanged = "status" in patch || "roll_seq" in patch;
  const { data, error } = await admin
    .from(ROOMS)
    .update({
      ...patch,
      ...(turnChanged ? { turn_started_at: now } : {}),
      version: room.version + 1,
      updated_at: now,
    })
    .eq("id", room.id)
    .eq("version", room.version)
    .select("*")
    .maybeSingle();
  if (error) return { data: null, failed: true };
  return { data: (data as MoriRoom | null) ?? null, failed: false };
}

async function touchSeen(roomId: string, seats: number[]): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || seats.length === 0) return;
  const seenAt = new Date().toISOString();
  await admin.from(SEEN).upsert(
    seats.map((seat) => ({ room_id: roomId, seat, seen_at: seenAt })),
    { onConflict: "room_id,seat" }
  );
}

async function lastSeenMs(roomId: string, seat: number): Promise<number | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from(SEEN)
    .select("seen_at")
    .eq("room_id", roomId)
    .eq("seat", seat)
    .maybeSingle();
  return data ? new Date(data.seen_at as string).getTime() : null;
}

/**
 * Ээлжтэй тоглогчийн өмнөөс хаяж болох эсэх: тоглогч удаан чимээгүй
 * (холболт тасарсан), эсвэл ээлж хэт удсан үед л зөвшөөрнө.
 */
async function canAutoRoll(room: MoriRoom, target: number): Promise<boolean> {
  const now = Date.now();
  const seen = await lastSeenMs(room.id, target);
  if (seen === null || now - seen >= OFFLINE_AFTER_MS) return true;
  return now - new Date(room.turn_started_at).getTime() >= IDLE_ROLL_AFTER_MS;
}

export async function createMoriRoom(
  playerId: string,
  name: unknown,
  settings: MoriSettings
): Promise<MoriOutcome> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "not_configured" };

  const host = { name: cleanName(name, "Тоглогч 1"), hash: hashPlayerId(playerId) };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await admin
      .from(ROOMS)
      .insert({ id: generateRoomId(), settings, players: [host], status: "lobby" })
      .select("*")
      .single();
    if (!error && data) {
      const room = data as MoriRoom;
      await touchSeen(room.id, [0]);
      return { ok: true, room, seat: 0 };
    }
    // 23505 = ижил кодтой өрөө аль хэдийн байна → өөр код туршина.
    if (error?.code !== "23505") break;
  }
  return { ok: false, error: "server_error" };
}

export async function actOnMoriRoom(
  id: string,
  playerId: string,
  action: MoriAction
): Promise<MoriOutcome> {
  const hash = hashPlayerId(playerId);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const read = await readRoom(id);
    if (read.failed) return { ok: false, error: "server_error" };
    const room = read.data;
    if (!room) return { ok: false, error: "not_found" };

    const seat = seatOf(room, hash);
    let patch: RoomPatch | null = null;
    let joining = false;

    switch (action.type) {
      case "view":
      case "ping":
        break;

      case "join": {
        if (seat !== null) break; // аль хэдийн суусан (хуудсаа дахин ачаалсан)
        const plan = planJoin(room, {
          name: cleanName(action.name, `Тоглогч ${room.players.length + 1}`),
          hash,
        });
        if (!plan.ok) return plan;
        patch = plan.patch;
        joining = true;
        break;
      }

      case "start": {
        if (seat === null) return { ok: false, error: "not_player" };
        const plan = planStart(room, seat);
        if (!plan.ok) return plan;
        patch = plan.patch;
        break;
      }

      case "roll": {
        if (seat === null) return { ok: false, error: "not_player" };
        // Хөтчийн харсан төлөв хуучирсан (жишээ нь сервер өмнөөс нь аль
        // хэдийн хаясан) бол юу ч хийхгүй, шинэ төлөвийг л буцаана.
        if (action.seq !== room.roll_seq) break;
        // Ээлжийг planRoll шалгана; хаялтыг сервер өөрөө гаргана.
        const plan = planRoll(room, seat, serverRoll(), false);
        if (!plan.ok) return plan;
        patch = plan.patch;
        break;
      }

      case "nudge": {
        if (seat === null) return { ok: false, error: "not_player" };
        if (action.seq !== room.roll_seq) break;
        const target = pendingSeat(room);
        if (target === null || target === seat) {
          return { ok: false, error: "wrong_phase" };
        }
        if (!(await canAutoRoll(room, target))) {
          return { ok: false, error: "too_early" };
        }
        const plan = planRoll(room, target, serverRoll(), true);
        if (!plan.ok) return plan;
        patch = plan.patch;
        break;
      }
    }

    let current = room;
    if (patch) {
      const written = await writeRoom(room, patch);
      if (written.failed) return { ok: false, error: "server_error" };
      if (!written.data) {
        // Өөр хүсэлт түрүүлсэн — түр хүлээгээд дахин уншина.
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 80));
        continue;
      }
      current = written.data;
    }

    const currentSeat = joining ? current.players.length - 1 : seat;
    if (action.type === "start" && patch) {
      // Хүлээлгийн өрөөнд удаан суусан тоглогчдыг эхлэх мөчид "энд байна"
      // гэж тооцно — эс бөгөөс эхний ээлж нь шууд автоматаар хаягдана.
      await touchSeen(
        current.id,
        current.players.map((_, index) => index)
      );
    } else if (currentSeat !== null) {
      await touchSeen(current.id, [currentSeat]);
    }

    return { ok: true, room: current, seat: currentSeat };
  }
  return { ok: false, error: "conflict" };
}
