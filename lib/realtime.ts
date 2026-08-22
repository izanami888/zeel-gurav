import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Онлайн олон тоглогчийн тоглоомын өрөө (playroom) хийхэд ашиглах
 * Supabase Realtime тусламж (STUB — энэ pass-д идэвхжээгүй).
 *
 * Ирээдүйд хийх зүйлс:
 *  - `rooms` хүснэгт үүсгэх (id, game, state (jsonb), created_at гэх мэт)
 *  - Тоглогч бүр өрөөнд элсэхдээ broadcast/presence ашиглан холбогдоно
 *  - Ноорог (move) хийх бүрдээ Postgres Changes эсвэл broadcast event илгээнэ
 *
 * Доорх функцууд одоогоор зөвхөн жишээ бөгөөд бодит логик агуулаагүй.
 * `/games/tic-tac-toe/room/[roomId]` маршрут одоогоор зөвхөн "Тун удахгүй"
 * гэсэн placeholder харуулдаг.
 */

export function joinGameRoom(roomId: string): RealtimeChannel | null {
  if (!supabase) return null;

  // ЖИШЭЭ (идэвхгүй) — өрөөнд элсэх, тоглогчийн нүд/ноорог дамжуулах:
  //
  // const channel = supabase.channel(`room:${roomId}`, {
  //   config: { presence: { key: userId } },
  // });
  //
  // channel
  //   .on("presence", { event: "sync" }, () => {
  //     const state = channel.presenceState();
  //     console.log("Тоглогчид өрөөнд:", state);
  //   })
  //   .on("broadcast", { event: "move" }, (payload) => {
  //     // Өрсөлдөгчийн хийсэн нүдийг локал state-д оруулах
  //     console.log("Ноорог хийгдлээ:", payload);
  //   })
  //   .subscribe(async (status) => {
  //     if (status === "SUBSCRIBED") {
  //       await channel.track({ joinedAt: new Date().toISOString() });
  //     }
  //   });
  //
  // return channel;

  return null;
}

export function sendMove(
  _channel: RealtimeChannel,
  _move: { cell: number; player: "X" | "O" }
) {
  // ЖИШЭЭ (идэвхгүй):
  // channel.send({
  //   type: "broadcast",
  //   event: "move",
  //   payload: move,
  // });
}

export function leaveGameRoom(channel: RealtimeChannel | null) {
  if (!channel || !supabase) return;
  supabase.removeChannel(channel);
}
