import { supabase } from "./supabase";
import type { Color } from "@/games/chess/logic";
import type {
  ChessRoom,
  ColorChoice,
  Role,
  RoomAction,
  RoomErrorCode,
} from "@/games/chess/online";

// Онлайн шатрын өрөөний клиент талын код:
//  - тоглогчийн нэргүй ID (localStorage)
//  - өрөө үүсгэх / орох / нүүх (бичилт бүр манай API route-оор дамжина)
//  - Supabase Realtime: өрөөний мөрийн өөрчлөлт + хэн холбогдсон (presence)

const PLAYER_ID_KEY = "playboard_player_id";
let memoryPlayerId: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Энэ төхөөрөмжийн тоглогчийн нууц ID. Нэвтрэх шаардлагагүй — хуудсаа
 * дахин ачаалсан ч ижил ID-аар өрөөндөө буцаж орно.
 */
export function getPlayerId(): string {
  try {
    const saved = window.localStorage.getItem(PLAYER_ID_KEY);
    if (saved) return saved;
    const created = randomId();
    window.localStorage.setItem(PLAYER_ID_KEY, created);
    return created;
  } catch {
    // localStorage хаалттай (жишээ нь: нууц горим) — зөвхөн энэ таб дотор.
    if (!memoryPlayerId) memoryPlayerId = randomId();
    return memoryPlayerId;
  }
}

export class RoomError extends Error {
  constructor(public code: RoomErrorCode) {
    super(code);
  }
}

export interface RoomSession {
  room: ChessRoom;
  role: Role;
}

async function postRoom(path: string, body: object): Promise<RoomSession> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: getPlayerId(), ...body }),
    });
  } catch {
    throw new RoomError("network");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.room) {
    throw new RoomError((data?.error as RoomErrorCode) ?? "server_error");
  }
  return data as RoomSession;
}

export function createChessRoom(color: ColorChoice): Promise<RoomSession> {
  return postRoom("/api/chess/rooms", { color });
}

export function joinChessRoom(roomId: string): Promise<RoomSession> {
  return postRoom(`/api/chess/rooms/${encodeURIComponent(roomId)}`, {
    action: { type: "join" },
  });
}

export function sendChessAction(
  roomId: string,
  action: RoomAction
): Promise<RoomSession> {
  return postRoom(`/api/chess/rooms/${encodeURIComponent(roomId)}`, { action });
}

/** Өрөөний одоогийн төлөвийг шууд уншина (Realtime тасарсан үеийн нөөц). */
export async function fetchChessRoom(roomId: string): Promise<ChessRoom | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("chess_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ChessRoom;
}

interface RoomSubscriptionHandlers {
  /** Өрөөний мөр өөрчлөгдөх бүрд. */
  onRoom: (room: ChessRoom) => void;
  /** Одоо холбогдсон байгаа тоглогчдын өнгө. */
  onPresence: (online: Set<Color>) => void;
  /** Realtime холболт тогтсон / тасарсан үед. */
  onConnection: (connected: boolean) => void;
}

/**
 * Өрөөний Realtime сувагт холбогдоно. Буцаасан функцийг дуудаж салгана.
 * Supabase тохируулаагүй бол юу ч хийхгүй.
 */
export function subscribeToChessRoom(
  roomId: string,
  role: Role,
  handlers: RoomSubscriptionHandlers
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client.channel(`chess-room:${roomId}`, {
    config: { presence: { key: randomId() } },
  });

  channel
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chess_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => handlers.onRoom(payload.new as ChessRoom)
    )
    .on("presence", { event: "sync" }, () => {
      const online = new Set<Color>();
      const state = channel.presenceState<{ role: Role }>();
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (entry.role === "w" || entry.role === "b") online.add(entry.role);
        }
      }
      handlers.onPresence(online);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        handlers.onConnection(true);
        // Нууц playerId-г биш, зөвхөн өнгөө л зарлана.
        void channel.track({ role });
      } else {
        handlers.onConnection(false);
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
