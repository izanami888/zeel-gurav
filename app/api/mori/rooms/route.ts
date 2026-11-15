import { NextResponse } from "next/server";
import { isValidPlayerId } from "@/lib/chessRooms";
import { createMoriRoom } from "@/lib/moriRooms";
import { moriResponse } from "@/lib/moriRoomResponse";
import { parseSettings } from "@/games/mori/online";

export const dynamic = "force-dynamic";

/** Шинэ онлайн өрөө үүсгэнэ. Body: { playerId, name, settings } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const settings = parseSettings(body?.settings);

  if (!isValidPlayerId(body?.playerId) || !settings) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  return moriResponse(await createMoriRoom(body.playerId, body.name, settings));
}
