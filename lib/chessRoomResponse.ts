import "server-only";
import { NextResponse } from "next/server";
import type { RoomOutcome } from "./chessRooms";
import type { RoomErrorCode } from "@/games/chess/online";

const STATUS: Partial<Record<RoomErrorCode, number>> = {
  not_configured: 503,
  bad_request: 400,
  not_found: 404,
  not_player: 403,
  conflict: 409,
  server_error: 500,
};

export function roomResponse(outcome: RoomOutcome) {
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error },
      { status: STATUS[outcome.error] ?? 422 }
    );
  }
  return NextResponse.json({ room: outcome.room, role: outcome.role });
}
