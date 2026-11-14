import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { generateRoomId, hashPlayerId } from "./chessRooms";
import {
  cleanName,
  pendingSeats,
  planGuess,
  planHide,
  planJoin,
  planNext,
  planReveal,
  planStart,
  seatOf,
  type ChuluuAction,
  type ChuluuErrorCode,
  type ChuluuRoom,
  type RoomPatch,
} from "@/games/chuluu/online";
import type { ChuluuSettings } from "@/games/chuluu/logic";

// "Чулуу таалцах" онлайн өрөөний сервер талын код. Бүх бичилт энд,
// service_role түлхүүрээр хийгдэнэ.
//
// Нууцлал: атгасан чулууны тоо зөвхөн `chuluu_hands` хүснэгтэд байна.
// Тэр хүснэгтийг хөтөч унших боломжгүй (RLS, policy байхгүй). Эндээс
// хөтөч рүү буцах зүйл нь (1) нийтийн өрөөний мөр, (2) ЗӨВХӨН асуусан
// тоглогчийн өөрийнх нь гар. Бусдын гар сүүлчийн таамгийн дараа л
// `revealed` болж өрөөнд бичигдэнэ.

const ROOMS = "chuluu_rooms";
const HANDS = "chuluu_hands";
const SEEN = "chuluu_seen";
const MAX_RETRIES = 8;

/** Ийм удаан чимээгүй байсан тоглогчийг "холболт тасарсан" гэж үзнэ. */
export const OFFLINE_AFTER_MS = 40_000;
/** Холбогдсон ч ийм удаан үйлдэл хийгээгүй бол ээлжийг алгасаж болно. */
export const IDLE_SKIP_AFTER_MS = 120_000;

export type ChuluuOutcome =
  | { ok: true; room: ChuluuRoom; seat: number | null; myHand: number | null }
  | { ok: false; error: ChuluuErrorCode };

type DbResult<T> = { data: T; failed: false } | { data: null; failed: true };

async function readRoom(id: string): Promise<DbResult<ChuluuRoom | null>> {
  const admin = getSupabaseAdmin();
  if (!admin) return { data: null, failed: true };
  const { data, error } = await admin.from(ROOMS).select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, failed: true };
  return { data: (data as ChuluuRoom | null) ?? null, failed: false };
}

/** version таарсан үед л шинэчилнэ; ээлж/үе шат солигдвол цагийг шинэчилнэ. */
async function writeRoom(
  room: ChuluuRoom,
  patch: RoomPatch
): Promise<DbResult<ChuluuRoom | null>> {
  const admin = getSupabaseAdmin();
  if (!admin) return { data: null, failed: true };
  const now = new Date().toISOString();
  const turnChanged = "phase" in patch || "turn" in patch;
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
  return { data: (data as ChuluuRoom | null) ?? null, failed: false };
}

async function readHand(
  roomId: string,
  round: number,
  seat: number
): Promise<number | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from(HANDS)
    .select("stones")
    .eq("room_id", roomId)
    .eq("round", round)
    .eq("seat", seat)
    .maybeSingle();
  return data ? (data.stones as number) : null;
}

/**
 * Нууц гарыг хадгална. Нэг үед нэг суудал ганц л удаа атгана: аль хэдийн
 * өөр тоо хадгалагдсан бол false буцаана (дарж бичихгүй).
 */
async function saveHand(
  roomId: string,
  round: number,
  seat: number,
  stones: number
): Promise<"saved" | "different" | "error"> {
  const admin = getSupabaseAdmin();
  if (!admin) return "error";
  const { error } = await admin
    .from(HANDS)
    .insert({ room_id: roomId, round, seat, stones });
  if (!error) return "saved";
  if (error.code !== "23505") return "error";
  const existing = await readHand(roomId, round, seat);
  return existing === stones ? "saved" : "different";
}

async function readHands(
  roomId: string,
  round: number
): Promise<Map<number, number> | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from(HANDS)
    .select("seat, stones")
    .eq("room_id", roomId)
    .eq("round", round);
  if (error || !data) return null;
  return new Map(data.map((row) => [row.seat as number, row.stones as number]));
}

async function touchSeen(roomId: string, seat: number): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin
    .from(SEEN)
    .upsert(
      { room_id: roomId, seat, seen_at: new Date().toISOString() },
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

export async function createChuluuRoom(
  playerId: string,
  name: unknown,
  settings: ChuluuSettings
): Promise<ChuluuOutcome> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "not_configured" };

  const host = {
    name: cleanName(name, "Тоглогч 1"),
    stones: settings.startStones,
    hash: hashPlayerId(playerId),
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await admin
      .from(ROOMS)
      .insert({ id: generateRoomId(), settings, players: [host], status: "lobby" })
      .select("*")
      .single();
    if (!error && data) {
      const room = data as ChuluuRoom;
      await touchSeen(room.id, 0);
      return { ok: true, room, seat: 0, myHand: null };
    }
    if (error?.code !== "23505") break;
  }
  return { ok: false, error: "server_error" };
}

/** Алгасахыг зөвшөөрөх эсэх: тоглогч удаан чимээгүй, эсвэл ээлж хэт удсан. */
async function canSkip(room: ChuluuRoom, target: number): Promise<boolean> {
  const now = Date.now();
  const seen = await lastSeenMs(room.id, target);
  if (seen === null || now - seen >= OFFLINE_AFTER_MS) return true;
  return now - new Date(room.turn_started_at).getTime() >= IDLE_SKIP_AFTER_MS;
}

export async function actOnChuluuRoom(
  id: string,
  playerId: string,
  action: ChuluuAction
): Promise<ChuluuOutcome> {
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
        const plan = planJoin(room, hash, action.name);
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

      case "hide": {
        if (seat === null) return { ok: false, error: "not_player" };
        if (action.round !== room.round) return { ok: false, error: "stale" };
        const plan = planHide(room, seat, action.count);
        if (!plan.ok) return plan;
        // Эхлээд нууц хүснэгтэд, дараа нь өрөөнд "сонгосон" гэж тэмдэглэнэ.
        const saved = await saveHand(room.id, room.round, seat, action.count);
        if (saved === "error") return { ok: false, error: "server_error" };
        if (saved === "different") return { ok: false, error: "already_hidden" };
        patch = plan.patch;
        break;
      }

      case "guess":
      case "skip": {
        if (seat === null) return { ok: false, error: "not_player" };
        if (action.round !== room.round) return { ok: false, error: "stale" };

        let actor = seat;
        let value: number | null = null;
        if (action.type === "guess") {
          value = action.value;
        } else {
          if (action.seat === seat || !pendingSeats(room).includes(action.seat)) {
            return { ok: false, error: "wrong_phase" };
          }
          if (!(await canSkip(room, action.seat))) {
            return { ok: false, error: "too_early" };
          }
          actor = action.seat;

          if (room.phase === "hide") {
            // Холболт тасарсан тоглогч 0 чулуу атгасанд тооцогдоно.
            const plan = planHide(room, actor, 0);
            if (!plan.ok) return plan;
            const saved = await saveHand(room.id, room.round, actor, 0);
            if (saved === "error") return { ok: false, error: "server_error" };
            patch = plan.patch;
            break;
          }
        }

        const plan = planGuess(room, actor, value);
        if (!plan.ok) return plan;
        patch = plan.patch;
        if (plan.needsReveal) {
          // Бүгд таасан — одоо л нууц гаруудыг уншиж, өрөөнд нийтэлнэ.
          const hands = await readHands(room.id, room.round);
          if (!hands) return { ok: false, error: "server_error" };
          patch = { ...patch, ...planReveal(room, plan.patch.guesses ?? [], hands) };
        }
        break;
      }

      case "next": {
        if (seat === null) return { ok: false, error: "not_player" };
        // Хоёр хүн зэрэг дарсан бол хоёр дахь нь зүгээр л шинэ төлөвийг авна.
        if (action.round !== room.round || room.phase !== "reveal") break;
        const plan = planNext(room);
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
    if (currentSeat !== null) await touchSeen(current.id, currentSeat);

    const myHand =
      currentSeat !== null &&
      current.status === "playing" &&
      current.phase !== "reveal" &&
      action.type !== "ping"
        ? await readHand(current.id, current.round, currentSeat)
        : null;

    return { ok: true, room: current, seat: currentSeat, myHand };
  }
  return { ok: false, error: "conflict" };
}
