import { supabase } from "./supabase";
import { postRoomApi, subscribeToRoomRow } from "./realtime";
import type { MoriSettings } from "@/games/mori/logic";
import type { MoriAction, MoriErrorCode, MoriRoom } from "@/games/mori/online";

// "Морь уралдуулах" онлайн өрөөний клиент талын код. Бичилт бүр манай API
// route-оор дамжина; хөтөч зөвхөн нийтийн өрөөний мөрийг уншина.
// Шагайг сервер хаядаг тул эндээс зөвхөн "roll" гэсэн хүсэлт явна.

export class MoriRoomError extends Error {
  constructor(public code: MoriErrorCode) {
    super(code);
  }
}

export interface MoriSession {
  room: MoriRoom;
  /** Миний суудал (үзэгч бол null). */
  seat: number | null;
}

async function post(path: string, body: object): Promise<MoriSession> {
  const result = await postRoomApi<MoriSession>(path, body);
  if ("error" in result) throw new MoriRoomError(result.error as MoriErrorCode);
  return result.data;
}

export function createMoriRoom(
  name: string,
  settings: MoriSettings
): Promise<MoriSession> {
  return post("/api/mori/rooms", { name, settings });
}

export function sendMoriAction(
  roomId: string,
  action: MoriAction
): Promise<MoriSession> {
  return post(`/api/mori/rooms/${encodeURIComponent(roomId)}`, { action });
}

/** Өрөөний төлөвийг шууд уншина (Realtime тасарсан үеийн нөөц). */
export async function fetchMoriRoom(roomId: string): Promise<MoriRoom | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mori_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) return null;
  return data as MoriRoom;
}

export function subscribeToMoriRoom(
  roomId: string,
  seat: number | null,
  handlers: {
    onRoom: (room: MoriRoom) => void;
    /** Одоо холбогдсон байгаа суудлууд. */
    onPresence: (online: Set<number>) => void;
    onConnection: (connected: boolean) => void;
  }
): () => void {
  return subscribeToRoomRow<MoriRoom, { seat: number | null }>(
    "mori_rooms",
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
