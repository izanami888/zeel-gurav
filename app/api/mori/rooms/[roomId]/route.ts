import { NextResponse } from "next/server";
import { isValidPlayerId, normalizeRoomId } from "@/lib/chessRooms";
import { actOnMoriRoom } from "@/lib/moriRooms";
import { moriResponse } from "@/lib/moriRoomResponse";
import { isMoriAction } from "@/games/mori/online";

export const dynamic = "force-dynamic";

/**
 * Өрөөнд үйлдэл хийх. Body: { playerId, action: MoriAction }
 * Шагай хаях үйлдэл ("roll") нь үр дүн агуулдаггүй — шагайг сервер хаяна.
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
  if (!isValidPlayerId(body?.playerId) || !isMoriAction(body?.action)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  return moriResponse(await actOnMoriRoom(roomId, body.playerId, body.action));
}
