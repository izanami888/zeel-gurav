import { NextResponse } from "next/server";
import { isValidPlayerId, normalizeRoomId } from "@/lib/chessRooms";
import { actOnChuluuRoom } from "@/lib/chuluuRooms";
import { chuluuResponse } from "@/lib/chuluuRoomResponse";
import { isChuluuAction } from "@/games/chuluu/online";

export const dynamic = "force-dynamic";

/** Өрөөнд үйлдэл хийх. Body: { playerId, action: ChuluuAction } */
export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const body = await request.json().catch(() => null);
  const roomId = normalizeRoomId(params.roomId);

  if (!roomId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isValidPlayerId(body?.playerId) || !isChuluuAction(body?.action)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  return chuluuResponse(await actOnChuluuRoom(roomId, body.playerId, body.action));
}
