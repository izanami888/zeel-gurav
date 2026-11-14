import { supabase } from "./supabase";
import { postRoomApi, subscribeToRoomRow } from "./realtime";
import type { ChuluuSettings } from "@/games/chuluu/logic";
import type {
  ChuluuAction,
  ChuluuErrorCode,
  ChuluuRoom,
} from "@/games/chuluu/online";

// "Чулуу таалцах" онлайн өрөөний клиент талын код. Бичилт бүр манай API
// route-оор дамжина; хөтөч зөвхөн нийтийн өрөөний мөрийг уншина.

export class ChuluuRoomError extends Error {
  constructor(public code: ChuluuErrorCode) {
    super(code);
  }
}

export interface ChuluuSession {
  room: ChuluuRoom;
  /** Миний суудал (үзэгч бол null). */
  seat: number | null;
  /** Энэ үед миний атгасан чулуу — сервер зөвхөн өөрийнхийг минь буцаана. */
  myHand: number | null;
}

async function post(path: string, body: object): Promise<ChuluuSession> {
  const result = await postRoomApi<ChuluuSession>(path, body);
  if ("error" in result) throw new ChuluuRoomError(result.error as ChuluuErrorCode);
  return result.data;
}

export function createChuluuRoom(
  name: string,
  settings: ChuluuSettings
): Promise<ChuluuSession> {
  return post("/api/chuluu/rooms", { name, settings });
}

export function sendChuluuAction(
  roomId: string,
  action: ChuluuAction
): Promise<ChuluuSession> {
  return post(`/api/chuluu/rooms/${encodeURIComponent(roomId)}`, { action });
}

/** Өрөөний нийтийн төлөвийг шууд уншина (Realtime тасарсан үеийн нөөц). */
export async function fetchChuluuRoom(roomId: string): Promise<ChuluuRoom | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("chuluu_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ChuluuRoom;
}

export function subscribeToChuluuRoom(
  roomId: string,
  seat: number | null,
  handlers: {
    onRoom: (room: ChuluuRoom) => void;
    /** Одоо холбогдсон байгаа суудлууд. */
    onPresence: (online: Set<number>) => void;
    onConnection: (connected: boolean) => void;
  }
): () => void {
  return subscribeToRoomRow<ChuluuRoom, { seat: number | null }>(
    "chuluu_rooms",
    roomId,
    { seat },
    {
      onRoom: handlers.onRoom,
      onConnection: handlers.onConnection,
      onPresence: (entries) => {
        const online = new Set<number>();
        for (const entry of entries) {
          if (typeof entry.seat === "number") online.add(entry.seat);
        }
        handlers.onPresence(online);
      },
    }
  );
}

const NAME_KEY = "playboard_player_name";

export function loadSavedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage хаалттай — зүгээр л санахгүй.
  }
}
