import { NextResponse } from "next/server";
import {
  actOnRoom,
  isValidPlayerId,
  joinRoom,
  normalizeRoomId,
} from "@/lib/chessRooms";
import { roomResponse } from "@/lib/chessRoomResponse";
import { isRoomAction } from "@/games/chess/online";

export const dynamic = "force-dynamic";

/**
 * Өрөөнд орох эсвэл үйлдэл хийх.
 * Body: { playerId, action: { type: "join" } | RoomAction }
 */
export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const body = await request.json().catch(() => null);
  const roomId = normalizeRoomId(params.roomId);

  if (!roomId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isValidPlayerId(body?.playerId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (body.action?.type === "join") {
    return roomResponse(await joinRoom(roomId, body.playerId));
  }
  if (!isRoomAction(body.action)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  return roomResponse(await actOnRoom(roomId, body.playerId, body.action));
}
