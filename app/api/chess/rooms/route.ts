import { NextResponse } from "next/server";
import { createRoom, isValidPlayerId } from "@/lib/chessRooms";
import { roomResponse } from "@/lib/chessRoomResponse";

export const dynamic = "force-dynamic";

/** Шинэ онлайн өрөө үүсгэнэ. Body: { playerId, color: "w" | "b" | "random" } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const color = body?.color;

  if (
    !isValidPlayerId(body?.playerId) ||
    (color !== "w" && color !== "b" && color !== "random")
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  return roomResponse(await createRoom(body.playerId, color));
}
