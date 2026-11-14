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

/**
 * Өрөөний API руу тоглогчийн ID-тай POST илгээнэ. Амжилтгүй бол алдааны
 * кодыг (эсвэл "network" / "server_error") буцаана.
 */
export async function postRoomApi<T>(
  path: string,
  body: object
): Promise<{ data: T } | { error: string }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: getPlayerId(), ...body }),
    });
  } catch {
    return { error: "network" };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.room) {
    return { error: (data?.error as string) ?? "server_error" };
  }
  return { data: data as T };
}

async function postRoom(path: string, body: object): Promise<RoomSession> {
  const result = await postRoomApi<RoomSession>(path, body);
  if ("error" in result) throw new RoomError(result.error as RoomErrorCode);
  return result.data;
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

interface RoomRowHandlers<Row, Presence> {
  /** Өрөөний мөр өөрчлөгдөх бүрд. */
  onRoom: (room: Row) => void;
  /** Одоо холбогдсон байгаа хүмүүсийн зарласан мэдээлэл. */
  onPresence: (entries: Presence[]) => void;
  /** Realtime холболт тогтсон / тасарсан үед. */
  onConnection: (connected: boolean) => void;
}

/**
 * Өрөөний хүснэгтийн нэг мөрийг Realtime-аар сонсож, өөрийгөө presence-д
 * зарлана. Буцаасан функцийг дуудаж салгана. Supabase тохируулаагүй бол
 * юу ч хийхгүй. Онлайн горимтой бүх тоглоом үүнийг ашиглана.
 */
export function subscribeToRoomRow<Row, Presence extends object>(
  table: string,
  roomId: string,
  /** Нууц playerId-г биш, зөвхөн нийтэд ил байж болох зүйлийг зарлана. */
  presence: Presence,
  handlers: RoomRowHandlers<Row, Presence>
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client.channel(`${table}:${roomId}`, {
    config: { presence: { key: randomId() } },
  });

  channel
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table, filter: `id=eq.${roomId}` },
      (payload) => handlers.onRoom(payload.new as Row)
    )
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Presence>();
      handlers.onPresence(Object.values(state).flat() as Presence[]);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        handlers.onConnection(true);
        void channel.track(presence);
      } else {
        handlers.onConnection(false);
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}

interface RoomSubscriptionHandlers {
  /** Өрөөний мөр өөрчлөгдөх бүрд. */
  onRoom: (room: ChessRoom) => void;
  /** Одоо холбогдсон байгаа тоглогчдын өнгө. */
  onPresence: (online: Set<Color>) => void;
  /** Realtime холболт тогтсон / тасарсан үед. */
  onConnection: (connected: boolean) => void;
}

/** Шатрын өрөөний Realtime сувагт холбогдоно. */
export function subscribeToChessRoom(
  roomId: string,
  role: Role,
  handlers: RoomSubscriptionHandlers
): () => void {
  return subscribeToRoomRow<ChessRoom, { role: Role }>(
    "chess_rooms",
    roomId,
    { role },
    {
      onRoom: handlers.onRoom,
      onConnection: handlers.onConnection,
      onPresence: (entries) => {
        const online = new Set<Color>();
        for (const entry of entries) {
          if (entry.role === "w" || entry.role === "b") online.add(entry.role);
        }
        handlers.onPresence(online);
      },
    }
  );
}
